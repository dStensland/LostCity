from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1600, 1000
img = Image.new("RGB", (W, H), "#07070d")
draw = ImageDraw.Draw(img)

# Background gradient
for y in range(H):
    t = y / (H - 1)
    r = int(7 + (18 - 7) * t)
    g = int(7 + (10 - 7) * t)
    b = int(13 + (36 - 13) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Subtle diagonal texture
for x in range(-H, W, 24):
    draw.line([(x, 0), (x + H, H)], fill=(36, 30, 58), width=1)

# Atmospheric glows
def radial_glow(cx, cy, radius, color):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(radius, 0, -1):
        a = int((1 - (i / radius)) ** 2 * color[3])
        gd.ellipse((cx - i, cy - i, cx + i, cy + i), fill=(color[0], color[1], color[2], a))
    return glow.filter(ImageFilter.GaussianBlur(18))

img = Image.alpha_composite(img.convert("RGBA"), radial_glow(300, 220, 280, (255, 160, 70, 90)))
img = Image.alpha_composite(img, radial_glow(860, 210, 320, (0, 180, 255, 75)))
img = Image.alpha_composite(img, radial_glow(1320, 240, 300, (30, 200, 110, 80)))

# Fonts
font_display = ImageFont.truetype("/Users/coach/.codex/skills/canvas-design/canvas-fonts/BigShoulders-Bold.ttf", 56)
font_title = ImageFont.truetype("/Users/coach/.codex/skills/canvas-design/canvas-fonts/Outfit-Bold.ttf", 42)
font_label = ImageFont.truetype("/Users/coach/.codex/skills/canvas-design/canvas-fonts/Outfit-Bold.ttf", 32)
font_meta = ImageFont.truetype("/Users/coach/.codex/skills/canvas-design/canvas-fonts/IBMPlexMono-Regular.ttf", 20)
font_small = ImageFont.truetype("/Users/coach/.codex/skills/canvas-design/canvas-fonts/IBMPlexMono-Regular.ttf", 16)

base = ImageDraw.Draw(img)

def rounded_rect(d, rect, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(rect, radius=r, fill=fill, outline=outline, width=width)

# Top panel
panel = (80, 70, W - 80, 340)
rounded_rect(base, panel, 24, fill=(16, 15, 26, 230), outline=(58, 52, 86, 200), width=2)
base.text((120, 100), "STREETLAMP NAVIGATION COMP", font=font_display, fill=(243, 240, 232, 255))
base.text((122, 164), "feed / find / community as guided city light", font=font_meta, fill=(165, 158, 190, 255))

# Lamp tab renderer

def draw_lamp_tab(x, y, w, h, label, accent, subtitle, active=False):
    border = accent if active else (88, 84, 108, 220)
    fill = (20, 18, 34, 245) if active else (18, 16, 30, 220)
    rounded_rect(base, (x, y, x + w, y + h), 20, fill=fill, outline=border, width=2)

    # Lamp post + head
    cx = x + 66
    top = y + 26
    post_color = tuple(min(255, c + 20) for c in accent)
    base.rounded_rectangle((cx - 5, top + 20, cx + 5, y + h - 20), radius=4, fill=post_color)
    base.rounded_rectangle((cx - 22, top, cx + 22, top + 24), radius=8, fill=accent)

    # Light cone mask
    tab = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(tab)
    td.polygon([(66, 52), (22, h - 16), (110, h - 16)], fill=(accent[0], accent[1], accent[2], 145 if active else 85))
    tab = tab.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(tab, (x, y))

    # Beam floor glow
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((10, h - 46, 120, h + 28), fill=(accent[0], accent[1], accent[2], 105 if active else 55))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(9)), (x, y))

    # Copy
    base.text((x + 140, y + 26), label.upper(), font=font_label, fill=(244, 242, 233, 255))
    base.text((x + 140, y + 72), subtitle, font=font_small, fill=(184, 178, 206, 255))

    # Active badge
    if active:
        rounded_rect(base, (x + w - 118, y + 20, x + w - 20, y + 50), 14, fill=(accent[0], accent[1], accent[2], 60), outline=(accent[0], accent[1], accent[2], 200), width=1)
        base.text((x + w - 95, y + 27), "ACTIVE", font=font_small, fill=accent)

