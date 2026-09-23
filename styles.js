export const CSS = `
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
