# LinkedIn profile banner (1584x396 logical, 2x retina) — Orion brand system.
# Layout note: LinkedIn overlays the circular profile photo over the bottom-left
# of the banner, so all content sits centre-right and top.
from PIL import Image, ImageDraw, ImageFont
import numpy as np

S = 2
W, H = 1584 * S, 396 * S

BG2   = "#0B1626"
BG1   = "#07111F"
CYAN  = "#00D5FF"
WHITE = "#F7FAFF"
BODY  = "#C6D2E0"
MUT1  = "#A9B8C9"
BTN_T = "#00111D"
BORD  = "#123049"

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

def tracked_w(draw, text, fnt, track_em):
    return sum(draw.textlength(c, font=fnt) + fnt.size * track_em for c in text)

# content zone: x from 560 logical (clear of the profile photo) to W-60
LX = 560 * S
RX = W - 64 * S

# eyebrow
ey = 74 * S
d.rectangle([LX, ey + 6 * S, LX + 30 * S, ey + 6 * S + 1.4 * S], fill=CYAN)
tracked(d, (LX + 40 * S, ey), "UK WAREHOUSE AUTOMATION · BUILT IN CHICHESTER", mono_b(13), CYAN, 0.16)

# headline: 20,000 parcels an hour.
hy = 108 * S
d.text((LX, hy), "20,000", font=serif_it(72), fill=CYAN)
n_w = d.textlength("20,000", font=serif_it(72))
d.text((LX + n_w + 18 * S, hy + 14 * S), "parcels an hour.", font=inter_eb(52), fill=WHITE)

# subline
sy = hy + 92 * S
x = LX
x = d.text((x, sy), "Built in Britain. ", font=inter_b(24), fill=WHITE) or x
x = LX + d.textlength("Built in Britain. ", font=inter_b(24))
d.text((x, sy), "Run by Helios. ", font=inter_b(24), fill=CYAN)
x += d.textlength("Run by Helios. ", font=inter_b(24))
d.text((x, sy), "Pay monthly — the labour it saves covers the payment.", font=inter(24), fill=BODY)

# CTA pill: orionmis.co.uk/call
cta = "orionmis.co.uk/call"
cta_f = inter_eb(22)
cta_w = d.textlength(cta, font=cta_f)
pad_x, bh = 26 * S, 48 * S
by = sy + 52 * S
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
d.text((LX + pad_x, by + (bh - 22 * S) / 2 - 1 * S), cta, font=cta_f, fill=BTN_T)
tracked(d, (LX + pad_x * 2 + cta_w + 24 * S, by + (bh - 13 * S) / 2), "BOOK A 30-MIN CALL · NO DECK, JUST NUMBERS", mono_b(12), MUT1, 0.14)

# logo top-right
logo = Image.open("../images/orion-logo-white.png")
lw = 150 * S
lh_ = int(lw * logo.height / logo.width)
logo = logo.resize((lw, lh_), Image.LANCZOS)
img.paste(logo, (RX - lw, 52 * S), logo)

# glows
arr = np.array(img).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W]
def glow(cx_, cy_, radius, rgb, strength):
    dist = np.sqrt((xx - cx_) ** 2 + (yy - cy_) ** 2)
    a = np.clip(1 - dist / radius, 0, 1) ** 2 * strength
    for c in range(3):
        arr[:, :, c] += a * rgb[c]
glow(W * 0.92, 0, W * 0.45, (0, 213, 255), 0.10)
glow(W * 0.30, H, W * 0.42, (30, 144, 255), 0.08)
glow(0, 0, W * 0.35, (30, 144, 255), 0.05)
out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

out.save("linkedin-banner.png", optimize=True)
print("saved", out.size, "logical:", W // S, "x", H // S)