# Three tabs
left = 110
top = 205
gap = 24
tab_w = (W - 220 - gap * 2) // 3

draw_lamp_tab(left, top, tab_w, 108, "Feed", (255, 191, 84, 255), "Main street pulse", active=True)
draw_lamp_tab(left + tab_w + gap, top, tab_w, 108, "Find", (62, 209, 255, 255), "Searchlight focus")
draw_lamp_tab(left + (tab_w + gap) * 2, top, tab_w, 108, "Community", (63, 214, 139, 255), "Gathering glow")

# Section title
base.text((90, 390), "HOLIDAYS AND SPECIAL TIMES", font=font_title, fill=(242, 238, 226, 255))
base.text((92, 438), "streetlamp states make hierarchy visible before text", font=font_meta, fill=(164, 156, 186, 255))

# Feature card
card = (80, 490, W - 80, 860)
rounded_rect(base, card, 28, fill=(14, 14, 22, 230), outline=(70, 56, 52, 200), width=2)

# Card gradient overlay
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for i in range(420):
    t = i / 419
    r = int(40 + (14 - 40) * t)
    g = int(8 + (14 - 8) * t)
    b = int(10 + (18 - 10) * t)
    a = int(170 * (1 - t * 0.35))
    od.line([(card[0], card[1] + i), (card[2], card[1] + i)], fill=(r, g, b, a))
img.alpha_composite(overlay)

# Left icon capsule
icon_box = (128, 560, 314, 746)
rounded_rect(base, icon_box, 36, fill=(28, 26, 30, 240), outline=(78, 72, 80, 200), width=2)

icon = Image.open('/Users/coach/Projects/LostCity/web/public/icons/black-history-fist.png').convert('RGBA')
icon = icon.resize((132, 132), Image.Resampling.LANCZOS)
img.alpha_composite(icon, (155, 587))

# Active lamp indicator inside card
lampx = 368
lampy = 560
base.rounded_rectangle((lampx - 4, lampy + 10, lampx + 4, lampy + 160), radius=4, fill=(255, 191, 84, 255))
base.rounded_rectangle((lampx - 18, lampy - 2, lampx + 18, lampy + 22), radius=8, fill=(255, 191, 84, 255))
beam = Image.new("RGBA", (280, 220), (0, 0, 0, 0))
bd = ImageDraw.Draw(beam)
bd.polygon([(24, 28), (0, 200), (52, 200)], fill=(255, 191, 84, 110))
beam = beam.filter(ImageFilter.GaussianBlur(8))
img.alpha_composite(beam, (lampx - 22, lampy + 10))

# Card copy
base.text((410, 572), "Black History Month", font=font_title, fill=(245, 241, 233, 255))
base.text((412, 622), "Honoring Black culture, art & community in Atlanta", font=font_meta, fill=(193, 186, 208, 255))
rounded_rect(base, (412, 664, 548, 704), 18, fill=(229, 57, 53, 56), outline=(229, 57, 53, 180), width=1)
base.text((436, 676), "45 events", font=font_meta, fill=(255, 124, 114, 255))

# Annotation chips
chips = [
    ("Feed lamp", "continuous warm cone", (255, 191, 84, 255)),
    ("Find lamp", "narrow cool beam on search", (62, 209, 255, 255)),
    ("Community lamp", "soft social pooling light", (63, 214, 139, 255)),
]
cy = 738
for title, sub, c in chips:
    rounded_rect(base, (410, cy, 980, cy + 36), 14, fill=(24, 24, 36, 220), outline=(72, 68, 94, 170), width=1)
    base.ellipse((426, cy + 12, 438, cy + 24), fill=c)
    base.text((452, cy + 8), f"{title}  ·  {sub}", font=font_small, fill=(220, 216, 226, 255))
    cy += 46

# Bottom note
base.text((90, 910), "Comp only: visual direction for nav metaphor before implementation", font=font_meta, fill=(148, 143, 171, 255))

out = '/Users/coach/Projects/LostCity/output/design/streetlamp-navigation-comp.png'
img.convert('RGB').save(out, quality=95)
print(out)
