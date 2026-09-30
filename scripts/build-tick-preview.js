// Builds the tick + icon preview HTML. Run: node scripts/build-tick-preview.js
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
  path.join(__dirname, "..", "src", "ui", "sf-icons.ts"),
  "utf8",
);
const eq = src.indexOf("= {");
const icons = JSON.parse(src.slice(eq + 1, src.lastIndexOf("};") + 1));

function svg(name, size, color) {
  const ic = icons[name];
  if (!ic) throw new Error("missing icon " + name);
  const paths = ic.paths
    .map(
      (p) =>
        `<path d="${p.d}"${
          p.fillOpacity != null ? ` fill-opacity="${p.fillOpacity}"` : ""
        }/>`,
    )
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="${ic.viewBox}" fill="${color}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

const row = (name, label) =>
  `<div class="mrow"><span class="mic">${svg(
    name,
    20,
    "#101012",
  )}</span><span class="mlabel">${label}</span><span class="mtag">${name}</span></div>`;

const T1 = "M2.5 8 L7 12.5 L15.5 3";
const T2 = "M8 8 L12.5 12.5 L21 3";

const tickStatic = (n, color) =>
  `<svg width="34" height="22" viewBox="0 0 22 14" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${T1}"/>${
    n > 1 ? `<path d="${T2}"/>` : ""
  }</svg>`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:var(--hatch-widget-bg,transparent);color:var(--hatch-widget-text,#101012);padding:14px;max-width:520px;margin:0 auto}
h2{font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--hatch-widget-muted,#78787E);margin:18px 4px 8px}
.card{background:var(--hatch-widget-surface,#fff);border:1px solid var(--hatch-widget-border,rgba(16,16,18,.08));border-radius:18px;padding:14px;box-shadow:var(--hatch-widget-shadow,0 6px 24px rgba(16,16,18,.08))}
.demo{display:flex;flex-direction:column;align-items:flex-end;gap:2px;padding:10px 6px}
.bubble{background:#141416;color:#fff;font-size:15px;padding:10px 14px;border-radius:20px;max-width:78%}
.ticks{height:26px;display:flex;align-items:center;padding-right:6px}
.ticks svg path{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 6s ease-in-out infinite}
.ticks svg path.t2{animation-delay:.9s}
@keyframes draw{0%{stroke-dashoffset:1}8%{stroke-dashoffset:0}88%{stroke-dashoffset:0}96%{stroke-dashoffset:1}100%{stroke-dashoffset:1}}
.ticks svg{animation:recolor 6s linear infinite}
@keyframes recolor{0%,58%{stroke:#8E8E93}66%,88%{stroke:#34B7F1}96%,100%{stroke:#8E8E93}}
.states{display:flex;gap:18px;justify-content:center;padding:12px 0 4px;align-items:flex-end}
.state{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--hatch-widget-muted,#78787E)}
.menu{background:rgba(255,255,255,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(16,16,18,.08);border-radius:18px;overflow:hidden}
html[data-theme="dark"] .menu{background:rgba(28,28,32,.55)}
.mrow{display:flex;align-items:center;gap:12px;padding:11px 16px}
.mrow+.mrow{border-top:1px solid var(--hatch-widget-border,rgba(16,16,18,.08))}
.mic{display:flex;width:24px;justify-content:center}
.mlabel{font-size:16px;flex:1}
.mtag{font-size:11px;color:var(--hatch-widget-muted,#78787E);font-family:monospace}
.note{font-size:12px;color:var(--hatch-widget-muted,#78787E);margin:8px 4px 0;line-height:1.5}
</style></head><body>
<h2>Animated ticks — under the bubble</h2>
<div class="card">
<div class="demo">
<div class="bubble">Hey, are we still on for tonight?</div>
<div class="ticks"><svg width="40" height="26" viewBox="0 0 22 14" fill="none" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="${T1}"/><path class="t2" pathLength="1" d="${T2}"/></svg></div>
</div>
<div class="states">
<div class="state">${tickStatic(1, "#8E8E93")}<span>Sent</span></div>
<div class="state">${tickStatic(2, "#8E8E93")}<span>Delivered</span></div>
<div class="state">${tickStatic(2, "#34B7F1")}<span>Read</span></div>
</div>
</div>
<p class="note">Loop: the single tick draws itself, then the second tick draws overlapping it, then both turn blue. This is the motion that would run in the app.</p>
<h2>Copy icon — pick one</h2>
<div class="menu">${row("clipboard", "Copy")}${row(
  "list.clipboard",
  "Copy",
)}</div>
<h2>Edit icon — pick one</h2>
<div class="menu">${row("pencil", "Edit")}${row(
  "square.and.pencil",
  "Edit",
)}${row("pencil.line", "Edit")}${row("pencil.circle", "Edit")}</div>
<p class="note">Reply with your picks, e.g. "copy: clipboard, edit: square.and.pencil". Say the word if the tick animation needs a different feel.</p>
</body></html>`;

const dest = "/home/hatch/workspace/tick-icon-preview.html";
fs.writeFileSync(dest, html);
console.log("wrote", dest, html.length, "bytes");
