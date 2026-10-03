#!/usr/bin/env python3
"""Install real JPG files for seasonal blog carousel.

The repository can store the generated images as SVG wrappers with embedded
base64 JPEG data. This script extracts those JPEG payloads into normal .jpg
files and switches the blog carousel links from .svg to .jpg.

Run from repository root:
    python3 scripts/install_blog_realistic_images.py
"""
from pathlib import Path
import base64
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "frontend" / "public" / "blog" / "october"
PAGE_FILE = ROOT / "frontend" / "src" / "app" / "(site)" / "blog" / "[slug]" / "page.tsx"
VERSION = "real20261005"

NAMES = ["sea", "family", "excursions", "cruises"]


def extract_jpg(name: str) -> None:
    svg_path = PUBLIC_DIR / f"{name}.svg"
    jpg_path = PUBLIC_DIR / f"{name}.jpg"

    if not svg_path.exists():
        raise FileNotFoundError(f"Missing source SVG: {svg_path}")

    text = svg_path.read_text(encoding="utf-8")
    match = re.search(r"data:image/jpeg;base64,([^\"']+)", text, re.S)
    if not match:
        raise RuntimeError(f"No embedded JPEG data found in {svg_path}")

    raw = "".join(match.group(1).split())
    raw += "=" * (-len(raw) % 4)
    data = base64.b64decode(raw)

    if not data.startswith(b"\xff\xd8"):
        raise RuntimeError(f"Decoded data is not a JPEG: {svg_path}")

    jpg_path.write_bytes(data)
    print(f"created {jpg_path.relative_to(ROOT)} ({len(data):,} bytes)")


def switch_page_links() -> None:
    text = PAGE_FILE.read_text(encoding="utf-8")

    text = re.sub(
        r'const REALISTIC_SLIDE_VERSION = "[^"]+";',
        f'const REALISTIC_SLIDE_VERSION = "{VERSION}";',
        text,
    )

    replacements = {
        "/blog/october/sea.svg": "/blog/october/sea.jpg",
        "/blog/october/family.svg": "/blog/october/family.jpg",
        "/blog/october/excursions.svg": "/blog/october/excursions.jpg",
        "/blog/october/cruises.svg": "/blog/october/cruises.jpg",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    PAGE_FILE.write_text(text, encoding="utf-8")
    print(f"updated {PAGE_FILE.relative_to(ROOT)} to JPG links, version {VERSION}")


def main() -> None:
    for name in NAMES:
        extract_jpg(name)
    switch_page_links()


if __name__ == "__main__":
    main()
