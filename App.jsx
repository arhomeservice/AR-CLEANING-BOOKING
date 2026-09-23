import React, { useState, useMemo, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { CSS } from "./styles.js";
import { supabase } from "./supabaseClient.js";
import {
  getCleaners, getBookingsForDate, findClientByPhone, getLocation,
  createBooking, updateBooking, cancelBooking, subscribeChanges, timeObj
} from "./db.js";

/* ---------- static reference ---------- */
const AREA_COORDS = {
  "Reem Island":[24.4991,54.4065],"Corniche":[24.4764,54.3376],"Al Khalidiyah":[24.4611,54.3486],
  "Al Bateen":[24.4550,54.3300],"Al Nahyan":[24.4700,54.3800],"Khalifa City":[24.4200,54.5800],
  "Yas Island":[24.4990,54.6070],"Al Raha":[24.4560,54.6060],"Al Shamkha":[24.3660,54.6260],
};
const AREAS = Object.keys(AREA_COORDS);
const PLACES = [
  {name:"Bel Ghailam Tower", area:"Corniche", lat:24.4761, lng:54.3389},
  {name:"Sun & Sky Tower, Shams", area:"Reem Island", lat:24.4979, lng:54.4048},
  {name:"Marina Heights", area:"Reem Island", lat:24.5015, lng:54.4102},
  {name:"Al Khalidiyah Village", area:"Al Khalidiyah", lat:24.4620, lng:54.3475},
  {name:"Bateen Park Residence", area:"Al Bateen", lat:24.4548, lng:54.3312},
  {name:"Yas Acres Villa", area:"Yas Island", lat:24.4972, lng:54.6041},
  {name:"Khalifa City Villa A", area:"Khalifa City", lat:24.4188, lng:54.5822},
  {name:"Al Raha Gardens", area:"Al Raha", lat:24.4571, lng:54.6033},
];
const RATE_PER_HOUR = 40, MATERIALS_FEE = 20;
const TODAY = new Date().toISOString().slice(0,10);

/* ---------- helpers ---------- */
const toMin=(t)=>{const [h,m]=t.split(":").map(Number);return h*60+m;};
const minToStr=(mins)=>`${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
const fmtDur=(mins)=>{const h=Math.floor(mins/60),m=mins%60; return m?`${h}h ${m}m`:`${h}h`;};
function parseTimeRange(raw){
  if(!raw) return null;
  let s = raw.toLowerCase().trim().replace(/\s+/g,"").replace(/to|–|—|~|\.\.|until/g,"-");
  if(!s.includes("-")) return null;
  const [aRaw,bRaw]=s.split("-");
  const one=(t)=>{
    if(t===undefined||t==="") return null;
    let pm=false,am=false;
    if(t.endsWith("pm")){pm=true;t=t.slice(0,-2);} else if(t.endsWith("am")){am=true;t=t.slice(0,-2);}
    else if(t.endsWith("p")){pm=true;t=t.slice(0,-1);} else if(t.endsWith("a")){am=true;t=t.slice(0,-1);}
    let h,m=0;
    if(t.includes(":")){const [hh,mm]=t.split(":");h=parseInt(hh,10);m=parseInt(mm||"0",10);}
    else if(t.length>=3){h=parseInt(t.slice(0,t.length-2),10);m=parseInt(t.slice(-2),10);}
    else {h=parseInt(t,10);m=0;}
    if(isNaN(h)||isNaN(m)) return null;
    if(pm&&h<12)h+=12; if(am&&h===12)h=0;
    if(h>23||m>59) return null;
    return h*60+m;
  };
  const a=one(aRaw),b=one(bRaw);
  if(a===null||b===null||b<=a) return null;
  return {startMin:a,endMin:b,start:minToStr(a),end:minToStr(b),minutes:b-a};
}
function haversine(a,b){
  const R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLng=(b[1]-a[1])*Math.PI/180;
  const la1=a[0]*Math.PI/180,la2=b[0]*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
function travelMin(a,b){
  if(!a||!b) return 0;
  if(a===b) return 8;
  if(!AREA_COORDS[a]||!AREA_COORDS[b]) return 20;
  return Math.max(10, Math.round(haversine(AREA_COORDS[a],AREA_COORDS[b])/32*60)+8);
}
function detectAreaFromCoords(lat,lng){
  let best=null,bd=Infinity;
  for(const a of AREAS){const d=haversine([lat,lng],AREA_COORDS[a]); if(d<bd){bd=d;best=a;}}
  return best;
}
function parseGmaps(url){
  const m=url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)||url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  return m?{lat:parseFloat(m[1]),lng:parseFloat(m[2])}:null;
}
const mapsLink=(gps)=>gps?`https://waze.com/ul?ll=${gps.lat},${gps.lng}&navigate=yes`:"";
function compactTime(t){ let [h,m]=t.split(":"); h=String(parseInt(h,10)); return m==="00"?h:`${h}:${m}`; }
function fmtSheetDate(date){ try{ return new Date(date+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short",year:"numeric"}); }catch(e){ return date; } }
function gapTag(prev,cur){
  const need=travelMin(prev.area,cur.area), gap=toMin(cur.start)-toMin(prev.end);
  if(gap<need) return ["conflict",`can't reach · needs ${need}m, ${gap}m`];
  if(gap-need<15) return ["tight",`tight · ${gap}m gap`];
  return ["ok",`ok · ${gap}m gap`];
}
function buildDriverRuns(bookings,date){
  const evs=[];
  const gpsOf=(b)=>b.gps||(AREA_COORDS[b.area]?{lat:AREA_COORDS[b.area][0],lng:AREA_COORDS[b.area][1]}:null);
  bookings.filter(b=>b.date===date).forEach(b=>{
    evs.push({type:"DROP",min:b.time.startMin-30,area:b.area,building:b.building,cleaner:b.cleanerName,gps:gpsOf(b)});
    evs.push({type:"COLLECT",min:b.time.endMin,area:b.area,building:b.building,cleaner:b.cleanerName,gps:gpsOf(b)});
  });
  evs.sort((a,b)=>a.min-b.min||(a.type<b.type?-1:1));
  const runs=[];
  evs.forEach(e=>{
    const g=runs.find(r=>r.type===e.type&&r.area===e.area&&Math.abs(e.min-r.min)<=20);
    if(g){g.cleaners.push(e.cleaner); if(e.building&&!g.buildings.includes(e.building))g.buildings.push(e.building);}
    else runs.push({type:e.type,min:e.min,area:e.area,cleaners:[e.cleaner],buildings:e.building?[e.building]:[],gps:e.gps});
  });
  return runs.sort((a,b)=>a.min-b.min);
}
function exportDeployment(dayBookings,date){
  const rows=dayBookings.slice()
    .sort((a,b)=>(a.cleanerName||"").localeCompare(b.cleanerName||"")||a.time.startMin-b.time.startMin)
    .map(b=>({Cleaner:b.cleanerName, Client:b.clientName, Building:b.building||"", "Apt/Villa":b.apt||"",
      Area:b.area, Start:b.time.start, End:b.time.end, Duration:fmtDur(b.time.minutes),
      Materials:b.materials?"W/m":"", Price:b.price??"", Code:b.code||"", Notes:b.notes||"",
      "Map link":mapsLink(b.gps)}));
  const ws=XLSX.utils.json_to_sheet(rows);
  rows.forEach((r,i)=>{ if(r["Map link"]){ const a=XLSX.utils.encode_cell({c:12,r:i+1}); if(ws[a]) ws[a].l={Target:r["Map link"],Tooltip:"Open in Waze"}; }});
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Deployment");
  XLSX.writeFile(wb,`Deployment_${date}.xlsx`);
}
function exportDriver(runs,date){
  const rows=runs.map(r=>({Time:minToStr(r.min), Type:r.type, Cleaners:r.cleaners.join(" + "),
    Location:r.buildings.length?r.buildings.join(" / "):r.area, Area:r.area, "Map link":mapsLink(r.gps)}));
  const ws=XLSX.utils.json_to_sheet(rows);
  rows.forEach((r,i)=>{ if(r["Map link"]){ const a=XLSX.utils.encode_cell({c:5,r:i+1}); if(ws[a]) ws[a].l={Target:r["Map link"],Tooltip:"Open in Waze"}; }});
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Driver schedule");
  XLSX.writeFile(wb,`Driver_${date}.xlsx`);
}

/* ---------- assignment engine ---------- */
function evaluateCleaners({time,area,preferredCleanerId,workedCleanerIds}, cleaners, bookingsForDate){
  if(!time||!area||!cleaners||!cleaners.length) return null;
  const jS=time.startMin,jE=time.endMin;
  const results=cleaners.map((cl)=>{
    const bks=bookingsForDate.filter(b=>b.cleanerId===cl.id)
      .map(b=>({start:b.time.start,end:b.time.end,area:b.area||"",client:b.clientName}))
      .sort((a,b)=>toMin(a.start)-toMin(b.start));
    const overlap=bks.find(b=>toMin(b.start)<jE&&toMin(b.end)>jS);
    if(overlap) return {cleaner:cl,ok:false,reason:`Already booked ${overlap.start}–${overlap.end} (${overlap.client})`};
    const before=bks.filter(b=>toMin(b.end)<=jS).sort((a,b)=>toMin(b.end)-toMin(a.end))[0];
    const after =bks.filter(b=>toMin(b.start)>=jE).sort((a,b)=>toMin(a.start)-toMin(b.start))[0];
    if(before){const need=travelMin(before.area,area),gap=jS-toMin(before.end);
      if(gap<need) return {cleaner:cl,ok:false,reason:`Can't travel from ${before.area||"previous job"} in time — needs ${need}m, only ${gap}m`};}
    if(after){const need=travelMin(area,after.area),gap=toMin(after.start)-jE;
      if(gap<need) return {cleaner:cl,ok:false,reason:`Next job (${after.area} ${after.start}) impossible — needs ${need}m, only ${gap}m`};}
    let score=0;const reasons=["Available","No booking conflict"];
    const preferred=preferredCleanerId&&cl.id===preferredCleanerId;
    const worked=workedCleanerIds&&workedCleanerIds.has&&workedCleanerIds.has(cl.id);
    if(preferred){score+=100;reasons.push("Client's preferred cleaner");}
    if(worked&&!preferred){score+=40;reasons.push("Has worked with this client before");}
    if(before){const prox=travelMin(before.area,area);score+=Math.max(0,40-prox);
      reasons.push(prox<=12?"Nearby previous booking":`Previous booking ${prox}m away`);}
    else if(after){score+=Math.max(0,30-travelMin(area,after.area));}
    else {score+=20;}
    score+=(5-bks.length)*4;
    reasons.push(`Suitable for ${fmtDur(jE-jS)} service`);
    return {cleaner:cl,ok:true,score,reasons};
  });
  return {eligible:results.filter(r=>r.ok).sort((a,b)=>b.score-a.score), blocked:results.filter(r=>!r.ok), all:results};
}

/* ============================================================ */
function Dispatch(){
  const [cleaners,setCleaners]=useState([]);
  const [bookings,setBookings]=useState([]);
  const [view,setView]=useState("new");
  const [boardDate,setBoardDate]=useState(TODAY);
  const [highlight,setHighlight]=useState(null);
  const [banner,setBanner]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  useEffect(()=>{ getCleaners().then(cs=>setCleaners(cs.map(c=>({id:c.id,name:c.name})))).catch(e=>setErr(e.message)); },[]);

  const reload=useCallback(async ()=>{
    setLoading(true);
    try{ setBookings(await getBookingsForDate(boardDate)); setErr(""); }
    catch(e){ setErr(e.message); } finally{ setLoading(false); }
  },[boardDate]);
  useEffect(()=>{ reload(); },[reload]);
  useEffect(()=>{ const off=subscribeChanges(()=>reload()); return off; },[reload]);

  async function handleSave(ui){
    try{
      const id=await createBooking(ui);
      setHighlight(id);
      setBanner({name:ui.clientName, cleaner:ui.cleanerName, time:`${ui.time.start}–${ui.time.end}`, area:ui.area});
      setView("deployment"); window.scrollTo({top:0,behavior:"smooth"});
      if(ui.date!==boardDate) setBoardDate(ui.date); else reload();
    }catch(e){ alert("Could not save booking:\n"+e.message); }
  }
  async function handleUpdate(id,ui){ try{ await updateBooking(id,ui); reload(); }catch(e){ alert("Update failed:\n"+e.message); } }
  async function handleCancel(id){ try{ await cancelBooking(id); reload(); }catch(e){ alert("Cancel failed:\n"+e.message); } }

  return(
    <div className="ar-root">
      <style>{CSS}</style>
      <header className="ar-head">
        <div>
          <h1>{view==="new"?"New booking":view==="deployment"?"Deployment":"Driver schedule"}</h1>
          <span className="sub">
            {view==="new"?"Enter the client. The system does the rest."
              :view==="deployment"?"Every booking, grouped by cleaner, with travel checks."
              :"Auto-generated drop-offs and collections, grouped by area."}
          </span>
        </div>
        <span className="ar-brand">AR CLEANING · Dispatch</span>
      </header>

      <nav className="nav">
        <button className={view==="new"?"on":""} onClick={()=>setView("new")}>New booking</button>
        <button className={view==="deployment"?"on":""} onClick={()=>setView("deployment")}>
          Deployment<span className="count">{bookings.length}</span>
        </button>
        <button className={view==="driver"?"on":""} onClick={()=>setView("driver")}>
          Driver schedule<span className="count">{buildDriverRuns(bookings,boardDate).length}</span>
        </button>
      </nav>

      {err && <div className="banner"><div className="banner-in" style={{background:"#f7e3e1",border:"1px solid #e6b8b2"}}>
        <span className="bt" style={{color:"#c33a2e"}}>Database error: {err}</span></div></div>}

      {banner && view!=="new" &&
        <div className="banner"><div className="banner-in">
          <span className="bc">✓</span>
          <span className="bt">Booking saved & deployed — {banner.name} <span>· {banner.time} · {banner.cleaner} · {banner.area}</span></span>
          <button className="bx" onClick={()=>setBanner(null)}>×</button>
        </div></div>}

      {view==="new" &&
        <BookingForm cleaners={cleaners} onSave={handleSave}/>}
      {view==="deployment" &&
        <DeploymentView bookings={bookings} cleaners={cleaners} loading={loading}
          date={boardDate} setDate={d=>{setBoardDate(d);setHighlight(null);}} highlight={highlight}
          onUpdate={handleUpdate} onDelete={handleCancel}/>}
      {view==="driver" &&
        <DriverView bookings={bookings} date={boardDate} setDate={setBoardDate}/>}
    </div>
  );
}

/* ---------- booking form ---------- */
function BookingForm({cleaners,onSave}){
  const [name,setName]=useState("");
  const [cc,setCc]=useState("+971");
  const [phone,setPhone]=useState("");
  const [existing,setExisting]=useState(null);
  const [usedExisting,setUsedExisting]=useState(false);
  const [date,setDate]=useState(TODAY);
  const [timeText,setTimeText]=useState("");
  const [materials,setMaterials]=useState(true);
  const [price,setPrice]=useState("");
  const [priceTouched,setPriceTouched]=useState(false);
  const [code,setCode]=useState("O");
  const [notes,setNotes]=useState("");
  const [building,setBuilding]=useState("");
  const [apt,setApt]=useState("");
  const [area,setArea]=useState("");
  const [gps,setGps]=useState(null);
  const [showMap,setShowMap]=useState(false);
  const [override,setOverride]=useState(false);
  const [manualCleaner,setManualCleaner]=useState(null);
  const [showConfirm,setShowConfirm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [dayBookings,setDayBookings]=useState([]);

  const fullPhone=cc+phone.replace(/\D/g,"");
  const time=useMemo(()=>parseTimeRange(timeText),[timeText]);

  // lookup existing client by phone (debounced)
  useEffect(()=>{
    const digits=phone.replace(/\D/g,"");
    if(cc!=="+971"||digits.length<9){ setExisting(null); setUsedExisting(false); return; }
    let on=true; const t=setTimeout(async()=>{
      try{ const c=await findClientByPhone("+971"+digits); if(on){ setExisting(c); setUsedExisting(false);} }
      catch(e){ if(on) setExisting(null); }
    },350);
    return ()=>{on=false;clearTimeout(t);};
  },[phone,cc]);

  // load bookings for the chosen date to feed the conflict engine
  useEffect(()=>{
    let on=true;
    getBookingsForDate(date).then(b=>{ if(on) setDayBookings(b); }).catch(()=>{ if(on) setDayBookings([]); });
    return ()=>{on=false;};
  },[date]);

  const suggested=useMemo(()=>time?Math.round(time.minutes/60*RATE_PER_HOUR+(materials?MATERIALS_FEE:0)):null,[time,materials]);
  const preferredCleanerId=existing?.prefs?.preferred_cleaner_id||null;
  const workedCleanerIds=useMemo(()=> new Set(preferredCleanerId?[preferredCleanerId]:[]),[preferredCleanerId]);
  const assessment=useMemo(
    ()=>evaluateCleaners({time,area,preferredCleanerId,workedCleanerIds}, cleaners, dayBookings),
    [time,area,preferredCleanerId,workedCleanerIds,cleaners,dayBookings]);
  const autoPick=assessment?.eligible?.[0]||null;
  const chosen=manualCleaner?assessment?.all.find(r=>r.cleaner.id===manualCleaner):autoPick;

  const prefName=existing?.prefs?.preferred_cleaner_id
    ? (cleaners.find(c=>c.id===existing.prefs.preferred_cleaner_id)?.name||"—") : "—";
  const usualTime=existing?.prefs?.preferred_start_time&&existing?.prefs?.preferred_end_time
    ? `${existing.prefs.preferred_start_time.slice(0,5)}–${existing.prefs.preferred_end_time.slice(0,5)}` : null;
  const usualMatch=usedExisting&&usualTime&&time&&usualTime.replace("–","-")===`${time.start}-${time.end}`;

  async function rebook(){
    if(!existing) return;
    setName(existing.name); setUsedExisting(true);
    const pr=existing.prefs||{};
    if(pr.preferred_start_time&&pr.preferred_end_time) setTimeText(`${pr.preferred_start_time.slice(0,5)}-${pr.preferred_end_time.slice(0,5)}`);
    if(pr.preferred_cleaner_id) setManualCleaner(null);
    if(pr.preferred_location_id){
      try{ const l=await getLocation(pr.preferred_location_id);
        if(l){ setBuilding(l.building_name||""); setApt(l.unit_number||""); setArea(l.area||"");
          if(l.latitude!=null&&l.longitude!=null) setGps({lat:l.latitude,lng:l.longitude}); } }catch(e){}
    }
    setPriceTouched(false); setPrice("");
    setTimeout(()=>document.getElementById("bk-date")?.focus(),50);
  }

  const displayPrice=priceTouched?price:(price||"");
  const locMissing=building&&!gps;
  const canSave=name.trim()&&phone.replace(/\D/g,"").length>=9&&time&&displayPrice&&area&&(gps||override)&&chosen&&chosen.ok&&!saving;

  async function doSave(){
    setSaving(true);
    const ui={ clientName:name, phone:fullPhone, date, time, materials, price:displayPrice, code,
      building, apt, area, gps, notes, cleanerId:chosen.cleaner.id, cleanerName:chosen.cleaner.name,
      mode:manualCleaner?"MANUAL":"AUTO" };
    setShowConfirm(false);
    await onSave(ui);
    setSaving(false);
  }

  return(
    <>
      <div className="ar-wrap">
        <div>
          <div className="card">
            <p className="sec-title">Client</p>
            <div className="field">
              <label className="lab">Client name <span className="req">*</span></label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/>
            </div>
            <div className="field">
              <label className="lab">Mobile number <span className="req">*</span></label>
              <div className="phone-row">
                <div className="phone-cc"><input value={cc} onChange={e=>setCc(e.target.value)}/></div>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="50 123 4567" inputMode="tel"/>
              </div>
              <p className="hint">Existing customers are matched by number automatically.</p>
            </div>
          </div>

          <div className="card">
            <p className="sec-title">Booking</p>
            <div className="field">
              <label className="lab">Date <span className="req">*</span></label>
              <input id="bk-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <div className="field">
              <label className="lab">Time <span className="req">*</span></label>
              <input value={timeText} onChange={e=>setTimeText(e.target.value)} placeholder="e.g. 9-12  or  15:00-17:00"/>
              {time
                ? <div className="time-parsed"><span className="chip num">{time.start}–{time.end}</span><span className="chip dur num">{fmtDur(time.minutes)}</span></div>
                : timeText ? <p className="hint err">Enter a range like 9-12, 15-17, or 09:00-12:00.</p>
                : <p className="hint">Type a range — it's read as time, never a date or number.</p>}
              {usualMatch && <div className="match">✓ Matches this client's usual schedule</div>}
            </div>
            <div className="field">
              <label className="lab">Materials</label>
              <div className="toggle">
                <button className={materials?"on":""} onClick={()=>setMaterials(true)}>With materials</button>
                <button className={!materials?"on":""} onClick={()=>setMaterials(false)}>Without materials</button>
              </div>
            </div>
            <div className="field">
              <label className="lab">Price <span className="req">*</span></label>
              <div className="price-in">
                <input inputMode="numeric" value={displayPrice} onChange={e=>{setPrice(e.target.value);setPriceTouched(true);}} placeholder="0"/>
                <span className="aed">AED</span>
              </div>
              {suggested!==null && String(displayPrice)!==String(suggested) &&
                <span className="suggest">Suggested {suggested} AED
                  <button onClick={()=>{setPrice(String(suggested));setPriceTouched(true);}}>Use</button></span>}
            </div>
            <div className="field">
              <label className="lab">Payment</label>
              <div className="toggle">
                <button className={code==="O"?"on":""} onClick={()=>setCode("O")}>Online (O)</button>
                <button className={code==="C"?"on":""} onClick={()=>setCode("C")}>Cash (C)</button>
              </div>
            </div>
            <div className="field">
              <label className="lab">Notes</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
                placeholder="Anything the cleaner should know — access, keys, pets, special requests…"/>
            </div>
          </div>

          <div className="card">
            <p className="sec-title">Location</p>
            <div className="row2">
              <div className="field">
                <label className="lab">Building name <span className="req">*</span></label>
                <input value={building} onChange={e=>setBuilding(e.target.value)} placeholder="Building"/>
              </div>
              <div className="field">
                <label className="lab">Apartment / villa / office</label>
                <input value={apt} onChange={e=>setApt(e.target.value)} placeholder="e.g. 705"/>
              </div>
            </div>
            <div className="field">
              <label className="lab">Area</label>
              <select value={area} onChange={e=>setArea(e.target.value)}>
                <option value="">Auto-detected from location…</option>
                {AREAS.map(a=><option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="field">
              {gps
                ? <div className="loc-btn set"><div className="loc-set" style={{width:"100%"}}>
                    <div><div style={{fontWeight:600}}>📍 Location confirmed</div>
                      <div className="co num">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</div></div>
                    <button className="re" onClick={()=>setShowMap(true)}>Change</button></div></div>
                : <button className="loc-btn" onClick={()=>setShowMap(true)}><span>📍 Select location</span><span>›</span></button>}
              {locMissing && !override &&
                <div className="loc-required">Location required — confirm the GPS pin before saving.
                  <label style={{display:"flex",gap:7,marginTop:8,fontWeight:500,color:"var(--ink)",cursor:"pointer"}}>
                    <input type="checkbox" style={{width:"auto"}} checked={override} onChange={e=>setOverride(e.target.checked)}/>
                    Admin override — save without pin</label></div>}
            </div>
          </div>
        </div>

        <div className="sys">
          <div className="sys-card">
            <div className="sys-hd"><span className="dot"/><h3>System handles this</h3></div>
            <div className="sys-body">
              {!existing && !area && !time &&
                <p className="sys-empty">Enter the client and the system matches them, detects the area, assigns a cleaner, and saves everything to the database.</p>}

              {existing &&
                <div className="blk">
                  <div className="cf-top"><span className="badge go">CLIENT FOUND</span>
                    {existing.prefs&&existing.prefs.booking_count>=5&&<span className="badge reg">REGULAR</span>}</div>
                  <div className="cf-name">{existing.name}</div>
                  <div className="cf-grid">
                    <div><div className="k">Bookings</div><div className="v num">{existing.prefs?.booking_count??0}</div></div>
                    <div><div className="k">Last booking</div><div className="v">{existing.prefs?.last_booking_date||"—"}</div></div>
                    <div><div className="k">Preferred cleaner</div><div className="v">{prefName}</div></div>
                    <div><div className="k">Usual</div><div className="v">{existing.prefs?.preferred_day?`${existing.prefs.preferred_day.trim()} ${usualTime||""}`:"—"}</div></div>
                  </div>
                  {!usedExisting
                    ? <><button className="mini-btn pri" onClick={()=>{setName(existing.name);setUsedExisting(true);}}>Use existing client</button>
                        <button className="mini-btn ghost" style={{marginTop:7}} onClick={rebook}>Rebook usual</button></>
                    : <div className="match" style={{marginTop:0}}>✓ Using existing client — no duplicate created</div>}
                </div>}

              {area &&
                <div className="blk"><div className="blk-lab">Detected area</div>
                  <div className="area-det"><span className="an">{area}</span>{gps&&<span className="badge go">FROM PIN</span>}</div></div>}

              {time && area && assessment &&
                <div className="blk">
                  <div className="blk-lab">Cleaner assignment</div>
                  {chosen && chosen.ok ? <>
                      <span className="aa-mode">{manualCleaner?"MANUAL":assessment.eligible.length===1?"AUTO — ONLY OPTION":"AUTO — BEST MATCH"}</span>
                      <div className="aa-name">{chosen.cleaner.name}</div>
                      <ul className="reasons">{chosen.reasons.map((r,i)=><li key={i}><span className="tk">✓</span>{r}</li>)}</ul>
                      <div className="change-sel"><label className="lab">Change cleaner</label>
                        <select value={manualCleaner||""} onChange={e=>setManualCleaner(e.target.value||null)}>
                          <option value="">Auto — {autoPick?.cleaner.name}</option>
                          {assessment.all.map(r=><option key={r.cleaner.id} value={r.cleaner.id} disabled={!r.ok}>{r.cleaner.name}{r.ok?"":" — unavailable"}</option>)}
                        </select></div>
                    </> : assessment.eligible.length===0 ?
                      <div className="conflict-box"><div className="ch">✕ No cleaner can take this booking</div>
                        <ul>{assessment.blocked.map(r=><li key={r.cleaner.id}><b>{r.cleaner.name}:</b> {r.reason}</li>)}</ul></div>
                    : null}
                  {chosen && !chosen.ok &&
                    <div className="conflict-box" style={{marginTop:10}}><div className="ch">✕ {chosen.cleaner.name} — conflict</div><ul><li>{chosen.reason}</li></ul></div>}
                </div>}

              <div className="save-wrap">
                <button className="save-btn" disabled={!canSave} onClick={()=>setShowConfirm(true)}>{saving?"Saving…":"Review booking"}</button>
                <p className="save-note">{canSave?"Ready — review, save, and it deploys automatically.":"Fill client, time, price, location and a valid cleaner to continue."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMap && <MapModal
        onPick={p=>{setBuilding(p.name);setArea(p.area);setGps({lat:p.lat,lng:p.lng});setShowMap(false);}}
        onCoords={(lat,lng)=>{setArea(detectAreaFromCoords(lat,lng));setGps({lat,lng});setShowMap(false);}}
        onClose={()=>setShowMap(false)}/>}
      {showConfirm && <ConfirmModal
        data={{name,phone:fullPhone,date,time,materials,price:displayPrice,code,building,apt,area,notes,cleaner:chosen?.cleaner,mode:manualCleaner?"MANUAL":"AUTO"}}
        onSave={doSave} onCancel={()=>setShowConfirm(false)}/>}
    </>
  );
}

/* ---------- deployment view (sheet) ---------- */
function DeploymentView({bookings,cleaners,loading,date,setDate,highlight,onUpdate,onDelete}){
  const [editing,setEditing]=useState(null);
  const lanes=cleaners.map(cl=>({cl,jobs:bookings.filter(b=>b.cleanerId===cl.id).sort((a,b)=>a.time.startMin-b.time.startMin)}));
  const active=lanes.filter(l=>l.jobs.length>0);
  const cols=active.length?active:lanes;
  const deployed=active.length;

  return(
    <div className="board">
      <div className="board-hd">
        <div><h2>Deployment board</h2>
          <div className="stat">{bookings.length} booking{bookings.length!==1?"s":""} · {deployed} cleaner{deployed!==1?"s":""} deployed{loading?" · loading…":""} · tap any job to edit</div></div>
        <div className="board-actions">
          <button className="btn-x" disabled={bookings.length===0} onClick={()=>exportDeployment(bookings,date)}>⤓ Export Excel</button>
          <div className="date-pick"><span className="lab" style={{margin:0}}>Date</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        </div>
      </div>

      {bookings.length===0
        ? <div className="empty-board">{loading?"Loading…":<>No bookings on this date. Add one from <b>New booking</b>, or pick another date.</>}</div>
        : <>
            <div className="sheet">
              <div className="sheet-title">Deployment — {fmtSheetDate(date)}</div>
              <div className="sheet-cols">
                {cols.map(({cl,jobs})=>(
                  <div className="sheet-col" key={cl.id}>
                    <div className="col-head">{cl.name}</div>
                    {jobs.length===0
                      ? <div className="muted-cell">Available all day</div>
                      : jobs.map((j,i)=>(
                          <React.Fragment key={j.id}>
                            {i>0 && (()=>{const [c]=gapTag(jobs[i-1],{start:j.time.start,end:j.time.end,area:j.area});return <div className="sep"><span className={"sep-dot "+c}/></div>;})()}
                            <div className={"cell clickable"+(j.id===highlight?" cell-new":"")} onClick={()=>setEditing(j)} title="Tap to edit">
                              {j.id===highlight && <span className="new-tag">NEW</span>}
                              <div className="c-name">{j.clientName}</div>
                              {(j.building||j.apt) && <div className="c-addr">{[j.building,j.apt].filter(Boolean).join(", ")}</div>}
                              <div className="c-area">{j.area}</div>
                              {j.materials && <div className="c-wm">W/m</div>}
                              <div className="c-time">{compactTime(j.time.start)}-{compactTime(j.time.end)}</div>
                              {j.price!=null && j.price!=="" && <div className="c-price">({j.price}AED{j.code?"/"+j.code:""})</div>}
                            </div>
                          </React.Fragment>
                        ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="sheet-legend">
              Dot between jobs = travel check:
              <span className="ld ok"/> ok <span className="ld tight"/> tight <span className="ld conflict"/> can't reach in time
            </div>
          </>}

      {editing && <EditBookingModal booking={editing} cleaners={cleaners}
        onSave={(id,ui)=>{onUpdate(id,ui);setEditing(null);}}
        onDelete={(id)=>{onDelete(id);setEditing(null);}}
        onClose={()=>setEditing(null)}/>}
    </div>
  );
}

/* ---------- driver view ---------- */
function DriverView({bookings,date,setDate}){
  const runs=buildDriverRuns(bookings,date);
  return(
    <div className="board">
      <div className="board-hd">
        <div><h2>Driver schedule</h2>
          <div className="stat">{runs.length} event{runs.length!==1?"s":""} · drop 30 min before start, collect at end · tap Waze to navigate</div></div>
        <div className="board-actions">
          <button className="btn-x" disabled={runs.length===0} onClick={()=>exportDriver(runs,date)}>⤓ Export Excel</button>
          <div className="date-pick"><span className="lab" style={{margin:0}}>Date</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        </div>
      </div>
      {runs.length===0
        ? <div className="empty-board">No driver events on this date yet.</div>
        : <div className="drv-list">
            {runs.map((r,i)=>{
              const grouped=r.cleaners.length>1;
              const where=r.buildings.length===1?`${r.buildings[0]}, ${r.area}`:r.area;
              return(
                <div className="drv-run" key={i}>
                  <div className="drv-time num">{minToStr(r.min)}</div>
                  <span className={`drv-type ${r.type==="DROP"?"drop":"collect"}`}>{r.type}</span>
                  <div className="drv-info">
                    <div className="drv-who">{r.cleaners.join(" + ")}
                      {grouped && <span className="grp-badge">GROUPED ×{r.cleaners.length}</span>}</div>
                    <div className="drv-where">{where}</div>
                  </div>
                  {r.gps && <a className="drv-pin" href={mapsLink(r.gps)} target="_blank" rel="noopener noreferrer" title="Navigate in Waze">📍 Waze</a>}
                </div>
              );
            })}
          </div>}
    </div>
  );
}

/* ---------- map modal ---------- */
function MapModal({onPick,onCoords,onClose}){
  const [q,setQ]=useState(""); const [link,setLink]=useState(""); const [err,setErr]=useState("");
  const list=PLACES.filter(p=>(p.name+" "+p.area).toLowerCase().includes(q.toLowerCase()));
  function useLink(){const c=parseGmaps(link); if(!c){setErr("Couldn't read coordinates from that link. Paste a Google Maps URL with a pin.");return;} onCoords(c.lat,c.lng);}
  return(
    <div className="ovl" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h2>Select location</h2>
        <p className="msub">Search a saved place, paste a Maps link, or drop a demo pin.</p>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search building or area…"/>
        <div className="place-list">
          {list.map(p=><button key={p.name} className="place" onClick={()=>onPick(p)}>
            <div><div className="pn">{p.name}</div><div className="pa">{p.area}</div></div>
            <span className="pc">{p.lat.toFixed(3)},{p.lng.toFixed(3)}</span></button>)}
          {list.length===0 && <p className="sys-empty">No saved place matches “{q}”.</p>}
        </div>
        <div className="orline">or paste Google Maps link</div>
        <input value={link} onChange={e=>{setLink(e.target.value);setErr("");}} placeholder="https://maps.google.com/…@24.49,54.40…"/>
        {err && <p className="hint err">{err}</p>}
        <div className="modal-actions">
          <button className="mb-cancel" onClick={()=>onCoords(24.4979,54.4048)}>Drop demo pin</button>
          <button className="mb-ok" onClick={useLink}>Use link</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- confirm modal ---------- */
function ConfirmModal({data,onSave,onCancel}){
  const d=data;
  return(
    <div className="ovl" onClick={onCancel}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h2>Confirm booking</h2>
        <p className="msub">Quick check before it saves to the database.</p>
        <div className="confirm-grid">
          <div className="ck">Client</div><div className="cv big">{d.name}<div style={{fontWeight:400,fontSize:13,color:"var(--muted)"}} className="num">{d.phone}</div></div>
          <div className="ck">Date</div><div className="cv">{d.date||"—"}</div>
          <div className="ck">Time</div><div className="cv num">{d.time.start}–{d.time.end} · {fmtDur(d.time.minutes)}</div>
          <div className="ck">Materials</div><div className="cv">{d.materials?"With materials":"Without materials"}</div>
          <div className="ck">Location</div><div className="cv">{d.building}{d.apt?`, ${d.apt}`:""}<div style={{fontWeight:400,fontSize:13,color:"var(--muted)"}}>{d.area}</div></div>
          <div className="ck">Price</div><div className="cv num big">{d.price} AED{d.code?" / "+d.code:""}</div>
          <div className="ck">Cleaner</div><div className="cv">{d.cleaner?.name} <span className="badge go" style={{marginLeft:6}}>{d.mode}</span></div>
          {d.notes && <><div className="ck">Notes</div><div className="cv" style={{fontWeight:400,fontSize:13.5,lineHeight:1.4}}>{d.notes}</div></>}
        </div>
        <div className="modal-actions">
          <button className="mb-cancel" onClick={onCancel}>Cancel</button>
          <button className="mb-ok" onClick={onSave}>Save & deploy</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- edit booking modal ---------- */
function EditBookingModal({booking,cleaners,onSave,onDelete,onClose}){
  const b=booking;
  const [name,setName]=useState(b.clientName);
  const [timeText,setTimeText]=useState(`${b.time.start}-${b.time.end}`);
  const [materials,setMaterials]=useState(!!b.materials);
  const [price,setPrice]=useState(b.price??"");
  const [code,setCode]=useState(b.code||"O");
  const [building,setBuilding]=useState(b.building||"");
  const [apt,setApt]=useState(b.apt||"");
  const [area,setArea]=useState(b.area||"");
  const [gps,setGps]=useState(b.gps||null);
  const [cleanerId,setCleanerId]=useState(b.cleanerId);
  const [notes,setNotes]=useState(b.notes||"");
  const [showMap,setShowMap]=useState(false);
  const time=parseTimeRange(timeText);
  const cleaner=cleaners.find(c=>c.id===cleanerId);
  const valid=name.trim()&&time&&cleaner;

  function save(){
    if(!valid) return;
    onSave(b.id,{ clientName:name, phone:b.phone, date:b.date, time, materials, price, code,
      building, apt, area, gps, notes, cleanerId, cleanerName:cleaner.name });
  }
  return(
    <div className="ovl" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h2>Edit booking</h2>
        <p className="msub">Update any detail and save. Changes sync to the database.</p>
        <div className="field"><label className="lab">Client name</label>
          <input value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><label className="lab">Time</label>
          <input value={timeText} onChange={e=>setTimeText(e.target.value)} placeholder="9-12 or 15:00-17:00"/>
          {time
            ? <div className="time-parsed"><span className="chip num">{time.start}–{time.end}</span><span className="chip dur num">{fmtDur(time.minutes)}</span></div>
            : <p className="hint err">Enter a valid range like 9-12.</p>}</div>
        <div className="field"><label className="lab">Cleaner</label>
          <select value={cleanerId||""} onChange={e=>setCleanerId(e.target.value)}>
            {cleaners.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="row2">
          <div className="field"><label className="lab">Materials</label>
            <div className="toggle">
              <button className={materials?"on":""} onClick={()=>setMaterials(true)}>With</button>
              <button className={!materials?"on":""} onClick={()=>setMaterials(false)}>Without</button>
            </div></div>
          <div className="field"><label className="lab">Price (AED)</label>
            <div className="price-in"><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value)}/><span className="aed">AED</span></div></div>
        </div>
        <div className="field"><label className="lab">Payment</label>
          <div className="toggle">
            <button className={code==="O"?"on":""} onClick={()=>setCode("O")}>Online (O)</button>
            <button className={code==="C"?"on":""} onClick={()=>setCode("C")}>Cash (C)</button>
          </div></div>
        <div className="row2">
          <div className="field"><label className="lab">Building</label>
            <input value={building} onChange={e=>setBuilding(e.target.value)}/></div>
          <div className="field"><label className="lab">Apt / villa / office</label>
            <input value={apt} onChange={e=>setApt(e.target.value)}/></div>
        </div>
        <div className="field"><label className="lab">Area</label>
          <select value={area} onChange={e=>setArea(e.target.value)}>
            <option value="">—</option>
            {AREAS.map(a=><option key={a} value={a}>{a}</option>)}
          </select></div>
        <div className="field">
          {gps
            ? <div className="loc-btn set"><div className="loc-set" style={{width:"100%"}}>
                <div><div style={{fontWeight:600}}>📍 Location set</div><div className="co num">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</div></div>
                <button className="re" onClick={()=>setShowMap(true)}>Change</button></div></div>
            : <button className="loc-btn" onClick={()=>setShowMap(true)}><span>📍 Set location</span><span>›</span></button>}
        </div>
        <div className="field"><label className="lab">Notes</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></div>
        <div className="edit-actions">
          <button className="del" onClick={()=>{ if(confirm("Cancel this booking? It will be removed from the board (kept in history).")) onDelete(b.id); }}>Delete</button>
          <button className="mb-cancel grow" onClick={onClose}>Cancel</button>
          <button className="mb-ok grow" style={{opacity:valid?1:.5}} disabled={!valid} onClick={save}>Save</button>
        </div>
      </div>
      {showMap && <MapModal
        onPick={p=>{setBuilding(p.name);setArea(p.area);setGps({lat:p.lat,lng:p.lng});setShowMap(false);}}
        onCoords={(lat,lng)=>{setArea(detectAreaFromCoords(lat,lng));setGps({lat,lng});setShowMap(false);}}
        onClose={()=>setShowMap(false)}/>}
    </div>
  );
}

/* ============================================================
   AUTH GATE
   ============================================================ */
const authWrap={minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#eef1f0",fontFamily:"'Inter',system-ui,sans-serif",padding:"20px"};
const authCard={background:"#fff",border:"1px solid #d9e0dd",borderRadius:"16px",padding:"28px",width:"100%",maxWidth:"380px",boxShadow:"0 6px 30px rgba(20,32,28,.08)"};
const authInput={width:"100%",fontSize:"15px",padding:"11px 12px",border:"1.5px solid #d9e0dd",borderRadius:"9px",outline:"none",marginTop:"6px",boxSizing:"border-box"};
const authBtn={width:"100%",fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:600,fontSize:"15px",padding:"13px",borderRadius:"11px",border:"none",background:"#0e7c5a",color:"#fff",cursor:"pointer",marginTop:"16px"};

function ConfigMissing(){
  return(<div style={authWrap}><div style={authCard}>
    <h2 style={{fontFamily:"'Space Grotesk',sans-serif",margin:"0 0 8px"}}>Not connected yet</h2>
    <p style={{color:"#64726d",fontSize:"14px",lineHeight:1.5,margin:0}}>Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> in Vercel → Settings → Environment Variables, then redeploy.</p>
  </div></div>);
}
function Login(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e){ e.preventDefault(); setErr(""); setBusy(true);
    const { error }=await supabase.auth.signInWithPassword({ email:email.trim(), password });
    setBusy(false); if(error) setErr(error.message); }
  return(<div style={authWrap}><form style={authCard} onSubmit={submit}>
    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,color:"#0e7c5a",fontSize:"13px",letterSpacing:".02em"}}>AR CLEANING · Dispatch</div>
    <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,margin:"6px 0 18px",fontSize:"20px"}}>Staff sign in</h2>
    <label style={{fontSize:"12.5px",fontWeight:500,color:"#64726d"}}>Email
      <input style={authInput} type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label>
    <label style={{fontSize:"12.5px",fontWeight:500,color:"#64726d",display:"block",marginTop:"12px"}}>Password
      <input style={authInput} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
    {err && <p style={{color:"#c33a2e",fontSize:"13px",marginTop:"12px",marginBottom:0}}>{err}</p>}
    <button style={{...authBtn,opacity:busy?.6:1}} disabled={busy} type="submit">{busy?"Signing in…":"Sign in"}</button>
  </form></div>);
}
function AuthBar({email}){
  const bar={display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",padding:"8px 18px",background:"#14201c",color:"#cfe0d9",fontFamily:"'Inter',sans-serif",fontSize:"12.5px"};
  const dot={width:"8px",height:"8px",borderRadius:"50%",background:"#3ad29f",display:"inline-block"};
  return(<div style={bar}>
    <span style={{display:"inline-flex",alignItems:"center",gap:"7px"}}><span style={dot}/>Live · Supabase</span>
    <span style={{marginLeft:"auto",opacity:.8}}>{email}</span>
    <button onClick={()=>supabase.auth.signOut()} style={{background:"none",border:"1px solid #3a4a44",color:"#cfe0d9",borderRadius:"7px",padding:"4px 10px",cursor:"pointer",fontSize:"12px"}}>Sign out</button>
  </div>);
}
export default function App(){
  const [session,setSession]=useState(undefined);
  useEffect(()=>{
    if(!supabase){ setSession(null); return; }
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const { data:sub }=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>sub.subscription.unsubscribe();
  },[]);
  if(!supabase) return <ConfigMissing/>;
  if(session===undefined) return <div style={authWrap}><div style={{color:"#64726d"}}>Loading…</div></div>;
  if(!session) return <Login/>;
  return <><AuthBar email={session.user?.email}/><Dispatch/></>;
}
