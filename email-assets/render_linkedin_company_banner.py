# LinkedIn COMPANY page cover (1128x191 logical, 2x retina) — Orion brand system.
# Company pages overlay the square company logo over the bottom-left of the
# cover, and mobile crops the outer edges — so content sits centre-right and
# clears the bottom-left corner entirely.
from PIL import Image, ImageDraw, ImageFont
import numpy as np

S = 2
W, H = 1128 * S, 191 * S

BG2   = "#0B1626"
CYAN  = "#00D5FF"
WHITE = "#F7FAFF"
BODY  = "#C6D2E0"
MUT1  = "#A9B8C9"
BTN_T = "#00111D"

F = "fonts/"
def font(file, sz): return ImageFont.truetype(F + file, int(sz * S))
serif_it = lambda sz: font("f1.ttf", sz)
inter    = lambda sz: font("f4.ttf", sz)
inter_b  = lambda sz: font("f3.ttf", sz)
inter_eb = lambda sz: font("f2.ttf", sz)
mono_b   = lambda sz: font("f5.ttf", sz)

img = Image.new("RGB", (W, H), BG2)
d = ImageDraw.Draw(img)

def tracked(draw, xy, text, fnt, fill, track_em=0.0):
    x, y = xy
    extra = fnt.size * track_em
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + extra
    return x

# content zone: clear of the bottom-left logo overlay and mobile edge crops
LX = 268 * S
RX = W - 56 * S

# eyebrow
ey = 34 * S
d.rectangle([LX, ey + 5 * S, LX + 24 * S, ey + 5 * S + 1.2 * S], fill=CYAN)
tracked(d, (LX + 32 * S, ey), "UK WAREHOUSE AUTOMATION · BUILT IN CHICHESTER", mono_b(11), CYAN, 0.16)

# headline
hy = 58 * S
d.text((LX, hy), "20,000", font=serif_it(48), fill=CYAN)
n_w = d.textlength("20,000", font=serif_it(48))
d.text((LX + n_w + 12 * S, hy + 10 * S), "parcels an hour. Pay monthly.", font=inter_eb(34), fill=WHITE)

# CTA row
cta = "orionmis.co.uk/call"
cta_f = inter_eb(16)
cta_w = d.textlength(cta, font=cta_f)
pad_x, bh = 18 * S, 34 * S
by = 128 * S
grad = np.zeros((int(bh), int(cta_w + pad_x * 2), 3), dtype=np.uint8)
c1 = np.array([30, 144, 255]); c2 = np.array([0, 213, 255])
for i in range(grad.shape[1]):
    t = i / max(grad.shape[1] - 1, 1)
    grad[:, i] = (c1 * (1 - t) + c2 * t).astype(np.uint8)
btn = Image.fromarray(grad)
mask = Image.new("L", btn.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, btn.size[0] - 1, btn.size[1] - 1], radius=btn.size[1] // 2, fill=255)
img.paste(btn, (int(LX), int(by)), mask)
d = ImageDraw.Draw(img)
d.text((LX + pad_x, by + (bh - 16 * S) / 2 - 1 * S), cta, font=cta_f, fill=BTN_T)
tracked(d, (LX + pad_x * 2 + cta_w + 18 * S, by + (bh - 11 * S) / 2),
        "HELIX SORTATION · CONVEYORS · ROBOTICS · WCS INCLUDED", mono_b(10), MUT1, 0.14)

# logo top-right
logo = Image.open("../images/orion-logo-white.png")
lw = 110 * S
lh_ = int(lw * logo.height / logo.width)
logo = logo.resize((lw, lh_), Image.LANCZOS)
img.paste(logo, (RX - lw, 30 * S), logo)

# glows
arr = np.array(img).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W]
def glow(cx_, cy_, radius, rgb, strength):
    dist = np.sqrt((xx - cx_) ** 2 + (yy - cy_) ** 2)
    a = np.clip(1 - dist / radius, 0, 1) ** 2 * strength
    for c in range(3):
        arr[:, :, c] += a * rgb[c]
glow(W * 0.92, 0, W * 0.45, (0, 213, 255), 0.10)
glow(W * 0.25, H, W * 0.40, (30, 144, 255), 0.08)
out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

out.save("linkedin-company-banner.png", optimize=True)
print("saved", out.size, "logical:", W // S, "x", H // S)
