#!/usr/bin/env python3
"""
Lost City Logo Concepts - PDF Generator
Following the Neon Cartography design philosophy
"""

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import math

# Register fonts
font_path = "/Users/coach/.claude/skills/canvas-design/canvas-fonts/"
pdfmetrics.registerFont(TTFont('GeistMono', font_path + 'GeistMono-Regular.ttf'))
pdfmetrics.registerFont(TTFont('GeistMono-Bold', font_path + 'GeistMono-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Outfit', font_path + 'Outfit-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Outfit-Bold', font_path + 'Outfit-Bold.ttf'))
pdfmetrics.registerFont(TTFont('JetBrainsMono', font_path + 'JetBrainsMono-Regular.ttf'))
pdfmetrics.registerFont(TTFont('BigShoulders', font_path + 'BigShoulders-Regular.ttf'))
pdfmetrics.registerFont(TTFont('BigShoulders-Bold', font_path + 'BigShoulders-Bold.ttf'))

# Colors from brand
BACKGROUND = Color(9/255, 9/255, 11/255)  # #09090b
CORAL = Color(255/255, 107/255, 122/255)  # #ff6b7a
CYAN = Color(0/255, 212/255, 232/255)     # #00d4e8
WHITE = Color(1, 1, 1)
GRAY = Color(0.4, 0.4, 0.4)
DARK_GRAY = Color(0.15, 0.15, 0.15)

WIDTH, HEIGHT = letter  # 612 x 792

def draw_background(c):
    """Fill with dark background"""
    c.setFillColor(BACKGROUND)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)

def draw_grid_pattern(c, opacity=0.03):
    """Subtle grid pattern"""
    c.saveState()
    c.setStrokeColor(Color(1, 1, 1, opacity))
    c.setLineWidth(0.25)
    for x in range(0, int(WIDTH), 20):
        c.line(x, 0, x, HEIGHT)
    for y in range(0, int(HEIGHT), 20):
        c.line(0, y, WIDTH, y)
    c.restoreState()

def draw_scanlines(c, opacity=0.02):
    """CRT scanline effect"""
    c.saveState()
    c.setStrokeColor(Color(1, 1, 1, opacity))
    c.setLineWidth(0.5)
    for y in range(0, int(HEIGHT), 3):
        c.line(0, y, WIDTH, y)
    c.restoreState()

def draw_glow(c, x, y, radius, color, layers=8):
    """Draw a soft glow effect"""
    for i in range(layers, 0, -1):
        alpha = 0.03 * (layers - i + 1) / layers
        r = radius * (1 + i * 0.3)
        glow_color = Color(color.red, color.green, color.blue, alpha)
        c.setFillColor(glow_color)
        c.circle(x, y, r, fill=1, stroke=0)

def draw_neon_text(c, text, x, y, font, size, color, glow_radius=15):
    """Draw text with neon glow effect"""
    # Outer glow
    for i in range(5, 0, -1):
        alpha = 0.1 * (6 - i) / 5
        offset = i * 1.5
        glow_color = Color(color.red, color.green, color.blue, alpha)
        c.setFillColor(glow_color)
        c.setFont(font, size)
        # Draw slightly offset in multiple directions for glow
        for dx, dy in [(-offset, 0), (offset, 0), (0, -offset), (0, offset)]:
            c.drawString(x + dx, y + dy, text)
    # Core text
    c.setFillColor(WHITE)
    c.setFont(font, size)
    c.drawString(x, y, text)
    # Tinted overlay
    c.setFillColor(Color(color.red, color.green, color.blue, 0.7))
    c.drawString(x, y, text)

