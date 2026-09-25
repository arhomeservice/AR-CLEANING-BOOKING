import { supabase } from './supabaseClient.js'

/* ---------- helpers ---------- */
const two = (n) => String(n).padStart(2, '0')
export function timeObj(startStr, endStr) {
  // accepts "HH:MM" or "HH:MM:SS"
  const toMin = (t) => { const [h, m] = t.split(':'); return (+h) * 60 + (+m) }
  const s = toMin(startStr), e = toMin(endStr)
  const fmt = (mins) => `${two(Math.floor(mins / 60))}:${two(mins % 60)}`
  return { start: fmt(s), end: fmt(e), startMin: s, endMin: e, minutes: e - s }
}
export function normalizePhone(raw) {
  if (!raw) return null
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 10) d = '971' + d.slice(1)
  if (!d.startsWith('971') && d.length === 9) d = '971' + d
  return d.length >= 11 ? '+' + d : ('+' + d)
}

/* map a joined DB booking row -> the shape the UI already uses */
function toUi(r) {
  const loc = r.location || {}
  return {
    id: r.id,
    dbId: r.id,
    date: r.booking_date,
    time: timeObj(r.start_time, r.end_time),
    materials: !!r.materials_required,
    price: r.price,
    code: r.service_type || '',
    status: r.status,
    notes: r.notes || '',
    clientId: r.client?.id || r.client_id,
    clientName: r.client?.full_name || '',
    phone: r.client?.mobile_number || '',
    building: loc.building_name || '',
    apt: loc.unit_number || '',
    area: loc.area || '',
    gps: (loc.latitude != null && loc.longitude != null) ? { lat: loc.latitude, lng: loc.longitude } : null,
    locationId: r.location_id,
    cleanerId: r.assigned_cleaner_id,
    cleanerName: r.cleaner?.name || '',
    mode: 'AUTO',
  }
}

const SELECT = `
  id, booking_date, start_time, end_time, materials_required, price, service_type, status, notes,
  client_id, location_id, assigned_cleaner_id
`

/* ---------- reference data ---------- */
export async function getCleaners() {
  const { data, error } = await supabase.from('cleaners').select('id, name, active').order('name')
  if (error) throw error
  return data
}

/* ---------- bookings for a date (robust: base rows first, then attach names) ---------- */
export async function getBookingsForDate(date) {
  const { data: rows, error } = await supabase.from('bookings').select(SELECT)
    .eq('booking_date', date).neq('status', 'CANCELLED').order('start_time')
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const clientIds = [...new Set(rows.map(r => r.client_id).filter(Boolean))]
  const locIds    = [...new Set(rows.map(r => r.location_id).filter(Boolean))]
  const cleanerIds= [...new Set(rows.map(r => r.assigned_cleaner_id).filter(Boolean))]

  const [clients, locations, cleaners] = await Promise.all([
    clientIds.length  ? supabase.from('clients').select('id, full_name, mobile_number').in('id', clientIds) : { data: [] },
    locIds.length     ? supabase.from('locations').select('id, building_name, unit_number, area, latitude, longitude').in('id', locIds) : { data: [] },
    cleanerIds.length ? supabase.from('cleaners').select('id, name').in('id', cleanerIds) : { data: [] },
  ])
  const cMap = new Map((clients.data || []).map(c => [c.id, c]))
  const lMap = new Map((locations.data || []).map(l => [l.id, l]))
  const kMap = new Map((cleaners.data || []).map(k => [k.id, k]))

  return rows.map(r => toUi({
    ...r,
    client: cMap.get(r.client_id),
    location: lMap.get(r.location_id),
    cleaner: kMap.get(r.assigned_cleaner_id),
  }))
}

/* ---------- client lookup by phone ---------- */
export async function findClientByPhone(phone) {
  const p = normalizePhone(phone)
  if (!p) return null
  const { data, error } = await supabase.from('clients')
    .select('id, full_name, mobile_number').eq('mobile_number', p).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: pr } = await supabase.from('client_preferences')
    .select('booking_count, last_booking_date, preferred_day, preferred_start_time, preferred_end_time, preferred_cleaner_id, preferred_location_id')
    .eq('client_id', data.id).maybeSingle()
  return { id: data.id, name: data.full_name, phone: data.mobile_number, prefs: pr || null }
}

