#!/usr/bin/env python3
"""Compose App Store promotional screenshots from real FlowerSandbox captures."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app_store_assets"
SCREENSHOTS = ASSETS / "screenshots"
DESIGN = ASSETS / "design"
OUTPUT = ASSETS / "promotional"

CANVAS = (1320, 2868)
NAVY = "#182233"
SLATE = "#66758D"
BLUE = "#0A84FF"
WHITE = "#FFFFFF"

FONT_REGULAR = "/System/Library/Fonts/SFNS.ttf"
FONT_ROUNDED = "/System/Library/Fonts/SFNSRounded.ttf"


PROMOS = (
    {
        "file": "01_grow_your_garden.png",
        "source": "iphone67.png",
        "crop": (38, 135, 1282, 2200),
        "title": "Grow a garden\nthat feels like yours",
        "subtitle": "Plant, arrange, and enjoy a peaceful little sandbox.",
        "accent": "#EE6C78",
    },
    {
        "file": "02_make_it_yours.png",
        "source": "iphone67_about.png",
        "crop": (38, 445, 1282, 2220),
        "title": "A calm little place\nto make your own",
        "subtitle": "Simple controls, gentle colors, and room to breathe.",
        "accent": "#799C69",
    },
    {
        "file": "03_more_room_to_grow.png",
        "source": "iphone67_subscription.png",
        "crop": (50, 330, 1270, 2420),
        "cleanup": (1080, 0, 1220, 240),
        "title": "More flowers.\nMore room to grow.",
        "subtitle": "Unlock premium colors, rare varieties, and a larger garden.",
        "accent": "#D79A24",
    },
    {
        "file": "04_garden_everywhere.png",
        "source": "iphone67_login.png",
        "crop": (45, 450, 1275, 2370),
        "title": "Your garden,\nwherever you go",
        "subtitle": "Sign in to keep your subscription and layout in sync.",
        "accent": BLUE,
    },
)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    selected_font: ImageFont.FreeTypeFont,
    fill: str,
    spacing: int = 8,
) -> None:
    box = draw.multiline_textbbox((0, 0), text, font=selected_font, spacing=spacing, align="center")
    width = box[2] - box[0]
    draw.multiline_text(((CANVAS[0] - width) / 2, y), text, font=selected_font, fill=fill, spacing=spacing, align="center")


def compose(spec: dict[str, object], background: Image.Image) -> Image.Image:
    canvas = ImageOps.fit(background, CANVAS, method=Image.Resampling.LANCZOS).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    # Small brand label anchors the set without competing with the benefit headline.
    pill_box = (445, 80, 875, 178)
    draw.rounded_rectangle(pill_box, radius=49, fill=(255, 255, 255, 210), outline=(255, 255, 255, 245), width=3)
    brand_font = font(FONT_REGULAR, 38)
    brand = "FlowerSandbox"
    brand_box = draw.textbbox((0, 0), brand, font=brand_font)
    draw.text(((CANVAS[0] - (brand_box[2] - brand_box[0])) / 2, 105), brand, font=brand_font, fill=NAVY)

    draw_centered_text(draw, str(spec["title"]), 250, font(FONT_ROUNDED, 96), NAVY, spacing=2)
    draw_centered_text(draw, str(spec["subtitle"]), 500, font(FONT_REGULAR, 40), SLATE)

    # Device card and a diffused shadow create the layered App Store look.
    card_xy = (115, 690)
    card_size = (1090, 2060)
    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (card_xy[0] + 8, card_xy[1] + 28, card_xy[0] + card_size[0] + 8, card_xy[1] + card_size[1] + 28),
        radius=92,
        fill=(64, 45, 65, 82),
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(34)))

    card = Image.new("RGBA", card_size, WHITE)
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle((0, 0, card_size[0] - 1, card_size[1] - 1), radius=90, fill=WHITE)

    source = Image.open(SCREENSHOTS / str(spec["source"])).convert("RGB")
    crop = source.crop(tuple(spec["crop"]))
    if "cleanup" in spec:
        # Remove the last few pixels of the Expo development overlay without
        # touching the product UI beneath it.
        cleanup = tuple(spec["cleanup"])
        ImageDraw.Draw(crop).rectangle(cleanup, fill=crop.getpixel((980, 20)))
    viewport_size = (970, 1930)
    # Keep the authentic UI fully visible; do not crop labels merely to fill the frame.
    viewport = Image.new("RGB", viewport_size, crop.getpixel((8, 8)))
    contained = ImageOps.contain(crop, viewport_size, method=Image.Resampling.LANCZOS)
    contained_xy = ((viewport_size[0] - contained.width) // 2, (viewport_size[1] - contained.height) // 2)
    viewport.paste(contained, contained_xy)
    viewport_mask = rounded_mask(viewport_size, 58)
    card.paste(viewport, (60, 65), viewport_mask)

    # Hairline edge and accent bar keep all four panels visually related.
    card_draw.rounded_rectangle((1, 1, card_size[0] - 2, card_size[1] - 2), radius=90, outline=(255, 255, 255, 255), width=5)
    card_draw.rounded_rectangle((435, 24, 655, 35), radius=6, fill=str(spec["accent"]))
    canvas.paste(card, card_xy, rounded_mask(card_size, 90))

    return canvas.convert("RGB")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    background = Image.open(DESIGN / "pastel_garden_background.png")
    for spec in PROMOS:
        output_path = OUTPUT / str(spec["file"])
        compose(spec, background).save(output_path, format="PNG", optimize=True)
        print(output_path)


if __name__ == "__main__":
    main()