def page_title(c):
    """Draw title page"""
    draw_background(c)
    draw_grid_pattern(c, 0.02)
    draw_scanlines(c, 0.015)

    # Title
    c.setFont('Outfit-Bold', 14)
    c.setFillColor(GRAY)
    c.drawCentredString(WIDTH/2, HEIGHT - 100, "BRAND EXPLORATION")

    # Main title with glow
    draw_neon_text(c, "LOST", WIDTH/2 - 95, HEIGHT/2 + 40, 'BigShoulders-Bold', 72, CORAL)
    draw_neon_text(c, "CITY", WIDTH/2 + 15, HEIGHT/2 + 40, 'BigShoulders-Bold', 72, CYAN)

    # Subtitle
    c.setFont('GeistMono', 11)
    c.setFillColor(GRAY)
    c.drawCentredString(WIDTH/2, HEIGHT/2 - 30, "LOGO CONCEPTS")

    # Coordinates
    c.setFont('GeistMono', 9)
    c.setFillColor(Color(0.3, 0.3, 0.3))
    c.drawCentredString(WIDTH/2, HEIGHT/2 - 60, "33.7490\u00b0 N, 84.3880\u00b0 W")

    # Bottom tagline
    c.setFont('Outfit', 10)
    c.setFillColor(GRAY)
    c.drawCentredString(WIDTH/2, 80, "Off the screen, into the world")

    # Corner accents
    c.setStrokeColor(CORAL)
    c.setLineWidth(1)
    c.line(40, HEIGHT - 40, 80, HEIGHT - 40)
    c.line(40, HEIGHT - 40, 40, HEIGHT - 80)

    c.setStrokeColor(CYAN)
    c.line(WIDTH - 40, 40, WIDTH - 80, 40)
    c.line(WIDTH - 40, 40, WIDTH - 40, 80)

def concept_1_neon_portal(c):
    """Concept 1: Neon Portal Wordmark"""
    draw_background(c)
    draw_grid_pattern(c, 0.015)

    # Concept number
    c.setFont('GeistMono', 10)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 50, "01")

    # Concept name
    c.setFont('Outfit-Bold', 24)
    c.setFillColor(WHITE)
    c.drawString(50, HEIGHT - 90, "NEON PORTAL WORDMARK")

    # Description
    c.setFont('GeistMono', 9)
    c.setFillColor(GRAY)
    desc_y = HEIGHT - 130
    c.drawString(50, desc_y, "Classic neon signage aesthetic. \"LOST\" in coral,")
    c.drawString(50, desc_y - 14, "\"CITY\" in cyan. The O contains a pulsing portal.")

    # Main logo area
    logo_y = HEIGHT/2 + 50

    # Draw the neon tubes effect for LOST
    draw_neon_text(c, "L", 150, logo_y, 'BigShoulders-Bold', 100, CORAL)

    # Special O with portal
    c.saveState()
    # Portal glow in center of O
    portal_x, portal_y = 230, logo_y + 35
    for i in range(8, 0, -1):
        alpha = 0.08 * (9 - i) / 8
        r = 8 + i * 4
        # Gradient from coral to cyan
        mix = i / 8
        glow_color = Color(
            CORAL.red * mix + CYAN.red * (1-mix),
            CORAL.green * mix + CYAN.green * (1-mix),
            CORAL.blue * mix + CYAN.blue * (1-mix),
            alpha
        )
        c.setFillColor(glow_color)
        c.circle(portal_x, portal_y, r, fill=1, stroke=0)
    c.restoreState()

    draw_neon_text(c, "O", 200, logo_y, 'BigShoulders-Bold', 100, CORAL)
    draw_neon_text(c, "S", 270, logo_y, 'BigShoulders-Bold', 100, CORAL)
    draw_neon_text(c, "T", 330, logo_y, 'BigShoulders-Bold', 100, CORAL)

    # CITY in cyan
    draw_neon_text(c, "CITY", 400, logo_y, 'BigShoulders-Bold', 100, CYAN)

    # Decorative neon tube line
    c.setStrokeColor(CORAL)
    c.setLineWidth(2)
    c.line(150, logo_y - 20, 380, logo_y - 20)
    c.setStrokeColor(CYAN)
    c.line(400, logo_y - 20, 560, logo_y - 20)

    # Usage notes
    c.setFont('GeistMono', 8)
    c.setFillColor(Color(0.35, 0.35, 0.35))
    c.drawString(50, 120, "USE CASES: Signage, app splash, merchandise")
    c.drawString(50, 105, "ANIMATION: Portal pulses, tubes flicker subtly")

