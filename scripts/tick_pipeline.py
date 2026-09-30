#!/usr/bin/env python3
"""Tick path pipeline: trace Tariq's hand-drawn check -> lengthen + straighten.

Stages:
  1. Load centerline trace (/tmp/trace.csv), split arms at true vertex,
     bridge the vertex gap with a tight rounded turn.
  2. Lengthen: extend both arm ends along their tangents (+18% of arm len).
  3. Straighten: pull each arm k toward its chord (k=0.40).
  4. Resample to 64 pts, ALWAYS keeping the vertex point.
  5. Emit TICK1 (+shifted TICK2, ~30% overlap) and measured TICK_LEN.
"""
import numpy as np, re
from PIL import Image

TRACE_CSV = '/tmp/trace.csv'
OUT_TXT = '/tmp/traced_tick_v2.txt'
OUT_PNG = '/tmp/traced_v2.png'

# ---- 1. trace -> bridged centerline (image coords) ----
img = Image.open('/home/hatch/workspace/user/files/75178_3_acpq.png').convert('L')
a = np.array(img)
dark = a < 128
ys, xs = np.where(dark)
deep = ys > 885
tvx, tvy = float(np.median(xs[deep])), 899.0

s = np.loadtxt(TRACE_CSV, delimiter=',')
xs2, ys2 = s[:, 0], s[:, 1]
left = s[xs2 < tvx - 25]
right = s[xs2 > tvx + 25]
p0, p2 = left[-1], right[0]
V = np.array([tvx, tvy])
b1 = np.array([(1 - t) * p0 + t * V for t in np.linspace(0, 1, 10)[1:]])
b2 = np.array([(1 - t) * V + t * p2 for t in np.linspace(0, 1, 10)[1:-1]])
full = np.vstack([left, b1, b2, right])
sm = full.copy()
for i in range(1, len(sm) - 1):
    sm[i] = (full[i - 1] + full[i] * 2 + full[i + 1]) / 4

# ---- normalize to viewBox ----
sc = 8.0 / 811.0
out = np.column_stack([2 + (sm[:, 0] - 122) * sc, 3 + (sm[:, 1] - 88) * sc])

# ---- 2+3. lengthen + straighten per arm ----
vi = int(np.argmax(out[:, 1]))
L, R = out[:vi + 1].copy(), out[vi:].copy()

def armlen(a):
    d = np.diff(a, axis=0)
    return float(np.hypot(d[:, 0], d[:, 1]).sum())

def extend_end(arm, amount, at_start):
    arm = arm.copy()
    tan = (arm[0] - arm[3]) if at_start else (arm[-1] - arm[-4])
    tan = tan / (float(np.hypot(*tan)) or 1.0)
    if at_start:
        new_pt = arm[0] + tan * amount
        ins = [arm[0] + tan * amount * f for f in (2 / 3, 1 / 3)]
        return np.vstack([new_pt, ins[0], ins[1], arm])
    new_pt = arm[-1] + tan * amount
    ins = [arm[-1] + tan * amount * f for f in (1 / 3, 2 / 3)]
    return np.vstack([arm, ins[0], ins[1], new_pt])

def straighten(arm, k):
    a, b = arm[0], arm[-1]
    t = np.linspace(0, 1, len(arm))[:, None]
    chord = a + (b - a) * t
    return chord + (1 - k) * (arm - chord)

def straighten_tip(arm, k_base, tip_boost, tip_frac=0.35, tip_at_start=True):
    """Straighten harder near the tip (outer edge) of an arm."""
    a, b = arm[0], arm[-1]
    n = len(arm)
    t = np.linspace(0, 1, n)[:, None]
    chord = a + (b - a) * t
    if tip_at_start:
        w = np.clip((tip_frac - t) / tip_frac, 0, 1)
    else:
        w = np.clip((t - (1 - tip_frac)) / tip_frac, 0, 1)
    w = w * w * (3 - 2 * w)  # smoothstep
    k = k_base + tip_boost * w
    return chord + (1 - k) * (arm - chord)

EXT, STRAIGHT_K, TIP_BOOST = 0.18, 0.40, 0.35
L2 = straighten_tip(extend_end(L, armlen(L) * EXT, True), STRAIGHT_K, TIP_BOOST, tip_at_start=True)
R2 = straighten_tip(extend_end(R, armlen(R) * EXT, False), STRAIGHT_K, TIP_BOOST, tip_at_start=False)
new = np.vstack([L2, R2[1:]])

# ---- 4. resample to 64 pts, vertex always included ----
d = np.diff(new, axis=0)
cum = np.hstack([[0], np.cumsum(np.hypot(d[:, 0], d[:, 1]))])
vi2 = int(np.argmax(new[:, 1]))
idx = np.linspace(0, len(new) - 1, 64).astype(int)
if vi2 not in idx:
    idx[np.argmin(np.abs(idx - vi2))] = vi2
    idx = np.sort(idx)
pts = new[idx]
length = float(cum[-1])

# ---- 5. emit ----
w = float(pts[:, 0].max() - pts[:, 0].min())
shift = round(w * 0.62, 1)  # ~38% overlap: a little more than before
d1 = "M" + " L".join("%.2f %.2f" % (x, y) for x, y in pts)
d2 = "M" + " L".join("%.2f %.2f" % (x + shift, y) for x, y in pts)
with open(OUT_TXT, 'w') as f:
    f.write("TICK1=" + d1 + "\nTICK2=" + d2 + "\nLEN=%.2f\nSHIFT=%.1f\n" % (length, shift))

print("vertex: (%.2f, %.2f)" % (pts[np.argmax(pts[:, 1])][0], pts[:, 1].max()))
print("x: %.2f..%.2f  y: %.2f..%.2f" % (pts[:, 0].min(), pts[:, 0].max(), pts[:, 1].min(), pts[:, 1].max()))
print("TICK_LEN=%.2f width=%.2f shift=%.1f" % (length, w, shift))

from PIL import ImageDraw
img2 = Image.new('RGB', (660, 380), 'white')
dr = ImageDraw.Draw(img2)
S = 20
for dx in (0, shift):
    dr.line([((x + dx) * S + 40, y * S + 15) for x, y in pts], fill='black', width=4, joint='curve')
img2.save(OUT_PNG)
print("saved", OUT_TXT, OUT_PNG)
