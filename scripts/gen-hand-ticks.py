#!/usr/bin/env python3
"""Generate hand-drawn tapered tick paths.

A hand/marker-drawn check has variable stroke width (thin ends, fat rounded
vertex). Plain SVG strokes are constant-width, so we build the check as a
FILLED outline: sample a cubic centerline, offset along normals by a tapered
half-width profile, emit a dense polygon (smooth at tiny sizes).

The draw-in animation is done with an SVG mask: the centerline stroke animates
its dashoffset and reveals the fill progressively. react-native-svg supports
<Mask>, so this ports straight into the app.

Outputs path data strings for the widget + app.
"""
import math

def cubic(p0, p1, p2, p3, t):
    mt = 1 - t
    return (
        mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
        mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
    )

def cubic_tangent(p0, p1, p2, p3, t):
    mt = 1 - t
    return (
        3 * mt**2 * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t**2 * (p3[0] - p2[0]),
        3 * mt**2 * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t**2 * (p3[1] - p2[1]),
    )

def width_profile(t, max_w, fullness=0.75, skew=1.1):
    """Thin at both ends, fattest just past the vertex region. min 0.15."""
    w = max_w * (math.sin(math.pi * t**skew) ** fullness)
    return max(0.15, w)

def tapered_fill(segments, max_w, samples=140, fullness=0.75, skew=1.1):
    """segments: list of cubic control-point quads forming the centerline."""
    pts = []
    # arc-length-ish param across all segments: weight by segment count
    total = len(segments) * samples
    left, right = [], []
    for si, (p0, p1, p2, p3) in enumerate(segments):
        for i in range(samples + 1):
            if si > 0 and i == 0:
                continue
            t = i / samples
            gt = (si + t) / len(segments)
            x, y = cubic(p0, p1, p2, p3, t)
            tx, ty = cubic_tangent(p0, p1, p2, p3, t)
            n = math.hypot(tx, ty) or 1.0
            nx, ny = -ty / n, tx / n
            hw = width_profile(gt, max_w, fullness, skew) / 2.0
            left.append((x + nx * hw, y + ny * hw))
            right.append((x - nx * hw, y - ny * hw))
    outline = left + right[::-1]
    d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in outline) + " Z"
    # centerline path for the animation mask
    cl = []
    for si, (p0, p1, p2, p3) in enumerate(segments):
        cl.append(("M" if si == 0 else "L") + f"{p0[0]:.2f} {p0[1]:.2f}" if si == 0 else "")
    # simpler: rebuild centerline as one path through sampled points
    cp = []
    for si, (p0, p1, p2, p3) in enumerate(segments):
        for i in range(samples + 1):
            if si > 0 and i == 0:
                continue
            x, y = cubic(p0, p1, p2, p3, i / samples)
            cp.append((x, y))
    center = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in cp)
    return d, center

def make_tick(dx, max_w, **kw):
    # centerline: short arm -> rounded vertex -> long sweeping arm
    segs = [
        ((2.2 + dx, 6.9), (3.6 + dx, 9.4), (4.5 + dx, 10.5), (5.9 + dx, 10.9)),
        ((5.9 + dx, 10.9), (7.8 + dx, 10.4), (9.9 + dx, 6.8), (12.3 + dx, 2.9)),
    ]
    return tapered_fill(segs, max_w, **kw)

if __name__ == "__main__":
    variants = {
        "HD1-medium": dict(max_w=2.3, fullness=0.75, skew=1.05),
        "HD2-bold": dict(max_w=2.9, fullness=0.7, skew=1.0),
        "HD3-brush": dict(max_w=2.3, fullness=1.1, skew=1.35),
    }
    for name, kw in variants.items():
        fill1, cl1 = make_tick(0, **kw)
        fill2, cl2 = make_tick(7, **kw)
        print(f"--- {name} ---")
        print("FILL1:", fill1)
        print("CL1:", cl1)
        print("FILL2:", fill2)
        print("CL2:", cl2)
        print()