def concept_2_digital_cartography(c):
    """Concept 2: Digital Cartography"""
    draw_background(c)
    draw_grid_pattern(c, 0.02)

    # Concept number
    c.setFont('GeistMono', 10)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 50, "02")

    # Concept name
    c.setFont('Outfit-Bold', 24)
    c.setFillColor(WHITE)
    c.drawString(50, HEIGHT - 90, "DIGITAL CARTOGRAPHY")

    # Description
    c.setFont('GeistMono', 9)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 130, "Isometric city buildings with compass rose overlay.")
    c.drawString(50, HEIGHT - 144, "Geographic precision meets urban exploration.")

    # Draw isometric city buildings
    city_x, city_y = WIDTH/2, HEIGHT/2 + 80

    # Building shapes (isometric)
    def draw_iso_building(cx, cy, w, h, depth, color):
        # Front face
        c.setFillColor(color)
        c.setStrokeColor(Color(color.red*0.7, color.green*0.7, color.blue*0.7))
        c.setLineWidth(1)
        path = c.beginPath()
        path.moveTo(cx, cy)
        path.lineTo(cx + w, cy)
        path.lineTo(cx + w, cy + h)
        path.lineTo(cx, cy + h)
        path.close()
        c.drawPath(path, fill=1, stroke=1)

        # Top face
        top_color = Color(color.red*1.2, color.green*1.2, color.blue*1.2)
        c.setFillColor(top_color)
        path = c.beginPath()
        path.moveTo(cx, cy + h)
        path.lineTo(cx + depth, cy + h + depth*0.5)
        path.lineTo(cx + w + depth, cy + h + depth*0.5)
        path.lineTo(cx + w, cy + h)
        path.close()
        c.drawPath(path, fill=1, stroke=1)

        # Side face
        side_color = Color(color.red*0.6, color.green*0.6, color.blue*0.6)
        c.setFillColor(side_color)
        path = c.beginPath()
        path.moveTo(cx + w, cy)
        path.lineTo(cx + w + depth, cy + depth*0.5)
        path.lineTo(cx + w + depth, cy + h + depth*0.5)
        path.lineTo(cx + w, cy + h)
        path.close()
        c.drawPath(path, fill=1, stroke=1)

    # Draw several buildings
    buildings = [
        (city_x - 100, city_y - 60, 40, 100, 15, DARK_GRAY),
        (city_x - 50, city_y - 40, 35, 80, 12, DARK_GRAY),
        (city_x - 10, city_y - 80, 45, 130, 18, DARK_GRAY),
        (city_x + 40, city_y - 50, 38, 90, 14, DARK_GRAY),
        (city_x + 85, city_y - 35, 30, 70, 10, DARK_GRAY),
    ]

    for bx, by, bw, bh, bd, bc in buildings:
        draw_iso_building(bx, by, bw, bh, bd, bc)

    # Compass rose overlay
    compass_x, compass_y = city_x, city_y + 40
    compass_r = 60

    # Compass circle
    c.setStrokeColor(CYAN)
    c.setLineWidth(0.5)
    c.circle(compass_x, compass_y, compass_r, fill=0, stroke=1)
    c.circle(compass_x, compass_y, compass_r * 0.8, fill=0, stroke=1)

    # Compass points
    c.setStrokeColor(CORAL)
    c.setLineWidth(1.5)
    # N
    c.line(compass_x, compass_y + compass_r * 0.3, compass_x, compass_y + compass_r * 1.1)
    # S
    c.setStrokeColor(CYAN)
    c.line(compass_x, compass_y - compass_r * 0.3, compass_x, compass_y - compass_r * 1.1)
    # E
    c.line(compass_x + compass_r * 0.3, compass_y, compass_x + compass_r * 1.1, compass_y)
    # W
    c.line(compass_x - compass_r * 0.3, compass_y, compass_x - compass_r * 1.1, compass_y)

    # Cardinal labels
    c.setFont('GeistMono', 8)
    c.setFillColor(CORAL)
    c.drawCentredString(compass_x, compass_y + compass_r + 18, "N")
    c.setFillColor(CYAN)
    c.drawCentredString(compass_x, compass_y - compass_r - 12, "S")
    c.drawCentredString(compass_x + compass_r + 12, compass_y - 3, "E")
    c.drawCentredString(compass_x - compass_r - 12, compass_y - 3, "W")

    # Wordmark below
    c.setFont('BigShoulders-Bold', 36)
    c.setFillColor(WHITE)
    c.drawCentredString(WIDTH/2, 200, "LOST CITY")

    # Coordinates
    c.setFont('GeistMono', 9)
    c.setFillColor(GRAY)
    c.drawCentredString(WIDTH/2, 175, "33.7490\u00b0 N, 84.3880\u00b0 W")

    # Usage notes
    c.setFont('GeistMono', 8)
    c.setFillColor(Color(0.35, 0.35, 0.35))
    c.drawString(50, 100, "USE CASES: App icon, maps integration, wayfinding")
    c.drawString(50, 85, "VARIATION: Compass rotates to point to nearest event")

