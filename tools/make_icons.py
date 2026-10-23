"""Generate launcher icons for the 涨停六线计算器 Android app."""
from PIL import Image, ImageDraw

OUT = r"C:\Users\Administrator\Documents\deepseek-harness\default-workspace\zhangting-sixline\app\src\main\res"

DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def gradient(size, top=(214, 43, 43), bottom=(143, 17, 17)):
    img = Image.new("RGB", (size, 1))
    px = img.load()
    for x in range(size):
        t = x / max(1, size - 1)
        px[x, 0] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((size, size))


def draw_bars(draw, size, color, width_ratio=0.58, bottom_ratio=0.80):
    """Six ascending vertical bars, white, centred."""
    total_w = size * width_ratio
    gap = total_w / 9.75 * 0.75
    bar_w = (total_w - 5 * gap) / 6
    left = (size - total_w) / 2
    baseline = size * bottom_ratio
    heights = [0.20, 0.28, 0.36, 0.44, 0.52, 0.60]
    for i, h in enumerate(heights):
        x0 = left + i * (bar_w + gap)
        y0 = baseline - size * h
        draw.rounded_rectangle(
            [x0, y0, x0 + bar_w, baseline],
            radius=bar_w / 2,
            fill=color,
        )


def square_icon(size):
    scale = 8
    s = size * scale
    img = gradient(s).convert("RGBA")
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=255)
    img.putalpha(mask)
    draw = ImageDraw.Draw(img)
    draw_bars(draw, s, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def round_icon(size):
    scale = 8
    s = size * scale
    img = gradient(s).convert("RGBA")
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s - 1, s - 1], fill=255)
    img.putalpha(mask)
    draw = ImageDraw.Draw(img)
    draw_bars(draw, s, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def adaptive_foreground(size):
    scale = 8
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_bars(draw, s, (255, 255, 255, 255), width_ratio=0.55, bottom_ratio=0.75)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    import os

    for density, size in DENSITIES.items():
        folder = os.path.join(OUT, f"mipmap-{density}")
        os.makedirs(folder, exist_ok=True)
        square_icon(size).save(os.path.join(folder, "ic_launcher.png"))
        round_icon(size).save(os.path.join(folder, "ic_launcher_round.png"))
        adaptive_foreground(size).save(os.path.join(folder, "ic_launcher_foreground.png"))
        print("wrote", folder, size)