/* fetch a location row (for rebook prefill) */
export async function getLocation(id) {
  if (!id) return null
  const { data, error } = await supabase.from('locations')
    .select('building_name, unit_number, area, latitude, longitude').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/* ---------- find or create client ---------- */
async function upsertClient({ name, phone }) {
  const p = normalizePhone(phone)
  if (p) {
    const { data: found } = await supabase.from('clients').select('id').eq('mobile_number', p).maybeSingle()
    if (found) return found.id
  }
  const { data, error } = await supabase.from('clients')
    .insert({ full_name: name, mobile_number: p }).select('id').single()
  if (error) throw error
  return data.id
}

/* find or create a location for this client+address */
async function upsertLocation(clientId, ui) {
  const { data: found } = await supabase.from('locations').select('id')
    .eq('client_id', clientId)
    .eq('building_name', ui.building || '')
    .maybeSingle()
  const payload = {
    client_id: clientId,
    building_name: ui.building || null,
    unit_number: ui.apt || null,
    area: ui.area || null,
    full_address: [ui.building, ui.apt, ui.area].filter(Boolean).join(', ') || null,
    latitude: ui.gps?.lat ?? null,
    longitude: ui.gps?.lng ?? null,
  }
  if (found) {
    const { error } = await supabase.from('locations').update(payload).eq('id', found.id)
    if (error) throw error
    return found.id
  }
  const { data, error } = await supabase.from('locations').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

/* ---------- create a booking (+ deployment) ---------- */
export async function createBooking(ui) {
  const clientId = await upsertClient({ name: ui.clientName, phone: ui.phone })
  const locationId = await upsertLocation(clientId, ui)
  const bookingRow = {
    client_id: clientId,
    location_id: locationId,
    booking_date: ui.date,
    start_time: ui.time.start,
    end_time: ui.time.end,
    materials_required: !!ui.materials,
    price: ui.price === '' ? null : Number(ui.price),
    currency: 'AED',
    service_type: ui.code || null,
    assigned_cleaner_id: ui.cleanerId || null,
    status: ui.cleanerId ? 'ASSIGNED' : 'PENDING',
    notes: ui.notes || null,
  }
  const { data: bk, error } = await supabase.from('bookings').insert(bookingRow).select('id').single()
  if (error) throw error
  if (ui.cleanerId) {
    await supabase.from('deployments').insert({
      booking_id: bk.id, cleaner_id: ui.cleanerId, deployment_date: ui.date,
      start_time: ui.time.start, end_time: ui.time.end, status: 'PLANNED',
    })
  }
  return bk.id
}

/* ---------- update a booking (+ its location + deployment) ---------- */
export async function updateBooking(id, ui) {
  // update the booking row
  const patch = {
    booking_date: ui.date,
    start_time: ui.time.start,
    end_time: ui.time.end,
    materials_required: !!ui.materials,
    price: ui.price === '' ? null : Number(ui.price),
    service_type: ui.code || null,
    assigned_cleaner_id: ui.cleanerId || null,
    status: ui.cleanerId ? 'ASSIGNED' : 'PENDING',
    notes: ui.notes || null,
  }
  const { data: bk, error } = await supabase.from('bookings').update(patch).eq('id', id)
    .select('client_id, location_id').single()
  if (error) throw error
  // update the location in place
  if (bk.location_id) {
    await supabase.from('locations').update({
      building_name: ui.building || null, unit_number: ui.apt || null, area: ui.area || null,
      full_address: [ui.building, ui.apt, ui.area].filter(Boolean).join(', ') || null,
      latitude: ui.gps?.lat ?? null, longitude: ui.gps?.lng ?? null,
    }).eq('id', bk.location_id)
  }
  // keep the deployment in sync (create if missing)
  const dep = {
    cleaner_id: ui.cleanerId || null, deployment_date: ui.date,
    start_time: ui.time.start, end_time: ui.time.end,
  }
  const { data: existing } = await supabase.from('deployments').select('id').eq('booking_id', id).maybeSingle()
  if (existing) await supabase.from('deployments').update(dep).eq('id', existing.id)
  else if (ui.cleanerId) await supabase.from('deployments').insert({ booking_id: id, status: 'PLANNED', ...dep })
}

/* ---------- cancel (soft delete) ---------- */
export async function cancelBooking(id) {
  const { error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', id)
  if (error) throw error
  await supabase.from('deployments').update({ status: 'CANCELLED' }).eq('booking_id', id)
}

/* ---------- realtime: fire cb() on any booking/deployment change ---------- */
export function subscribeChanges(cb) {
  const ch = supabase.channel('ops')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deployments' }, cb)
    .subscribe()
  return () => supabase.removeChannel(ch)
}