def concept_3_terminal_interface(c):
    """Concept 3: Terminal Interface"""
    draw_background(c)
    draw_scanlines(c, 0.025)

    # Concept number
    c.setFont('GeistMono', 10)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 50, "03")

    # Concept name
    c.setFont('Outfit-Bold', 24)
    c.setFillColor(WHITE)
    c.drawString(50, HEIGHT - 90, "TERMINAL INTERFACE")

    # Description
    c.setFont('GeistMono', 9)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 130, "Command-line aesthetic. Hacker culture meets")
    c.drawString(50, HEIGHT - 144, "urban exploration. Blinking cursor invites input.")

    # Terminal window
    term_x, term_y = 100, HEIGHT/2 - 80
    term_w, term_h = WIDTH - 200, 200

    # Window background
    c.setFillColor(Color(0.05, 0.05, 0.05))
    c.setStrokeColor(Color(0.2, 0.2, 0.2))
    c.setLineWidth(1)
    c.roundRect(term_x, term_y, term_w, term_h, 8, fill=1, stroke=1)

    # Title bar
    c.setFillColor(Color(0.12, 0.12, 0.12))
    c.roundRect(term_x, term_y + term_h - 28, term_w, 28, 8, fill=1, stroke=0)

    # Window buttons
    c.setFillColor(Color(0.9, 0.3, 0.3))
    c.circle(term_x + 18, term_y + term_h - 14, 5, fill=1, stroke=0)
    c.setFillColor(Color(0.9, 0.7, 0.2))
    c.circle(term_x + 36, term_y + term_h - 14, 5, fill=1, stroke=0)
    c.setFillColor(Color(0.3, 0.8, 0.3))
    c.circle(term_x + 54, term_y + term_h - 14, 5, fill=1, stroke=0)

    # Terminal title
    c.setFont('GeistMono', 9)
    c.setFillColor(GRAY)
    c.drawCentredString(term_x + term_w/2, term_y + term_h - 18, "lost_city \u2014 bash")

    # Terminal content
    content_y = term_y + term_h - 60
    c.setFont('JetBrainsMono', 12)

    # Previous command
    c.setFillColor(GRAY)
    c.drawString(term_x + 20, content_y, "$ cd ~/atlanta")

    # Current prompt with logo
    content_y -= 30
    c.setFillColor(CYAN)
    c.drawString(term_x + 20, content_y, ">")

    c.setFont('JetBrainsMono', 28)
    c.setFillColor(CORAL)
    c.drawString(term_x + 45, content_y - 5, "LOST")
    c.setFillColor(WHITE)
    c.drawString(term_x + 135, content_y - 5, "_")
    c.setFillColor(CYAN)
    c.drawString(term_x + 155, content_y - 5, "CITY")

    # Blinking cursor (represented as solid block)
    c.setFillColor(CYAN)
    c.rect(term_x + 270, content_y - 5, 16, 24, fill=1, stroke=0)

    # Status line
    content_y -= 50
    c.setFont('JetBrainsMono', 10)
    c.setFillColor(Color(0.3, 0.3, 0.3))
    c.drawString(term_x + 20, content_y, "[discovering events...]")

    # Usage notes
    c.setFont('GeistMono', 8)
    c.setFillColor(Color(0.35, 0.35, 0.35))
    c.drawString(50, 100, "USE CASES: Developer audience, tech events, loading states")
    c.drawString(50, 85, "ANIMATION: Cursor blinks, text types out character by character")

