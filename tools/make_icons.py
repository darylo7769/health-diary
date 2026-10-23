from PIL import Image, ImageDraw
import math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

def rounded_gradient(size, radius_ratio=0.22):
    """渐变圆角底图"""
    s = size * 4
    grad = Image.new("RGB", (s, s))
    d = ImageDraw.Draw(grad)
    top, bottom = (244, 114, 154), (251, 176, 196)
    for y in range(s):
        t = y / (s - 1)
        d.line([(0, y), (s, y)], fill=(
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
        ))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out

def draw_heart(d, cx, cy, w, color):
    """贝塞尔心形"""
    pts = []
    steps = 120
    for i in range(steps + 1):
        t = math.pi * 2 * i / steps
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * w / 32, cy + y * w / 32))
    d.polygon(pts, fill=color)

def draw_pulse(d, cx, cy, w, color, thickness):
    """心电折线"""
    pts = [(-0.50, 0), (-0.28, 0), (-0.20, -0.16), (-0.10, 0.30), (0.00, -0.62),
           (0.10, 0.30), (0.19, -0.14), (0.28, 0), (0.50, 0)]
    path = [(cx + px * w, cy + py * w) for px, py in pts]
    d.line(path, fill=color, width=thickness, joint="curve")

def build(size, maskable=False):
    img = rounded_gradient(size, radius_ratio=0 if maskable else 0.22)
    d = ImageDraw.Draw(img)
    scale = 0.58 if maskable else 0.70
    w = size * scale
    cx, cy = size / 2, size / 2

    # 白色心形 + 挖空的心电折线(青色)
    heart_w = w * 0.94
    draw_heart(d, cx, cy + heart_w * 0.08, heart_w, (255, 255, 255, 255))
    draw_pulse(d, cx, cy - heart_w * 0.01, heart_w * 0.78, (232, 90, 134, 255),
               max(4, int(heart_w * 0.10)))
    return img

build(512).save(os.path.join(OUT, "icon-512.png"))
build(192).save(os.path.join(OUT, "icon-192.png"))
build(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
build(180).resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "apple-touch-icon-180.png"))
print("icons generated")
