from PIL import Image, ImageDraw, ImageFont
import os

for size in [192, 512]:
    img = Image.new("RGB", (size, size), color="#0f172a")
    draw = ImageDraw.Draw(img)

    # Try to use a default font, fallback to default if not available
    try:
        font_size = int(size * 0.4)
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()

    text = "ET"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) / 2
    y = (size - text_height) / 2 - bbox[1]

    draw.text((x, y), text, fill="#38bdf8", font=font)

    output_path = f"static/icon-{size}x{size}.png"
    img.save(output_path)
    print(f"Created {output_path}")

print("Done!")