def concept_4_glitch_skyline(c):
    """Concept 4: Glitch City Silhouette"""
    draw_background(c)

    # Concept number
    c.setFont('GeistMono', 10)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 50, "04")

    # Concept name
    c.setFont('Outfit-Bold', 24)
    c.setFillColor(WHITE)
    c.drawString(50, HEIGHT - 90, "GLITCH CITY SILHOUETTE")

    # Description
    c.setFont('GeistMono', 9)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 130, "Atlanta skyline with RGB channel separation.")
    c.drawString(50, HEIGHT - 144, "Digital artifacts reveal the hidden city beneath.")

    # Skyline base y position
    sky_y = HEIGHT/2 - 20

    # Atlanta-inspired skyline buildings (simplified)
    buildings = [
        # (x, width, height) - representing various buildings
        (120, 25, 60),
        (150, 30, 90),
        (185, 20, 70),
        (210, 35, 140),  # Bank of America
        (250, 28, 100),
        (283, 22, 85),
        (310, 40, 160),  # Westin
        (355, 25, 95),
        (385, 32, 75),
        (422, 45, 130),
        (472, 20, 55),
    ]

    # Draw with RGB separation effect
    offsets = [
        (Color(1, 0.2, 0.3, 0.5), -4, 2),   # Red channel
        (Color(0.2, 1, 0.3, 0.4), 0, 0),    # Green channel
        (Color(0.2, 0.5, 1, 0.5), 4, -2),   # Blue channel
    ]

    for color, dx, dy in offsets:
        c.setFillColor(color)
        for bx, bw, bh in buildings:
            c.rect(bx + dx, sky_y + dy, bw, bh, fill=1, stroke=0)

    # Main silhouette on top
    c.setFillColor(Color(0.15, 0.15, 0.15))
    for bx, bw, bh in buildings:
        c.rect(bx, sky_y, bw, bh, fill=1, stroke=0)

    # Glitch lines
    c.saveState()
    for i in range(8):
        y_offset = sky_y + 30 + i * 18
        # Random horizontal displacement
        displacement = (i % 3 - 1) * 8
        c.setFillColor(Color(CORAL.red, CORAL.green, CORAL.blue, 0.3))
        c.rect(100 + displacement, y_offset, 180, 2, fill=1, stroke=0)
        c.setFillColor(Color(CYAN.red, CYAN.green, CYAN.blue, 0.3))
        c.rect(320 + displacement, y_offset, 180, 2, fill=1, stroke=0)
    c.restoreState()

    # Wordmark with glitch
    text_y = 180

    # Glitched copies
    c.setFont('BigShoulders-Bold', 48)
    c.setFillColor(Color(CORAL.red, CORAL.green, CORAL.blue, 0.4))
    c.drawCentredString(WIDTH/2 - 3, text_y + 2, "LOST CITY")
    c.setFillColor(Color(CYAN.red, CYAN.green, CYAN.blue, 0.4))
    c.drawCentredString(WIDTH/2 + 3, text_y - 2, "LOST CITY")

    # Main text
    c.setFillColor(WHITE)
    c.drawCentredString(WIDTH/2, text_y, "LOST CITY")

    # Neon glow line under text
    c.setStrokeColor(CORAL)
    c.setLineWidth(2)
    c.line(WIDTH/2 - 100, text_y - 20, WIDTH/2 - 10, text_y - 20)
    c.setStrokeColor(CYAN)
    c.line(WIDTH/2 + 10, text_y - 20, WIDTH/2 + 100, text_y - 20)

    # Usage notes
    c.setFont('GeistMono', 8)
    c.setFillColor(Color(0.35, 0.35, 0.35))
    c.drawString(50, 100, "USE CASES: Social media, video intros, merch")
    c.drawString(50, 85, "VARIATION: Each portal gets its own city skyline silhouette")

