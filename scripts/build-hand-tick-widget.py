#!/usr/bin/env python3
"""Build the hand-drawn tick lab widget HTML, embedding generated fill paths."""
import json, re

txt = open('/tmp/hand_ticks.txt').read()
variants = {}
for m in re.finditer(r'--- (HD\d) ---\nFILL1: (.*?)\nCL1: (.*?)\nFILL2: (.*?)\nCL2: (.*?)\n', txt, re.S):
    name, f1, c1, f2, c2 = m.groups()
    variants[name] = {"f1": f1, "c1": c1, "f2": f2, "c2": c2}

names = {"HD1": ("Marker", "like your example"), "HD2": ("Bold", "thicker marker"),
         "HD3": ("Brush", "dramatic taper")}
order = ["A", "HD1", "HD2", "HD3"]

html = []
html.append("""<style>
.ticklab{box-sizing:border-box;max-width:560px;margin:0 auto;padding:12px;
font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;color:var(--hatch-widget-text)}
.ticklab *{box-sizing:border-box}
.tl-title{font-size:15px;font-weight:700;margin:0 0 2px}
.tl-sub{font-size:12px;color:var(--hatch-widget-muted);margin:0 0 12px}
.tl-controls{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;
background:var(--hatch-widget-surface);border:1px solid var(--hatch-widget-border);border-radius:12px}
.tl-ctl{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--hatch-widget-muted)}
.tl-ctl output{min-width:36px;text-align:right;color:var(--hatch-widget-text);font-variant-numeric:tabular-nums}
.tl-ctl input[type=range]{width:110px;accent-color:var(--hatch-widget-accent)}
.tl-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:420px){.tl-grid{grid-template-columns:1fr}}
.tl-card{background:var(--hatch-widget-surface);border:1.5px solid var(--hatch-widget-border);
border-radius:14px;padding:10px}
.tl-card.picked{border-color:var(--hatch-widget-accent)}
.tl-head{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.tl-name{font-size:13px;font-weight:700;flex:1}
.tl-name small{font-weight:400;color:var(--hatch-widget-muted)}
.tl-btn{font-size:11px;padding:5px 10px;border-radius:999px;border:1px solid var(--hatch-widget-border);
background:var(--hatch-widget-surface-muted);color:var(--hatch-widget-text);cursor:pointer}
.tl-btn.pick{background:var(--hatch-widget-accent);color:var(--hatch-widget-on-accent);
border-color:transparent;font-weight:700}
.tl-big{display:flex;justify-content:space-around;align-items:flex-end;padding:10px 4px 6px;
background:var(--hatch-widget-surface-muted);border-radius:10px}
.tl-state{display:flex;flex-direction:column;align-items:center;gap:6px}
.tl-state span{font-size:10px;color:var(--hatch-widget-muted)}
.tl-actual{display:flex;align-items:center;justify-content:space-around;margin-top:8px;
padding-top:8px;border-top:1px dashed var(--hatch-widget-border)}
.tl-actual .cell{display:flex;flex-direction:column;align-items:center;gap:4px}
.tl-actual .cell span{font-size:9px;color:var(--hatch-widget-muted)}
@keyframes tldraw{to{stroke-dashoffset:0}}
@keyframes tldrawS{to{stroke-dashoffset:0}}
</style>
<div class="ticklab">
<p class="tl-title">Tick Lab — hand-drawn</p>
<p class="tl-sub">Marker-style ticks like your example: tapered ends, fat rounded middle. A is the current one for comparison.</p>
<div class="tl-controls">
<label class="tl-ctl">Speed <input id="tlSpeed" type="range" min="0.5" max="2" step="0.25" value="1"><output id="tlSpeedOut">1&times;</output></label>
</div>
<div class="tl-grid" id="tlGrid"></div>
</div>
<script>
(function(){
var GRAY="#9AA0A6", BLUE="#2E9BF0";
var HD = __HD_JSON__;
var CUR = {t1:"M2 7.5 L5.5 11 L12 3", t2:"M9 7.5 L12.5 11 L19 3"};
var VARIANTS = [
 {id:"A", name:"Current", sub:"baseline"},
 {id:"HD1", name:"__N_HD1__", sub:"__S_HD1__"},
 {id:"HD2", name:"__N_HD2__", sub:"__S_HD2__"},
 {id:"HD3", name:"__N_HD3__", sub:"__S_HD3__"}
];
var STATES=[{id:"sent",label:"Sent",n:1,color:GRAY},{id:"delivered",label:"Delivered",n:2,color:GRAY},{id:"read",label:"Read",n:2,color:BLUE}];
var uid=0;
function handSvg(vid, st, w){
  var v=HD[vid], id="m"+(uid++);
  var fills="", masks="";
  for(var i=0;i<st.n;i++){
    var f=i===0?v.f1:v.f2, c=i===0?v.c1:v.c2;
    fills+='<path d="'+f+'" fill="'+st.color+'"/>';
    masks+='<path class="mmask'+(i===1?" d2":"")+'" d="'+c+'" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
  }
  var h=Math.round(w*14/24);
  return '<svg viewBox="0 0 24 14" width="'+w+'" height="'+h+'"><defs><mask id="'+id+'">'+masks+
    '</mask></defs><g mask="url(#'+id+')">'+fills+'</g></svg>';
}
function strokeSvg(st, w){
  var paths='<path class="tick-path" d="'+CUR.t1+'"/>';
  if(st.n===2) paths+='<path class="tick-path d2" d="'+CUR.t2+'"/>';
  var h=Math.round(w*14/24);
  return '<svg viewBox="0 0 24 14" width="'+w+'" height="'+h+'" data-color="'+st.color+'">'+paths+'</svg>';
}
function paint(card, state){
  var dur=(0.55/state.speed).toFixed(2)+"s";
  card.querySelectorAll("svg").forEach(function(svg){
    var color=svg.getAttribute("data-color");
    svg.querySelectorAll("path.tick-path").forEach(function(p,i){
      var len=p.getTotalLength();
      p.style.stroke=color; p.style.strokeWidth=1.6; p.style.fill="none";
      p.style.strokeLinecap="round"; p.style.strokeLinejoin="round";
      p.style.strokeDasharray=len; p.style.strokeDashoffset=len;
      p.style.animation="none"; void p.getBoundingClientRect();
      p.style.animation="tldrawS "+dur+" ease forwards";
      p.style.animationDelay=(i===1?0.16/state.speed:0)+"s";
    });
    svg.querySelectorAll("path.mmask").forEach(function(p,i){
      var len=p.getTotalLength();
      p.style.strokeDasharray=len; p.style.strokeDashoffset=len;
      p.style.animation="none"; void p.getBoundingClientRect();
      p.style.animation="tldraw "+dur+" ease forwards";
      p.style.animationDelay=(i===1?0.16/state.speed:0)+"s";
    });
  });
}
function render(){
  var s=window.hatchWidget.getState({speed:1,pick:null});
  var grid=document.getElementById("tlGrid"); grid.innerHTML="";
  VARIANTS.forEach(function(v){
    var card=document.createElement("div");
    card.className="tl-card"+(s.pick===v.id?" picked":"");
    var big=STATES.map(function(st){
      var svg=v.id==="A"?strokeSvg(st,62):handSvg(v.id,st,62);
      return '<div class="tl-state">'+svg+"<span>"+st.label+"</span></div>";
    }).join("");
    var actual=STATES.map(function(st){
      var svg=v.id==="A"?strokeSvg(st,22):handSvg(v.id,st,22);
      return '<div class="cell">'+svg+"<span>"+st.label+"</span></div>";
    }).join("");
    card.innerHTML='<div class="tl-head"><div class="tl-name">'+v.id+" · "+v.name+
      " <small>"+v.sub+"</small></div>"+
      '<button class="tl-btn" data-act="replay">Replay</button>'+
      '<button class="tl-btn pick" data-act="pick">'+(s.pick===v.id?"Picked":"Pick")+"</button></div>"+
      '<div class="tl-big">'+big+"</div>"+
      '<div class="tl-actual">'+actual+"</div>";
    card.querySelector('[data-act="replay"]').addEventListener("click",function(){
      paint(card,window.hatchWidget.getState({speed:1,pick:null}));
    });
    card.querySelector('[data-act="pick"]').addEventListener("click",function(){
      var cur=window.hatchWidget.getState({speed:1,pick:null});
      cur.pick=cur.pick===v.id?null:v.id;
      window.hatchWidget.setState(cur);
    });
    grid.appendChild(card);
    paint(card,s);
  });
  var sp=document.getElementById("tlSpeed");
  sp.value=s.speed;
  document.getElementById("tlSpeedOut").textContent=Number(s.speed).toFixed(2).replace(/0$/,"")+"×";
}
document.getElementById("tlSpeed").addEventListener("input",function(e){
  var s=window.hatchWidget.getState({speed:1,pick:null});
  s.speed=parseFloat(e.target.value);
  window.hatchWidget.setState(s);
});
window.addEventListener("hatch-widget-state",render);
render();
})();
</script>""")

hd_json = json.dumps(variants)
html = "".join(html).replace("__HD_JSON__", hd_json)
for k, (n, s_) in names.items():
    html = html.replace(f"__N_{k}__", n).replace(f"__S_{k}__", s_)

open('/home/hatch/workspace/tick-lab-hand.html', 'w').write(html)
print("wrote", len(html), "bytes")
