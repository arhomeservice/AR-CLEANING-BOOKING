import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient.js";

/* ============================================================
   AR Cleaning — Dispatch prototype (mock data, no backend)
   Three linked views sharing one live set of bookings:
     • New booking   — staff enter client, system assigns
     • Deployment    — per-cleaner day board with travel-gap checks
     • Driver schedule — auto drop/collect events, grouped by area
   Every saved booking is aware of the ones already placed.
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
:root{
  --ink:#14201c; --canvas:#eef1f0; --surface:#ffffff;
  --go:#0e7c5a; --go-soft:#e3f2ec;
  --tight:#b7791f; --tight-soft:#f6ecd7;
  --conflict:#c33a2e; --conflict-soft:#f7e3e1;
  --blue:#3452b4; --blue-soft:#e7ecfb;
  --muted:#64726d; --line:#d9e0dd; --line-2:#eaeeec;
  --sheet-green:#3aab4c; --sheet-tan:#f6e2a6;
  --disp:'Space Grotesk',system-ui,sans-serif; --body:'Inter',system-ui,sans-serif;
}
*{box-sizing:border-box}
.ar-root{font-family:var(--body);color:var(--ink);background:var(--canvas);min-height:100vh;-webkit-font-smoothing:antialiased}
.num{font-family:var(--disp);font-feature-settings:"tnum" 1;font-variant-numeric:tabular-nums}

.ar-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  padding:18px 22px 14px;background:var(--surface);flex-wrap:wrap}
.ar-head h1{font-family:var(--disp);font-weight:600;font-size:20px;margin:0;letter-spacing:-.01em}
.ar-head .sub{color:var(--muted);font-size:13px}
.ar-brand{font-family:var(--disp);font-weight:600;font-size:13px;color:var(--go);letter-spacing:.02em}

.nav{display:flex;gap:2px;padding:0 18px;background:var(--surface);border-bottom:1px solid var(--line)}
@media(max-width:860px){.nav{padding:0 8px;overflow-x:auto}}
.nav button{font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--muted);background:none;border:none;
  padding:13px 16px;cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;transition:color .12s}
.nav button.on{color:var(--go);border-bottom-color:var(--go)}
.nav .count{font-family:var(--disp);font-size:11px;background:var(--line-2);color:var(--muted);border-radius:20px;padding:1px 7px;margin-left:6px}
.nav button.on .count{background:var(--go-soft);color:var(--go)}

.banner{max-width:1040px;margin:16px auto 0;padding:0 22px}
.banner-in{display:flex;align-items:center;gap:12px;background:var(--go-soft);border:1px solid #bfe0d1;border-radius:12px;padding:13px 16px}
.banner-in .bc{width:26px;height:26px;border-radius:50%;background:var(--go);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto}
.banner-in .bt{font-size:14px;font-weight:600;color:var(--ink)}
.banner-in .bt span{font-weight:400;color:var(--muted)}
.banner-in .bx{margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px;line-height:1}

.ar-wrap{max-width:1040px;margin:0 auto;padding:22px;display:grid;grid-template-columns:1fr 380px;gap:22px;align-items:start}
@media(max-width:860px){.ar-wrap{grid-template-columns:1fr;padding:16px;gap:16px}}

.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px}
.card + .card{margin-top:16px}
.sec-title{font-family:var(--disp);font-weight:600;font-size:12px;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;margin:0 0 14px}

.field{margin-bottom:13px}.field:last-child{margin-bottom:0}
.lab{display:block;font-size:12.5px;font-weight:500;color:var(--muted);margin-bottom:5px}
.lab .req{color:var(--conflict)}
input,select,textarea{width:100%;font-family:var(--body);font-size:15px;color:var(--ink);background:var(--surface);
  border:1.5px solid var(--line);border-radius:9px;padding:11px 12px;outline:none;transition:border-color .12s}
input:focus,select:focus,textarea:focus{border-color:var(--go)}
textarea{resize:vertical;min-height:56px;line-height:1.45}
input::placeholder,textarea::placeholder{color:#9aa8a2}
.hint{font-size:12px;color:var(--muted);margin-top:5px}.hint.err{color:var(--conflict)}
.phone-row{display:flex;gap:8px}.phone-cc{flex:0 0 78px}
.phone-cc input{text-align:center;font-family:var(--disp);color:var(--muted)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:520px){.row2{grid-template-columns:1fr}}

.time-parsed{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
.chip{font-family:var(--disp);font-weight:600;font-size:14px;background:var(--go-soft);color:var(--go);border-radius:8px;padding:6px 11px}
.chip.dur{background:var(--line-2);color:var(--ink)}
.toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.toggle button{font-family:var(--body);font-weight:600;font-size:14px;padding:12px;border-radius:10px;border:1.5px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;transition:all .12s}
.toggle button.on{border-color:var(--go);background:var(--go-soft);color:var(--go)}
.price-in{position:relative}
.price-in .aed{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-family:var(--disp);font-weight:600;color:var(--muted);font-size:14px;pointer-events:none}
.price-in input{padding-right:52px;font-family:var(--disp);font-weight:600;font-size:16px}
.suggest{display:inline-flex;align-items:center;gap:8px;margin-top:7px;font-size:12.5px;color:var(--muted)}
.suggest button{font-family:var(--body);font-size:12px;font-weight:600;color:var(--go);background:var(--go-soft);border:none;border-radius:7px;padding:4px 9px;cursor:pointer}

.loc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:var(--body);font-weight:600;font-size:14px;padding:13px 14px;border-radius:10px;border:1.5px dashed var(--line);background:var(--surface);color:var(--go);cursor:pointer;transition:all .12s}
.loc-btn:hover{border-color:var(--go)}
.loc-btn.set{border-style:solid;border-color:var(--go);background:var(--go-soft)}
.loc-set{display:flex;align-items:flex-start;gap:10px;justify-content:space-between}
.loc-set .co{font-family:var(--disp);font-size:11.5px;color:var(--muted);margin-top:3px}
.loc-set .re{font-size:12px;font-weight:600;color:var(--go);background:none;border:none;cursor:pointer;padding:0}
.loc-required{margin-top:8px;font-size:12.5px;font-weight:600;color:var(--conflict);background:var(--conflict-soft);padding:8px 11px;border-radius:8px}

.sys{position:sticky;top:22px}
@media(max-width:860px){.sys{position:static}}
.sys-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.sys-hd{padding:14px 18px;border-bottom:1px solid var(--line-2);display:flex;align-items:center;gap:8px}
.sys-hd .dot{width:8px;height:8px;border-radius:50%;background:var(--go)}
.sys-hd h3{font-family:var(--disp);font-weight:600;font-size:13px;margin:0;letter-spacing:.02em}
.sys-body{padding:16px 18px}
.sys-empty{color:var(--muted);font-size:13.5px;line-height:1.5}
.blk{padding:13px 0;border-bottom:1px solid var(--line-2)}.blk:first-child{padding-top:0}.blk:last-child{border-bottom:none;padding-bottom:0}
.blk-lab{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:7px}
.cf-top{display:flex;align-items:center;gap:8px;margin-bottom:9px}
.badge{font-family:var(--disp);font-size:10.5px;font-weight:600;letter-spacing:.04em;padding:3px 8px;border-radius:6px}
.badge.go{background:var(--go-soft);color:var(--go)}
.badge.reg{background:var(--blue-soft);color:var(--blue)}
.cf-name{font-family:var(--disp);font-weight:600;font-size:16px}
.cf-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px;margin:4px 0 12px}
.cf-grid .k{font-size:11px;color:var(--muted)}.cf-grid .v{font-size:13.5px;font-weight:600}.cf-grid .v.num{font-size:14px}
.mini-btn{width:100%;font-family:var(--body);font-weight:600;font-size:13px;padding:10px;border-radius:9px;border:none;cursor:pointer;transition:filter .12s}
.mini-btn:hover{filter:brightness(.96)}
.mini-btn.pri{background:var(--go);color:#fff}
.mini-btn.ghost{background:none;border:1.5px solid var(--line);color:var(--go)}
.match{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--go);background:var(--go-soft);padding:8px 11px;border-radius:8px;margin-top:10px}
.area-det{display:flex;align-items:center;gap:8px}.area-det .an{font-family:var(--disp);font-weight:600;font-size:15px}
.aa-mode{font-family:var(--disp);font-size:10.5px;font-weight:600;letter-spacing:.05em;padding:3px 8px;border-radius:6px;background:var(--go-soft);color:var(--go)}
.aa-name{font-family:var(--disp);font-weight:700;font-size:26px;letter-spacing:-.01em;margin:8px 0 10px}
.reasons{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.reasons li{display:flex;align-items:center;gap:8px;font-size:13px}
.reasons li .tk{color:var(--go);font-weight:700;flex:0 0 auto}
.change-sel{margin-top:12px}.change-sel .lab{margin-bottom:6px}
.conflict-box{background:var(--conflict-soft);border-radius:10px;padding:13px}
.conflict-box .ch{display:flex;align-items:center;gap:7px;font-family:var(--disp);font-weight:600;font-size:13px;color:var(--conflict);margin-bottom:8px}
.conflict-box ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.conflict-box li{font-size:12.5px}.conflict-box li b{font-weight:600}
.save-wrap{margin-top:16px}
.save-btn{width:100%;font-family:var(--disp);font-weight:600;font-size:16px;padding:15px;border-radius:12px;border:none;background:var(--go);color:#fff;cursor:pointer;letter-spacing:.01em;transition:filter .12s}
.save-btn:hover{filter:brightness(.96)}
.save-btn:disabled{background:var(--line);color:#9aa8a2;cursor:not-allowed}
.save-note{text-align:center;font-size:12px;color:var(--muted);margin-top:8px}

.ovl{position:fixed;inset:0;background:rgba(20,32,28,.5);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
.modal{background:var(--surface);border-radius:16px;width:100%;max-width:440px;max-height:90vh;overflow:auto;padding:22px}
.modal h2{font-family:var(--disp);font-weight:600;font-size:18px;margin:0 0 4px}
.modal .msub{color:var(--muted);font-size:13px;margin:0 0 16px}
.place-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.place{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;border:1.5px solid var(--line);border-radius:10px;padding:11px 13px;background:var(--surface);cursor:pointer;transition:border-color .12s}
.place:hover{border-color:var(--go)}
.place .pn{font-weight:600;font-size:14px}.place .pa{font-size:12px;color:var(--muted)}.place .pc{font-family:var(--disp);font-size:11px;color:var(--muted)}
.orline{display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--muted);font-size:12px}
.orline::before,.orline::after{content:"";height:1px;background:var(--line);flex:1}
.modal-actions{display:flex;gap:10px;margin-top:18px}
.modal-actions button{flex:1;font-family:var(--body);font-weight:600;font-size:14px;padding:12px;border-radius:10px;cursor:pointer;border:none}
.mb-cancel{background:var(--line-2);color:var(--ink)}.mb-ok{background:var(--go);color:#fff}
.confirm-grid{display:grid;grid-template-columns:auto 1fr;gap:11px 16px;margin:6px 0 4px}
.confirm-grid .ck{font-size:12px;color:var(--muted);align-self:center}
.confirm-grid .cv{font-weight:600;font-size:14.5px}.confirm-grid .cv.num{font-family:var(--disp)}.confirm-grid .cv.big{font-size:16px}

/* board / deployment / driver */
.board{max-width:1040px;margin:0 auto;padding:22px}
@media(max-width:860px){.board{padding:16px}}
.board-hd{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.board-hd h2{font-family:var(--disp);font-weight:600;font-size:19px;margin:0}
.board-hd .stat{color:var(--muted);font-size:13px;margin-top:3px}
.date-pick{display:flex;align-items:center;gap:8px}.date-pick input{width:auto}
.dep-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:760px){.dep-grid{grid-template-columns:1fr}}
.dep-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;transition:box-shadow .2s}
.dep-card.idle{opacity:.72}
.dep-card.hl{box-shadow:0 0 0 2px var(--go)}
.dep-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.dep-name{font-family:var(--disp);font-weight:600;font-size:16px}
.dep-jobs{font-size:12px;color:var(--muted)}
.dep-idle{font-size:13px;color:var(--muted);padding:4px 0}
.timeline{display:flex;flex-direction:column}
.tl-row{display:flex;gap:12px;align-items:stretch}
.tl-time{font-family:var(--disp);font-size:12.5px;color:var(--muted);flex:0 0 96px;padding-top:12px}
.tl-body{flex:1;border-left:2px solid var(--line);padding:12px 0 12px 14px;position:relative}
.tl-body::before{content:"";position:absolute;left:-6px;top:16px;width:10px;height:10px;border-radius:50%;background:var(--go)}
.tl-body.drv::before{background:var(--muted)}
.tl-body.new-hl{background:var(--go-soft);border-radius:0 8px 8px 0;margin-left:-2px;padding-left:16px;border-left:3px solid var(--go)}
.tl-title{font-weight:600;font-size:14px;display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.tl-meta{font-size:12.5px;color:var(--muted);margin-top:2px}
.gap{display:inline-flex;align-items:center;gap:5px;font-family:var(--disp);font-size:11px;font-weight:600;padding:2px 7px;border-radius:5px}
.gap.ok{background:var(--go-soft);color:var(--go)}.gap.tight{background:var(--tight-soft);color:var(--tight)}.gap.conflict{background:var(--conflict-soft);color:var(--conflict)}
.drv-list{display:flex;flex-direction:column;gap:10px}
.drv-run{display:flex;gap:14px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.drv-time{font-family:var(--disp);font-weight:600;font-size:15px;flex:0 0 60px;padding-top:1px}
.drv-type{font-family:var(--disp);font-size:10.5px;font-weight:700;letter-spacing:.05em;padding:3px 9px;border-radius:6px;flex:0 0 auto;align-self:flex-start;margin-top:1px}
.drv-type.drop{background:var(--blue-soft);color:var(--blue)}
.drv-type.collect{background:var(--tight-soft);color:var(--tight)}
.drv-info{flex:1}
.drv-who{font-weight:600;font-size:14px}
.drv-where{font-size:12.5px;color:var(--muted);margin-top:2px}
.grp-badge{font-family:var(--disp);font-size:10px;font-weight:600;color:var(--go);background:var(--go-soft);border-radius:5px;padding:2px 7px;margin-left:8px}
.empty-board{text-align:center;color:var(--muted);padding:50px 20px;font-size:14px;background:var(--surface);border:1px dashed var(--line);border-radius:14px}
.steps{list-style:none;margin:0;padding:0}
.steps li{display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid var(--line-2);font-size:13.5px}
.steps li:last-child{border-bottom:none}
.steps .s-tk{width:19px;height:19px;border-radius:50%;background:var(--go);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;flex:0 0 auto}
.demo-note{max-width:1040px;margin:0 auto;padding:0 22px 26px;color:var(--muted);font-size:12px;line-height:1.6}
.demo-note b{color:var(--ink)}.demo-note code{font-family:var(--disp);background:var(--line-2);padding:1px 6px;border-radius:5px;font-size:11.5px}
.sheet{border:2px solid var(--sheet-green);border-radius:8px;overflow-x:auto}
.sheet-title{background:var(--sheet-green);color:#fff;font-family:var(--disp);font-weight:600;font-size:16px;text-align:center;padding:9px 12px}
.sheet-cols{display:flex;min-width:min-content}
.sheet-col{flex:1 0 150px;min-width:150px;border-right:1px solid var(--line);display:flex;flex-direction:column}
.sheet-col:last-child{border-right:none}
.col-head{background:var(--sheet-tan);font-family:var(--disp);font-weight:600;font-size:14px;text-align:center;padding:8px 6px;border-bottom:1px solid var(--line)}
.cell{padding:12px 10px 13px;text-align:center;border-bottom:1px solid var(--line);position:relative;line-height:1.35}
.cell:last-child{border-bottom:none}
.c-name{font-weight:600;font-size:13.5px;margin-bottom:3px}
.c-addr{color:var(--muted);font-size:12px}
.c-area{color:var(--muted);font-size:12px;margin-bottom:5px}
.c-wm{color:var(--conflict);font-weight:600;font-size:12.5px}
.c-time{font-family:var(--disp);font-weight:600;font-size:14px;margin-top:2px}
.c-price{color:var(--conflict);font-family:var(--disp);font-weight:600;font-size:13px;margin-top:2px}
.cell-new{background:var(--go-soft)}
.cell-new::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 2px var(--go);pointer-events:none}
.new-tag{position:absolute;top:5px;right:5px;font-family:var(--disp);font-size:9px;font-weight:700;color:#fff;background:var(--go);border-radius:4px;padding:1px 5px;letter-spacing:.04em;z-index:2}
.muted-cell{color:var(--muted);font-size:12.5px;padding:16px 8px;text-align:center}
.sep{height:0;position:relative;overflow:visible;z-index:3}
.sep-dot{position:absolute;left:50%;top:-6px;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;border:2px solid var(--surface)}
.sep-dot.ok{background:var(--go)}.sep-dot.tight{background:var(--tight)}.sep-dot.conflict{background:var(--conflict)}
.sheet-legend{margin-top:12px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sheet-legend .ld{width:10px;height:10px;border-radius:50%;display:inline-block}
.sheet-legend .ld.ok{background:var(--go)}.sheet-legend .ld.tight{background:var(--tight)}.sheet-legend .ld.conflict{background:var(--conflict)}
.board-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.btn-x{font-family:var(--body);font-weight:600;font-size:13px;padding:9px 14px;border-radius:9px;border:1.5px solid var(--go);background:var(--surface);color:var(--go);cursor:pointer;transition:all .12s}
.btn-x:hover{background:var(--go-soft)}
.btn-x:disabled{border-color:var(--line);color:#9aa8a2;cursor:not-allowed;background:var(--surface)}
.cell.clickable{cursor:pointer;transition:background .1s}
.cell.clickable:hover{background:var(--line-2)}
.cell.clickable.cell-new:hover{background:#d6ecdf}
.drv-pin{flex:0 0 auto;align-self:center;font-family:var(--disp);font-weight:600;font-size:12.5px;text-decoration:none;color:var(--blue);background:var(--blue-soft);border-radius:8px;padding:8px 12px;white-space:nowrap}
.drv-pin:hover{filter:brightness(.96)}
.edit-actions{display:flex;gap:10px;margin-top:18px}
.edit-actions .del{flex:0 0 auto;background:var(--conflict-soft);color:var(--conflict);border:none;font-weight:600;font-family:var(--body);font-size:14px;padding:12px 14px;border-radius:10px;cursor:pointer}
.edit-actions .grow{flex:1}
`;

/* ---------------- mock data ---------------- */
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
const CLIENTS = {
  "+971501234567":{ name:"Sarah Ahmed", bookings:12, last:"Tue 26 Aug 2026", regular:true,
    prefCleaner:"Leah", usualDay:"Tuesday", usualTime:"09:00–12:00", usualMaterials:true,
    usual:{ building:"Bel Ghailam Tower", apt:"705", area:"Corniche", lat:24.4761, lng:54.3389, timeText:"09:00-12:00" }},
  "+971559876543":{ name:"Omar Khan", bookings:3, last:"Thu 14 Aug 2026", regular:false,
    prefCleaner:null, usualDay:null, usualTime:null, usualMaterials:false,
    usual:{ building:"Bateen Park Residence", apt:"12", area:"Al Bateen", lat:24.4548, lng:54.3312, timeText:"10:00-13:00" }},
};
const CLEANERS = [
  {id:"c1", name:"Leah",     worked:["+971501234567"], seed:[{start:"06:30",end:"08:30",area:"Reem Island",client:"Aisha"}]},
  {id:"c2", name:"Roseline", worked:[], seed:[]},
  {id:"c3", name:"Zaynab",   worked:[], seed:[{start:"09:00",end:"12:00",area:"Al Bateen",client:"Reem"}]},
  {id:"c4", name:"Eva",      worked:[], seed:[]},
  {id:"c5", name:"Colline",  worked:[], seed:[{start:"13:00",end:"16:00",area:"Yas Island",client:"John"}]},
  {id:"c6", name:"Sara",     worked:[], seed:[]},
  {id:"c7", name:"Angel",    worked:[], seed:[]},
  {id:"c8", name:"Razelle",  worked:[], seed:[]},
];
const RATE_PER_HOUR = 40, MATERIALS_FEE = 20;
const TODAY = new Date().toISOString().slice(0,10);

/* ---------------- helpers ---------------- */
const toMin=(t)=>{const [h,m]=t.split(":").map(Number);return h*60+m;};
const minToStr=(mins)=>`${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
const fmtDur=(mins)=>{const h=Math.floor(mins/60),m=mins%60; return m?`${h}h ${m}m`:`${h}h`;};

function parseTimeRange(raw){
  if(!raw) return null;
  let s = raw.toLowerCase().trim().replace(/\s+/g,"").replace(/to|–|—|~|\.\.|until/g,"-");
  if(!s.includes("-")) return null;
  const [aRaw,bRaw] = s.split("-");
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
// each cleaner's jobs for a date, drawn from the shared bookings list
function scheduleFor(cleanerId, date, bookings){
  return bookings.filter(b=>b.cleanerId===cleanerId && b.date===date)
    .map(b=>({start:b.time.start,end:b.time.end,area:b.area,client:b.clientName}))
    .sort((a,b)=>toMin(a.start)-toMin(b.start));
}
function gapTag(prev,cur){
  const need=travelMin(prev.area,cur.area), gap=toMin(cur.start)-toMin(prev.end);
  if(gap<need) return ["conflict",`can't reach · needs ${need}m, ${gap}m`];
  if(gap-need<15) return ["tight",`tight · ${gap}m gap`];
  return ["ok",`ok · ${gap}m gap`];
}

/* ---------------- assignment engine ---------------- */
function evaluateCleaners({time,area,clientPhone}, bookings, date){
  if(!time||!area) return null;
  const jS=time.startMin,jE=time.endMin;
  const results=CLEANERS.map((cl)=>{
    const bks=scheduleFor(cl.id,date,bookings);
    const overlap=bks.find(b=>toMin(b.start)<jE&&toMin(b.end)>jS);
    if(overlap) return {cleaner:cl,ok:false,reason:`Already booked ${overlap.start}–${overlap.end} (${overlap.client})`};
    const before=bks.filter(b=>toMin(b.end)<=jS).sort((a,b)=>toMin(b.end)-toMin(a.end))[0];
    const after =bks.filter(b=>toMin(b.start)>=jE).sort((a,b)=>toMin(a.start)-toMin(b.start))[0];
    if(before){const need=travelMin(before.area,area),gap=jS-toMin(before.end);
      if(gap<need) return {cleaner:cl,ok:false,reason:`Can't travel from ${before.area} in time — needs ${need}m, only ${gap}m after ${before.end}`};}
    if(after){const need=travelMin(area,after.area),gap=toMin(after.start)-jE;
      if(gap<need) return {cleaner:cl,ok:false,reason:`Next job (${after.area} ${after.start}) becomes impossible — needs ${need}m, only ${gap}m`};}
    let score=0;const reasons=["Available","No booking conflict"];
    const preferred=clientPhone&&CLIENTS[clientPhone]?.prefCleaner===cl.name;
    const worked=clientPhone&&cl.worked.includes(clientPhone);
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

/* build grouped driver runs for a date */
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
const mapsLink=(gps)=>gps?`https://waze.com/ul?ll=${gps.lat},${gps.lng}&navigate=yes`:"";

/* ---------------- Excel export ---------------- */
function exportDeployment(dayBookings,date){
  const rows=dayBookings.slice()
    .sort((a,b)=>a.cleanerName.localeCompare(b.cleanerName)||a.time.startMin-b.time.startMin)
    .map(b=>({Cleaner:b.cleanerName, Client:b.clientName, Building:b.building||"", "Apt/Villa":b.apt||"",
      Area:b.area, Start:b.time.start, End:b.time.end, Duration:fmtDur(b.time.minutes),
      Materials:b.materials?"W/m":"", Price:b.price??"", Code:b.code||"", Notes:b.notes||"",
      "Map link":mapsLink(b.gps)}));
  const ws=XLSX.utils.json_to_sheet(rows);
  rows.forEach((r,i)=>{ if(r["Map link"]){ const a=XLSX.utils.encode_cell({c:12,r:i+1}); if(ws[a]) ws[a].l={Target:r["Map link"],Tooltip:"Open in Waze"}; }});
  ws["!cols"]=[{wch:10},{wch:20},{wch:20},{wch:9},{wch:14},{wch:7},{wch:7},{wch:8},{wch:9},{wch:8},{wch:6},{wch:24},{wch:16}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Deployment");
  XLSX.writeFile(wb,`Deployment_${date}.xlsx`);
}
function exportDriver(runs,date){
  const rows=runs.map(r=>({Time:minToStr(r.min), Type:r.type, Cleaners:r.cleaners.join(" + "),
    Location:r.buildings.length?r.buildings.join(" / "):r.area, Area:r.area, "Map link":mapsLink(r.gps)}));
  const ws=XLSX.utils.json_to_sheet(rows);
  rows.forEach((r,i)=>{ if(r["Map link"]){ const a=XLSX.utils.encode_cell({c:5,r:i+1}); if(ws[a]) ws[a].l={Target:r["Map link"],Tooltip:"Open in Waze"}; }});
  ws["!cols"]=[{wch:8},{wch:9},{wch:22},{wch:26},{wch:14},{wch:16}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Driver schedule");
  XLSX.writeFile(wb,`Driver_${date}.xlsx`);
}

/* seed the shared bookings from cleaner base schedules */
function seedBookings(){
  const out=[];
  CLEANERS.forEach(cl=>cl.seed.forEach((b,i)=>out.push({
    id:`seed-${cl.id}-${i}`, clientName:b.client, phone:"", date:TODAY,
    time:{start:b.start,end:b.end,startMin:toMin(b.start),endMin:toMin(b.end),minutes:toMin(b.end)-toMin(b.start)},
    area:b.area, building:"", apt:"", materials:false, price:null, notes:"",
    gps:AREA_COORDS[b.area]?{lat:AREA_COORDS[b.area][0],lng:AREA_COORDS[b.area][1]}:null,
    cleanerId:cl.id, cleanerName:cl.name, mode:"AUTO", code:"O", seed:true,
  })));
  return out;
}

/* ============================================================ */
function Dispatch(){
  const [bookings,setBookings]=useState(seedBookings);
  const [view,setView]=useState("new");
  const [boardDate,setBoardDate]=useState(TODAY);
  const [highlight,setHighlight]=useState(null);
  const [banner,setBanner]=useState(null);

  function handleSave(bk){
    setBookings(prev=>[...prev,bk]);
    setBoardDate(bk.date);
    setHighlight(bk.id);
    setBanner({name:bk.clientName, cleaner:bk.cleanerName, time:`${bk.time.start}–${bk.time.end}`, area:bk.area});
    setView("deployment");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function updateBooking(id,changes){ setBookings(prev=>prev.map(b=>b.id===id?{...b,...changes}:b)); }
  function deleteBooking(id){ setBookings(prev=>prev.filter(b=>b.id!==id)); }

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
          Deployment<span className="count">{bookings.filter(b=>b.date===boardDate).length}</span>
        </button>
        <button className={view==="driver"?"on":""} onClick={()=>setView("driver")}>
          Driver schedule<span className="count">{buildDriverRuns(bookings,boardDate).length}</span>
        </button>
      </nav>

      {banner && view!=="new" &&
        <div className="banner"><div className="banner-in">
          <span className="bc">✓</span>
          <span className="bt">Booking saved & deployed — {banner.name} <span>· {banner.time} · {banner.cleaner} · {banner.area}</span></span>
          <button className="bx" onClick={()=>setBanner(null)}>×</button>
        </div></div>}

      {view==="new" &&
        <BookingForm bookings={bookings} onSave={handleSave}/>}
      {view==="deployment" &&
        <DeploymentView bookings={bookings} date={boardDate} setDate={d=>{setBoardDate(d);setHighlight(null);}} highlight={highlight} onUpdate={updateBooking} onDelete={deleteBooking}/>}
      {view==="driver" &&
        <DriverView bookings={bookings} date={boardDate} setDate={setBoardDate}/>}
    </div>
  );
}

/* ---------------- booking form ---------------- */
function BookingForm({bookings,onSave}){
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
  const [notes,setNotes]=useState("");
  const [code,setCode]=useState("O");
  const [building,setBuilding]=useState("");
  const [apt,setApt]=useState("");
  const [area,setArea]=useState("");
  const [gps,setGps]=useState(null);
  const [showMap,setShowMap]=useState(false);
  const [override,setOverride]=useState(false);
  const [manualCleaner,setManualCleaner]=useState(null);
  const [showConfirm,setShowConfirm]=useState(false);

  const fullPhone=cc+phone.replace(/\D/g,"");
  const time=useMemo(()=>parseTimeRange(timeText),[timeText]);

  useEffect(()=>{
    const digits=phone.replace(/\D/g,"");
    if(cc==="+971"&&digits.length>=9){const key="+971"+digits;setExisting(CLIENTS[key]?{...CLIENTS[key],key}:null);}
    else setExisting(null);
    setUsedExisting(false);
  },[phone,cc]);

  const suggested=useMemo(()=>time?Math.round(time.minutes/60*RATE_PER_HOUR+(materials?MATERIALS_FEE:0)):null,[time,materials]);
  const assessment=useMemo(
    ()=>evaluateCleaners({time,area,clientPhone:usedExisting?existing?.key:fullPhone}, bookings, date),
    [time,area,usedExisting,existing,fullPhone,bookings,date]);
  const autoPick=assessment?.eligible?.[0]||null;
  const chosen=manualCleaner?assessment?.all.find(r=>r.cleaner.id===manualCleaner):autoPick;
  const usualMatch=usedExisting&&existing?.usualTime&&time&&existing.usualTime.replace("–","-")===`${time.start}-${time.end}`;

  function rebook(){
    if(!existing) return;
    const u=existing.usual;
    setName(existing.name);setUsedExisting(true);setTimeText(u.timeText);setMaterials(existing.usualMaterials);
    setBuilding(u.building);setApt(u.apt);setArea(u.area);setGps({lat:u.lat,lng:u.lng});
    setPriceTouched(false);setPrice("");setManualCleaner(null);
    setTimeout(()=>document.getElementById("bk-date")?.focus(),50);
  }
  const displayPrice=priceTouched?price:(price||"");
  const locMissing=building&&!gps;
  const canSave=name.trim()&&phone.replace(/\D/g,"").length>=9&&time&&displayPrice&&area&&(gps||override)&&chosen&&chosen.ok;

  function doSave(){
    onSave({
      id:`bk-${Date.now()}`, clientName:name, phone:fullPhone, date,
      time, materials, price:displayPrice, code, building, apt, area, gps, notes,
      cleanerId:chosen.cleaner.id, cleanerName:chosen.cleaner.name, mode:manualCleaner?"MANUAL":"AUTO",
    });
    setShowConfirm(false);
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
              <p className="hint">Try <b>50 123 4567</b> (known client) or any new number.</p>
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
              <label className="lab">Job code</label>
              <select value={code} onChange={e=>setCode(e.target.value)}>
                <option value="O">O</option>
                <option value="C">C</option>
              </select>
              <p className="hint">Shown on the sheet as (price AED/{code}). Tell me what O and C mean and I'll label it clearly.</p>
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
                <p className="sys-empty">As you enter the client, matches, area detection and cleaner assignment appear here automatically — and the booking flows straight into Deployment and the Driver schedule.</p>}

              {existing &&
                <div className="blk">
                  <div className="cf-top"><span className="badge go">CLIENT FOUND</span>{existing.regular&&<span className="badge reg">REGULAR</span>}</div>
                  <div className="cf-name">{existing.name}</div>
                  <div className="cf-grid">
                    <div><div className="k">Bookings</div><div className="v num">{existing.bookings}</div></div>
                    <div><div className="k">Last booking</div><div className="v">{existing.last}</div></div>
                    <div><div className="k">Preferred cleaner</div><div className="v">{existing.prefCleaner||"—"}</div></div>
                    <div><div className="k">Usual</div><div className="v">{existing.usualDay?`${existing.usualDay} ${existing.usualTime}`:"—"}</div></div>
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
                <button className="save-btn" disabled={!canSave} onClick={()=>setShowConfirm(true)}>Review booking</button>
                <p className="save-note">{canSave?"Ready — review, save, and it deploys automatically.":"Fill client, time, price, location and a valid cleaner to continue."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="demo-note">
        <b>Prototype note.</b> Mock data, no backend — bookings you add live in this session and feed Deployment
        + Driver schedule. New bookings respect ones already placed, so a second job for the same cleaner can trigger a
        <b> conflict</b>. Try booking <code>Khalifa City</code> at <code>09:00-12:00</code> to see travel logic reject a cleaner.
      </p>

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

/* ---------------- deployment view (sheet layout) ---------------- */
function compactTime(t){ let [h,m]=t.split(":"); h=String(parseInt(h,10)); return m==="00"?h:`${h}:${m}`; }
function fmtSheetDate(date){ try{ return new Date(date+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short",year:"numeric"}); }catch(e){ return date; } }

function DeploymentView({bookings,date,setDate,highlight,onUpdate,onDelete}){
  const [editing,setEditing]=useState(null);
  const dayBookings=bookings.filter(b=>b.date===date);
  const lanes=CLEANERS.map(cl=>({cl,jobs:dayBookings.filter(b=>b.cleanerId===cl.id).sort((a,b)=>a.time.startMin-b.time.startMin)}));
  const active=lanes.filter(l=>l.jobs.length>0);
  const cols=active.length?active:lanes;
  const deployed=active.length;

  return(
    <div className="board">
      <div className="board-hd">
        <div><h2>Deployment board</h2>
          <div className="stat">{dayBookings.length} booking{dayBookings.length!==1?"s":""} · {deployed} cleaner{deployed!==1?"s":""} deployed · tap any job to edit</div></div>
        <div className="board-actions">
          <button className="btn-x" disabled={dayBookings.length===0} onClick={()=>exportDeployment(dayBookings,date)}>⤓ Export Excel</button>
          <div className="date-pick"><span className="lab" style={{margin:0}}>Date</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        </div>
      </div>

      {dayBookings.length===0
        ? <div className="empty-board">No bookings on this date. Add one from <b>New booking</b> and it appears here.</div>
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

      {editing && <EditBookingModal booking={editing}
        onSave={(id,changes)=>{onUpdate(id,changes);setEditing(null);}}
        onDelete={(id)=>{onDelete(id);setEditing(null);}}
        onClose={()=>setEditing(null)}/>}
    </div>
  );
}

/* ---------------- driver view ---------------- */
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
                  {r.gps &&
                    <a className="drv-pin" href={mapsLink(r.gps)} target="_blank" rel="noopener noreferrer" title="Navigate in Waze">📍 Waze</a>}
                </div>
              );
            })}
          </div>}
    </div>
  );
}

/* ---------------- map modal ---------------- */
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

/* ---------------- confirm modal ---------------- */
function ConfirmModal({data,onSave,onCancel}){
  const d=data;
  return(
    <div className="ovl" onClick={onCancel}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h2>Confirm booking</h2>
        <p className="msub">Quick check before it deploys.</p>
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

/* ---------------- edit booking modal ---------------- */
function EditBookingModal({booking,onSave,onDelete,onClose}){
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
  const cleaner=CLEANERS.find(c=>c.id===cleanerId);
  const valid=name.trim() && time && cleaner;

  function save(){
    if(!valid) return;
    onSave(b.id,{ clientName:name, time, materials, price, code, building, apt, area, gps, notes,
      cleanerId, cleanerName:cleaner.name });
  }

  return(
    <div className="ovl" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h2>Edit booking</h2>
        <p className="msub">{b.seed?"Sample booking — changes apply for this session.":"Update any detail and save."}</p>

        <div className="field">
          <label className="lab">Client name</label>
          <input value={name} onChange={e=>setName(e.target.value)}/>
        </div>
        <div className="field">
          <label className="lab">Time</label>
          <input value={timeText} onChange={e=>setTimeText(e.target.value)} placeholder="9-12 or 15:00-17:00"/>
          {time
            ? <div className="time-parsed"><span className="chip num">{time.start}–{time.end}</span><span className="chip dur num">{fmtDur(time.minutes)}</span></div>
            : <p className="hint err">Enter a valid range like 9-12.</p>}
        </div>
        <div className="field">
          <label className="lab">Cleaner</label>
          <select value={cleanerId} onChange={e=>setCleanerId(e.target.value)}>
            {CLEANERS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="row2">
          <div className="field">
            <label className="lab">Materials</label>
            <div className="toggle">
              <button className={materials?"on":""} onClick={()=>setMaterials(true)}>With</button>
              <button className={!materials?"on":""} onClick={()=>setMaterials(false)}>Without</button>
            </div>
          </div>
          <div className="field">
            <label className="lab">Price (AED)</label>
            <div className="price-in"><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value)}/><span className="aed">AED</span></div>
          </div>
        </div>
        <div className="field">
          <label className="lab">Job code</label>
          <select value={code} onChange={e=>setCode(e.target.value)}>
            <option value="O">O</option><option value="C">C</option>
          </select>
        </div>
        <div className="row2">
          <div className="field">
            <label className="lab">Building</label>
            <input value={building} onChange={e=>setBuilding(e.target.value)}/>
          </div>
          <div className="field">
            <label className="lab">Apt / villa / office</label>
            <input value={apt} onChange={e=>setApt(e.target.value)}/>
          </div>
        </div>
        <div className="field">
          <label className="lab">Area</label>
          <select value={area} onChange={e=>setArea(e.target.value)}>
            {AREAS.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field">
          {gps
            ? <div className="loc-btn set"><div className="loc-set" style={{width:"100%"}}>
                <div><div style={{fontWeight:600}}>📍 Location set</div><div className="co num">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</div></div>
                <button className="re" onClick={()=>setShowMap(true)}>Change</button></div></div>
            : <button className="loc-btn" onClick={()=>setShowMap(true)}><span>📍 Set location</span><span>›</span></button>}
        </div>
        <div className="field">
          <label className="lab">Notes</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/>
        </div>

        <div className="edit-actions">
          <button className="del" onClick={()=>onDelete(b.id)}>Delete</button>
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
   AUTH GATE + SUPABASE CONNECTION  (Step 1 of the DB wiring)
   ============================================================ */
const authWrap={minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
  background:"#eef1f0",fontFamily:"'Inter',system-ui,sans-serif",padding:"20px"};
const authCard={background:"#fff",border:"1px solid #d9e0dd",borderRadius:"16px",padding:"28px",
  width:"100%",maxWidth:"380px",boxShadow:"0 6px 30px rgba(20,32,28,.08)"};
const authInput={width:"100%",fontSize:"15px",padding:"11px 12px",border:"1.5px solid #d9e0dd",
  borderRadius:"9px",outline:"none",marginTop:"6px",boxSizing:"border-box"};
const authBtn={width:"100%",fontFamily:"'Space Grotesk',system-ui,sans-serif",fontWeight:600,
  fontSize:"15px",padding:"13px",borderRadius:"11px",border:"none",background:"#0e7c5a",
  color:"#fff",cursor:"pointer",marginTop:"16px"};

function ConfigMissing(){
  return(
    <div style={authWrap}><div style={authCard}>
      <h2 style={{fontFamily:"'Space Grotesk',sans-serif",margin:"0 0 8px"}}>Not connected yet</h2>
      <p style={{color:"#64726d",fontSize:"14px",lineHeight:1.5,margin:0}}>
        The app can't find its Supabase settings. Add <b>VITE_SUPABASE_URL</b> and
        <b> VITE_SUPABASE_ANON_KEY</b> in Vercel → Settings → Environment Variables, then redeploy.
      </p>
    </div></div>
  );
}

function Login(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(e){
    e.preventDefault(); setErr(""); setBusy(true);
    const { error }=await supabase.auth.signInWithPassword({ email:email.trim(), password });
    setBusy(false);
    if(error) setErr(error.message);
  }
  return(
    <div style={authWrap}>
      <form style={authCard} onSubmit={submit}>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,color:"#0e7c5a",fontSize:"13px",letterSpacing:".02em"}}>AR CLEANING · Dispatch</div>
        <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,margin:"6px 0 18px",fontSize:"20px"}}>Staff sign in</h2>
        <label style={{fontSize:"12.5px",fontWeight:500,color:"#64726d"}}>Email
          <input style={authInput} type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/>
        </label>
        <label style={{fontSize:"12.5px",fontWeight:500,color:"#64726d",display:"block",marginTop:"12px"}}>Password
          <input style={authInput} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/>
        </label>
        {err && <p style={{color:"#c33a2e",fontSize:"13px",marginTop:"12px",marginBottom:0}}>{err}</p>}
        <button style={{...authBtn,opacity:busy?.6:1}} disabled={busy} type="submit">{busy?"Signing in…":"Sign in"}</button>
      </form>
    </div>
  );
}

function AuthBar({email}){
  const [status,setStatus]=useState("checking");
  const [count,setCount]=useState(null);
  useEffect(()=>{
    let on=true;
    supabase.from("cleaners").select("id",{count:"exact",head:true})
      .then(({count,error})=>{ if(!on)return; if(error){setStatus("err:"+error.message);} else {setStatus("ok");setCount(count);} });
    return ()=>{on=false;};
  },[]);
  const bar={display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",
    padding:"8px 18px",background:"#14201c",color:"#cfe0d9",fontFamily:"'Inter',sans-serif",fontSize:"12.5px"};
  const dot=(c)=>({width:"8px",height:"8px",borderRadius:"50%",background:c,display:"inline-block"});
  return(
    <div style={bar}>
      {status==="ok"
        ? <span style={{display:"inline-flex",alignItems:"center",gap:"7px"}}><span style={dot("#3ad29f")}/>Supabase connected · {count} cleaners loaded</span>
        : status==="checking"
          ? <span style={{display:"inline-flex",alignItems:"center",gap:"7px"}}><span style={dot("#b7791f")}/>Connecting…</span>
          : <span style={{display:"inline-flex",alignItems:"center",gap:"7px",color:"#f2b8b2"}}><span style={dot("#c33a2e")}/>DB error: {status.slice(4)}</span>}
      <span style={{marginLeft:"auto",opacity:.8}}>{email}</span>
      <button onClick={()=>supabase.auth.signOut()} style={{background:"none",border:"1px solid #3a4a44",color:"#cfe0d9",borderRadius:"7px",padding:"4px 10px",cursor:"pointer",fontSize:"12px"}}>Sign out</button>
    </div>
  );
}

export default function App(){
  const [session,setSession]=useState(undefined); // undefined = still loading
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