def concept_5_negative_space(c):
    """Concept 5: Negative Space Discovery"""
    draw_background(c)

    # Concept number
    c.setFont('GeistMono', 10)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 50, "05")

    # Concept name
    c.setFont('Outfit-Bold', 24)
    c.setFillColor(WHITE)
    c.drawString(50, HEIGHT - 90, "NEGATIVE SPACE DISCOVERY")

    # Description
    c.setFont('GeistMono', 9)
    c.setFillColor(GRAY)
    c.drawString(50, HEIGHT - 130, "Night cityscape where lit windows spell \"LOST\".")
    c.drawString(50, HEIGHT - 144, "Mystery revealed only to those who look closely.")

    # Stars in sky
    import random
    random.seed(42)  # Consistent stars
    c.setFillColor(WHITE)
    for _ in range(60):
        sx = random.randint(80, int(WIDTH) - 80)
        sy = random.randint(int(HEIGHT/2 + 100), int(HEIGHT) - 180)
        sr = random.uniform(0.3, 1.2)
        alpha = random.uniform(0.3, 0.8)
        c.setFillColor(Color(1, 1, 1, alpha))
        c.circle(sx, sy, sr, fill=1, stroke=0)

    # Building silhouettes
    sky_y = HEIGHT/2 - 50

    # Dark buildings
    buildings_data = [
        # (x, width, height, windows_pattern)
        # windows_pattern: list of (col, row) that should be lit
        (90, 50, 180, [(1, 8), (2, 7), (3, 6)]),  # L
        (150, 45, 160, [(0, 7), (1, 7), (2, 7), (0, 4), (1, 4), (2, 4), (0, 5), (0, 6)]),  # O
        (205, 40, 140, [(0, 6), (1, 6), (2, 6), (1, 5), (1, 4), (0, 3), (1, 3), (2, 3)]),  # S
        (255, 50, 200, [(1, 9), (0, 8), (1, 8), (2, 8), (1, 7), (1, 6)]),  # T
        (320, 35, 120, []),  # spacer
        (365, 55, 170, [(0, 7), (1, 7), (2, 7), (0, 6), (0, 5), (0, 4), (0, 3), (1, 3), (2, 3)]),  # C (partial)
        (430, 40, 150, [(1, 6), (1, 5), (1, 4), (1, 3)]),  # I
        (480, 50, 190, [(0, 8), (2, 8), (1, 7), (1, 6), (1, 5), (1, 4)]),  # T
        (540, 45, 130, [(0, 5), (2, 5), (1, 4), (1, 3), (0, 3), (2, 3)]),  # Y
    ]

    # Draw buildings
    for bx, bw, bh, windows in buildings_data:
        # Building silhouette
        c.setFillColor(Color(0.08, 0.08, 0.1))
        c.rect(bx, sky_y, bw, bh, fill=1, stroke=0)

        # Windows grid
        window_w = 4
        window_h = 5
        cols = int(bw / 12)
        rows = int(bh / 16)

        for col in range(cols):
            for row in range(rows):
                wx = bx + 6 + col * 12
                wy = sky_y + 8 + row * 16

                # Check if this window should be lit (spell LOST)
                is_lit = (col, row) in windows

                if is_lit:
                    # Lit window with warm glow
                    # Glow
                    c.setFillColor(Color(1, 0.9, 0.6, 0.15))
                    c.rect(wx - 2, wy - 2, window_w + 4, window_h + 4, fill=1, stroke=0)
                    # Window
                    c.setFillColor(Color(1, 0.95, 0.8, 0.9))
                    c.rect(wx, wy, window_w, window_h, fill=1, stroke=0)
                else:
                    # Dark window
                    c.setFillColor(Color(0.12, 0.12, 0.15, 0.5))
                    c.rect(wx, wy, window_w, window_h, fill=1, stroke=0)

    # Ground glow
    c.setFillColor(Color(CORAL.red, CORAL.green, CORAL.blue, 0.1))
    c.rect(60, sky_y - 30, WIDTH - 120, 30, fill=1, stroke=0)

    # Subtitle
    c.setFont('GeistMono', 11)
    c.setFillColor(GRAY)
    c.drawCentredString(WIDTH/2, 160, "Find what's hidden")

    # Small CITY text (revealed through context)
    c.setFont('Outfit', 10)
    c.setFillColor(Color(0.4, 0.4, 0.4))
    c.drawCentredString(WIDTH/2, 140, "LOST CITY")

    # Usage notes
    c.setFont('GeistMono', 8)
    c.setFillColor(Color(0.35, 0.35, 0.35))
    c.drawString(50, 100, "USE CASES: Hero images, about pages, brand storytelling")
    c.drawString(50, 85, "VARIATION: Different cities, different word patterns in windows")

def main():
    output_path = "/Users/coach/Projects/LostCity/web/public/lost-city-logo-concepts.pdf"
    c = canvas.Canvas(output_path, pagesize=letter)

    # Page 1: Title
    page_title(c)
    c.showPage()

    # Page 2: Concept 1
    concept_1_neon_portal(c)
    c.showPage()

    # Page 3: Concept 2
    concept_2_digital_cartography(c)
    c.showPage()

    # Page 4: Concept 3
    concept_3_terminal_interface(c)
    c.showPage()

    # Page 5: Concept 4
    concept_4_glitch_skyline(c)
    c.showPage()

    # Page 6: Concept 5
    concept_5_negative_space(c)
    c.showPage()

    c.save()
    print(f"PDF saved to: {output_path}")

if __name__ == "__main__":
    main()
