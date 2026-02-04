#!/usr/bin/env python3
"""Generate the Lost City Atlanta header background image.

Recognizable Atlanta skyline silhouette — buildings descend from horizon at top.
Warm peach/gold palette evoking Georgia sunsets.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math
import random

WIDTH = 2560
HEIGHT = 140
random.seed(99)

img = Image.new("RGB", (WIDTH, HEIGHT), (10, 10, 15))
draw = ImageDraw.Draw(img)

# --- ATLANTA COLOR PALETTE ---
# Georgia sunset: peach, warm gold, terracotta fading to deep indigo
for y in range(HEIGHT):
    t = y / HEIGHT
    if t < 0.06:
        # Hot peach-gold horizon
        f = 1.0 - (t / 0.06) * 0.1
        r, g, b = int(235 * f), int(160 * f), int(90 * f)
    elif t < 0.20:
        lt = (t - 0.06) / 0.14
        r = int(230 * (1 - lt) + 180 * lt)
        g = int(155 * (1 - lt) + 100 * lt)
        b = int(85 * (1 - lt) + 70 * lt)
    elif t < 0.45:
        lt = (t - 0.20) / 0.25
        r = int(180 * (1 - lt) + 60 * lt)
        g = int(100 * (1 - lt) + 35 * lt)
        b = int(70 * (1 - lt) + 55 * lt)
    else:
        lt = ((t - 0.45) / 0.55) ** 1.2
        r = int(60 * (1 - lt) + 12 * lt)
        g = int(35 * (1 - lt) + 10 * lt)
        b = int(55 * (1 - lt) + 18 * lt)
    draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

# --- ATMOSPHERIC GLOW ---
haze = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
haze_draw = ImageDraw.Draw(haze)
for cx, strength in [(WIDTH * 0.35, 0.6), (WIDTH * 0.5, 1.0), (WIDTH * 0.65, 0.7)]:
    for y in range(55):
        intensity = max(0, 1.0 - (y / 45)) * strength
        spread = 450 + y * 22
        for x in range(max(0, int(cx - spread)), min(WIDTH, int(cx + spread)), 2):
            dx = abs(x - cx) / spread
            glow = intensity * max(0, 1.0 - dx ** 1.8) * 0.22
            if glow > 0.01:
                haze_draw.point((x, y), fill=(int(255 * glow), int(185 * glow), int(95 * glow)))
haze = haze.filter(ImageFilter.GaussianBlur(radius=12))
img = ImageChops.add(img, haze)
draw = ImageDraw.Draw(img)

# --- SILHOUETTE DRAWING HELPERS ---
BG = (7, 7, 11)

def rect(x1, y1, x2, y2):
    draw.rectangle([(x1, 0), (x2, y2)], fill=BG)

def trapezoid(x1, x2, y_base, x1_top, x2_top, y_top):
    """Tapered building top."""
    draw.polygon([(x1, y_base), (x1_top, y_top), (x2_top, y_top), (x2, y_base)], fill=BG)

def pointed_crown(cx, half_w, y_base, y_tip):
    """Pointed/pyramidal building top."""
    draw.polygon([(cx - half_w, y_base), (cx, y_tip), (cx + half_w, y_base)], fill=BG)

def stepped_top(cx, w, y_base, steps, step_h):
    """Stepped/tiered crown."""
    for i in range(steps):
        sw = w - i * (w // (steps + 1))
        sy = y_base + i * step_h
        rect(cx - sw // 2, 0, cx + sw // 2, sy)

def cylinder_top(cx, half_w, y_base, dome_h):
    """Rounded/cylindrical top (Westin style)."""
    for dy in range(dome_h):
        t = dy / dome_h
        w_at = half_w * math.cos(t * math.pi * 0.5)
        if w_at > 0:
            draw.line([(int(cx - w_at), y_base + dy), (int(cx + w_at), y_base + dy)], fill=BG)

# --- ATLANTA SKYLINE ---
# Centered around WIDTH//2. Atlanta's skyline has two clusters:
# Midtown (slightly left of center) and Downtown (slightly right).

C = WIDTH // 2  # center of composition

# === BACKGROUND FILL: low-rise across entire width ===
x = 0
while x < WIDTH:
    w = random.randint(6, 20)
    h = random.randint(10, 22)
    rect(x, 0, x + w, h)
    x += w + random.randint(0, 3)

# === OUTER SUBURBS: sparse low buildings ===
for _ in range(40):
    cx = random.choice([random.randint(20, C - 600), random.randint(C + 600, WIDTH - 20)])
    w = random.randint(10, 28)
    h = random.randint(18, 35)
    rect(cx - w // 2, 0, cx + w // 2, h)

# === MID-RING: medium buildings approaching downtown ===
for _ in range(50):
    cx = random.choice([random.randint(C - 600, C - 350), random.randint(C + 350, C + 600)])
    w = random.randint(14, 30)
    h = random.randint(28, 50)
    rect(cx - w // 2, 0, cx + w // 2, h)

# === MIDTOWN CLUSTER (left of center) ===
midtown = C - 200

# Atlantic Station / Arts Center area towers
rect(midtown - 350, 0, midtown - 330, 45)
rect(midtown - 320, 0, midtown - 295, 52)
rect(midtown - 285, 0, midtown - 260, 48)

# 1180 Peachtree (tall, slender)
rect(midtown - 240, 0, midtown - 215, 68)

# One Atlantic Center — distinctive gothic pointed top
rect(midtown - 190, 0, midtown - 155, 80)
pointed_crown(midtown - 172, 12, 80, 92)
# Spire
draw.line([(midtown - 172, 92), (midtown - 172, 100)], fill=BG, width=2)

# Colony Square area
rect(midtown - 140, 0, midtown - 115, 55)
rect(midtown - 110, 0, midtown - 85, 62)

# 1100 Peachtree
rect(midtown - 70, 0, midtown - 40, 72)

# Midtown infill
rect(midtown - 30, 0, midtown - 10, 58)
rect(midtown - 5, 0, midtown + 20, 65)
rect(midtown + 25, 0, midtown + 50, 60)

# AT&T / Crescent Midtown
rect(midtown + 55, 0, midtown + 85, 70)

# 1075 Peachtree (condo tower)
rect(midtown + 90, 0, midtown + 115, 75)

# === TALLEST CLUSTER: Downtown/Midtown core ===

# GLG Grand (now Regions Plaza) — wide with setback
rect(C - 120, 0, C - 80, 78)
rect(C - 115, 0, C - 85, 82)  # setback upper portion

# *** BANK OF AMERICA PLAZA *** — THE signature Atlanta building
# Tallest building in Atlanta. Distinctive open-lattice pyramidal crown with spire.
# Main tower body
rect(C - 55, 0, C - 10, 100)
# Stepped crown
rect(C - 50, 0, C - 15, 104)
rect(C - 45, 0, C - 20, 108)
# Pyramidal top
pointed_crown(C - 32, 10, 108, 118)
# Iconic spire/antenna
draw.line([(C - 32, 118), (C - 32, 132)], fill=BG, width=2)
# Tiny red light at top
draw.point((C - 32, 132), fill=(200, 50, 50))

# SunTrust Plaza (now Truist) — immediately adjacent
rect(C - 5, 0, C + 30, 90)
rect(C, 0, C + 25, 95)

# *** WESTIN PEACHTREE PLAZA *** — cylindrical hotel tower, iconic rounded shape
westin_cx = C + 60
rect(westin_cx - 16, 0, westin_cx + 16, 85)
cylinder_top(westin_cx, 16, 85, 8)
# Revolving restaurant dome at bottom (tip of inverted building)
draw.ellipse([(westin_cx - 10, 90), (westin_cx + 10, 96)], fill=BG)
# Antenna
draw.line([(westin_cx, 96), (westin_cx, 104)], fill=BG, width=1)

# Georgia-Pacific Tower — broad rectangular
rect(C + 85, 0, C + 125, 82)

# *** 191 PEACHTREE *** — distinctive twin-peaked crown
rect(C + 140, 0, C + 180, 88)
# Twin peaked top
pointed_crown(C + 150, 6, 88, 96)
pointed_crown(C + 170, 6, 88, 96)

# Marriott Marquis — wide base
rect(C + 190, 0, C + 230, 72)

# === DOWNTOWN SOUTH ===
# AmericasMart complex
rect(C + 240, 0, C + 275, 55)
rect(C + 280, 0, C + 310, 48)

# Centennial Olympic Park area
rect(C + 320, 0, C + 350, 60)
rect(C + 355, 0, C + 380, 52)

# CNN Center / State Farm Arena area (lower, wider)
rect(C + 390, 0, C + 440, 40)
rect(C + 445, 0, C + 480, 35)

# Trailing south
rect(C + 490, 0, C + 515, 42)
rect(C + 520, 0, C + 545, 32)
rect(C + 550, 0, C + 575, 28)

# === INFILL: dense filler between landmarks ===
for base_x in range(C - 200, C + 350, 1):
    # Only fill where height is low (between landmarks)
    current_pixel = img.getpixel((base_x, 50))
    if current_pixel != (7, 7, 11):  # not already a building
        # Random chance to add small filler building
        if random.random() < 0.15:
            w = random.randint(5, 15)
            h = random.randint(40, 65)
            for px in range(max(0, base_x), min(WIDTH, base_x + w)):
                draw.line([(px, 0), (px, h)], fill=BG)

# === TREES/CANOPY on edges (Atlanta is "city in a forest") ===
for _ in range(80):
    cx = random.choice([
        random.randint(50, C - 500),
        random.randint(C + 500, WIDTH - 50)
    ])
    # Organic tree canopy blobs
    tw = random.randint(8, 20)
    th = random.randint(12, 22)
    for dx in range(-tw, tw + 1):
        for dy in range(th):
            dist = math.sqrt((dx / tw) ** 2 + (dy / th) ** 2)
            if dist < 1.0 and random.random() > dist * 0.3:
                px, py = cx + dx, dy
                if 0 <= px < WIDTH and 0 <= py < HEIGHT:
                    draw.point((px, py), fill=BG)

# --- EDGE GLOW along building bottoms ---
edge_glow = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
edge_draw = ImageDraw.Draw(edge_glow)

for x in range(WIDTH):
    # Scan down from top to find where building ends
    for y in range(HEIGHT - 1, 0, -1):
        pixel = img.getpixel((x, y))
        if pixel[0] < 15 and pixel[1] < 15:  # dark building pixel
            # Found bottom edge of building at this x
            for offset in range(6):
                y_pos = y + offset + 1
                if y_pos < HEIGHT:
                    intensity = max(0, 0.30 - offset * 0.06)
                    er = int(220 * intensity)
                    eg = int(155 * intensity)
                    eb = int(65 * intensity)
                    edge_draw.point((x, y_pos), fill=(er, eg, eb))
            break

edge_glow = edge_glow.filter(ImageFilter.GaussianBlur(radius=1.8))
img = ImageChops.add(img, edge_glow)

# --- WINDOW LIGHTS ---
draw = ImageDraw.Draw(img)
for _ in range(300):
    x = random.randint(C - 300, C + 400)
    y = random.randint(3, 90)
    pixel = img.getpixel((x, y))
    if pixel[0] < 15:  # inside a building
        brightness = random.randint(18, 45)
        r = min(255, brightness + random.randint(20, 40))
        g = min(255, brightness + random.randint(8, 22))
        b = max(0, brightness - random.randint(0, 8))
        draw.point((x, y), fill=(r, g, b))

# --- SUBTLE FOG/HAZE between buildings ---
fog = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
fog_draw = ImageDraw.Draw(fog)
for y in range(HEIGHT):
    t = y / HEIGHT
    if 0.3 < t < 0.7:
        fog_intensity = (1.0 - abs(t - 0.5) / 0.2) * 0.04
        for x in range(0, WIDTH, 3):
            pixel = img.getpixel((x, y))
            if pixel[0] > 15:  # not a building (in the glow area)
                fr = int(180 * fog_intensity)
                fg = int(130 * fog_intensity)
                fb = int(70 * fog_intensity)
                fog_draw.point((x, y), fill=(fr, fg, fb))
fog = fog.filter(ImageFilter.GaussianBlur(radius=3))
img = ImageChops.add(img, fog)

# --- FINAL POLISH ---
img = img.filter(ImageFilter.GaussianBlur(radius=0.4))

output_path = "/Users/coach/Projects/LostCity/web/public/portals/atlanta/header-bg.png"
img.save(output_path, "PNG", optimize=True)

final = Image.open(output_path)
print(f"Generated: {final.size[0]}x{final.size[1]} pixels")
print(f"Saved to: {output_path}")
