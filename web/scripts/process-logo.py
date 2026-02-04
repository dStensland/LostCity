#!/usr/bin/env python3
"""Process generated portal logos and header backgrounds.

Usage:
  python scripts/process-logo.py

Expects generated images in generated-images/:
  atlanta-logo.png, nashville-logo.png, atlanta-header-bg.png, nashville-header-bg.png

Outputs processed images to public/portals/{slug}/:
  logo.png (480x120, transparent background)
  header-bg.png (2560x200, dark atmospheric)
"""

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("PIL not found. Install with: pip install Pillow")
    sys.exit(1)


def remove_black_background(img: Image.Image, threshold: int = 40) -> Image.Image:
    """Remove black/near-black background using flood fill from corners."""
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size

    visited = set()
    # Flood fill from all four corners
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    # Also add edge midpoints for better coverage
    seeds += [(w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]

    for seed in seeds:
        stack = [seed]
        while stack:
            x, y = stack.pop()
            if (x, y) in visited or x < 0 or x >= w or y < 0 or y >= h:
                continue
            r, g, b, a = pixels[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                pixels[x, y] = (0, 0, 0, 0)
                visited.add((x, y))
                stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
            else:
                visited.add((x, y))

    return img


def process_logo(input_path: Path, output_path: Path) -> None:
    """Remove background from logo, crop to content, and resize for retina display."""
    print(f"Processing logo: {input_path} -> {output_path}")
    img = Image.open(input_path)
    img = remove_black_background(img, threshold=25)

    # Crop to content bounding box (remove empty transparent space)
    bbox = img.getbbox()
    if bbox:
        # Add small padding around content (5% of dimensions)
        pad_x = max(4, int((bbox[2] - bbox[0]) * 0.05))
        pad_y = max(4, int((bbox[3] - bbox[1]) * 0.05))
        crop_box = (
            max(0, bbox[0] - pad_x),
            max(0, bbox[1] - pad_y),
            min(img.width, bbox[2] + pad_x),
            min(img.height, bbox[3] + pad_y),
        )
        img = img.crop(crop_box)
        print(f"  Cropped to content: {img.width}x{img.height}")

    # Scale to fill 160px height (retina 2x = 320px) while maintaining aspect ratio
    target_h = 320
    scale = target_h / img.height
    target_w = int(img.width * scale)
    img = img.resize((target_w, target_h), Image.LANCZOS)

    img.save(output_path, "PNG")
    print(f"  Saved: {output_path} ({img.width}x{img.height})")


def process_header_bg(input_path: Path, output_path: Path) -> None:
    """Resize header background to 2560x200 panoramic strip."""
    print(f"Processing header bg: {input_path} -> {output_path}")
    img = Image.open(input_path).convert("RGB")
    # Crop to wide panoramic strip from the middle
    w, h = img.size
    target_ratio = 2560 / 200  # 12.8:1
    current_ratio = w / h

    if current_ratio < target_ratio:
        # Image is too tall, crop height
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))
    else:
        # Image is too wide, crop width
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))

    img = img.resize((2560, 200), Image.LANCZOS)
    # Flip vertically so skyline glow is at the bottom edge (for bottom-anchored CSS)
    img = img.transpose(Image.FLIP_TOP_BOTTOM)
    img.save(output_path, "PNG", optimize=True)
    print(f"  Saved: {output_path} ({img.size[0]}x{img.size[1]})")


def main():
    base = Path(__file__).parent.parent
    gen_dir = base / "generated-images"
    portals_dir = base / "public" / "portals"

    pairs = [
        ("atlanta", "atlanta-logo.png", "logo.png", process_logo),
        ("nashville", "nashville-logo.png", "logo.png", process_logo),
        ("atlanta", "atlanta-header-bg.png", "header-bg.png", process_header_bg),
        ("nashville", "nashville-header-bg.png", "header-bg.png", process_header_bg),
    ]

    for portal_slug, input_name, output_name, processor in pairs:
        input_path = gen_dir / input_name
        output_dir = portals_dir / portal_slug
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / output_name

        if not input_path.exists():
            print(f"  SKIP: {input_path} not found")
            continue

        processor(input_path, output_path)

    print("\nDone! Processed images in public/portals/")


if __name__ == "__main__":
    main()
