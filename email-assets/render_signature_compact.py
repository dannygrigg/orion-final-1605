# Compact Orion email-signature card (normal signature size) — 2x retina PNG.
from PIL import Image, ImageDraw, ImageFont
import numpy as np

S = 2
W = 520 * S
PAD = 20 * S

BG1   = "#07111F"
BG2   = "#0B1626"
LINE  = "#16283C"
BORD  = "#123049"
CYAN  = "#00D5FF"
WHITE = "#F7FAFF"
BODY  = "#C6D2E0"
MUT1  = "#A9B8C9"
MUT2  = "#8FA0B5"
MUT3  = "#7D8CA0"
LINK  = "#7FE9FF"
BTN_T = "#00111D"

F = "fonts/"
def font(file, sz): return ImageFont.truetype(F + file, int(sz * S))
serif_r  = lambda sz: font("dmserif-regular.ttf", sz)
serif_it = lambda sz: font("f1.ttf", sz)
inter    = lambda sz: font("f4.ttf", sz)
inter_b  = lambda sz: font("f3.ttf", sz)
inter_eb = lambda sz: font("f2.ttf", sz)
mono_b   = lambda sz: font("f5.ttf", sz)

H = 400 * S
img = Image.new("RGB", (W, H), BG2)
d = ImageDraw.Draw(img)

def tracked(draw, xy, text, fnt, fill, track_em=0.0):
    x, y = xy
    extra = fnt.size * track_em
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + extra
    return x

# ═══ MAIN BLOCK ═══════════════════════════════════════════════════
y = 18 * S
d.rectangle([0, 0, W, 300 * S], fill=BG2)

# left column ------------------------------------------------------
lx = PAD
d.rectangle([lx, y + 4.5 * S, lx + 22 * S, y + 4.5 * S + 1 * S], fill=CYAN)
tracked(d, (lx + 22 * S + 8 * S, y), "DIRECTOR · ORION MIS", mono_b(9), CYAN, 0.14)
y += 9 * S + 7 * S

name_f = serif_r(23)
d.text((lx, y), "Danny Grigg", font=name_f, fill=WHITE)
y += name_f.getbbox("Danny Grigg")[3] + 5 * S
d.text((lx, y), "Director, Orion MIS Limited", font=inter(11), fill=MUT2)
y += 11 * S + 12 * S

rows = [("T", "+44 3333 355 269", WHITE), ("M", "07923 913 445", WHITE),
        ("E", "Danny.Grigg@orionmis.co.uk", LINK), ("W", "orionmis.co.uk", LINK)]
row_h = 11.5 * 1.72 * S
for lab, val, col in rows:
    d.text((lx, y + 2.5 * S), lab, font=mono_b(8.5), fill=CYAN)
    d.text((lx + 16 * S, y), val, font=inter(11.5), fill=col)
    y += row_h
main_bottom = y + 12 * S

# right column: logo + stat ---------------------------------------
logo = Image.open("../images/orion-logo-white.png")
lw = 88 * S
lh_ = int(lw * logo.height / logo.width)
logo = logo.resize((lw, lh_), Image.LANCZOS)
logo_x = W - PAD - lw
img.paste(logo, (logo_x, 22 * S), logo)

stat_y = 22 * S + lh_ + 10 * S
stat_f = serif_it(20)
stat_w = d.textlength("20,000", font=stat_f)
cx = logo_x + lw / 2
d.text((cx - stat_w / 2, stat_y), "20,000", font=stat_f, fill=CYAN)
sub = "PARCELS AN HOUR"
sub_w = sum(d.textlength(c, font=mono_b(7)) + 7 * S * 0.12 for c in sub)
tracked(d, (cx - sub_w / 2, stat_y + 20 * S * 1.15 + 3 * S), sub, mono_b(7), MUT1, 0.12)

CARD_MAIN = int(main_bottom)
d.rectangle([0, CARD_MAIN, W, CARD_MAIN + 1 * S], fill=LINE)

# ═══ PITCH STRIP ══════════════════════════════════════════════════
sy = CARD_MAIN + 1 * S
strip_h = 34 * S
d.rectangle([0, sy, W, sy + strip_h], fill=BG1)
ty = sy + (strip_h - 11 * S) / 2
x = PAD
x = d.textlength("", font=inter_b(11)) + x
d.text((x, ty), "Built in Britain. ", font=inter_b(11), fill=WHITE)
x += d.textlength("Built in Britain. ", font=inter_b(11))
d.text((x, ty), "Run by Helios. ", font=inter_b(11), fill=CYAN)
x += d.textlength("Run by Helios. ", font=inter_b(11))
d.text((x, ty), "Financed by the labour it saves.", font=inter(11), fill=BODY)

cta = "Find out more  →"
cta_f = inter_eb(11)
cta_w = d.textlength(cta, font=cta_f)
bx1 = W - PAD - cta_w - 24 * S
bh = 24 * S
grad = np.zeros((int(bh), int(cta_w + 24 * S), 3), dtype=np.uint8)
c1 = np.array([30, 144, 255]); c2 = np.array([0, 213, 255])
for i in range(grad.shape[1]):
    t = i / max(grad.shape[1] - 1, 1)
    grad[:, i] = (c1 * (1 - t) + c2 * t).astype(np.uint8)
btn = Image.fromarray(grad)
mask = Image.new("L", btn.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, btn.size[0] - 1, btn.size[1] - 1], radius=btn.size[1] // 2, fill=255)
img.paste(btn, (int(bx1), int(sy + (strip_h - bh) / 2)), mask)
d = ImageDraw.Draw(img)
d.text((bx1 + 12 * S, sy + (strip_h - bh) / 2 + (bh - 11 * S) / 2 - 1 * S), cta, font=cta_f, fill=BTN_T)

CARD_H = int(sy + strip_h)

# glows ------------------------------------------------------------
arr = np.array(img.crop((0, 0, W, CARD_H))).astype(np.float32)
yy, xx = np.mgrid[0:CARD_H, 0:W]
def glow(cx_, cy_, radius, rgb, strength):
    dist = np.sqrt((xx - cx_) ** 2 + (yy - cy_) ** 2)
    a = np.clip(1 - dist / radius, 0, 1) ** 2 * strength
    for c in range(3):
        arr[:, :, c] += a * rgb[c]
glow(W * 0.88, 0, W * 0.5, (0, 213, 255), 0.10)
glow(W * 0.04, CARD_H, W * 0.45, (30, 144, 255), 0.07)
card = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

R = 12 * S
m = Image.new("L", (W, CARD_H), 0)
ImageDraw.Draw(m).rounded_rectangle([0, 0, W - 1, CARD_H - 1], radius=R, fill=255)
out = Image.new("RGB", (W, CARD_H), "#FFFFFF")
out.paste(card, (0, 0), m)
ImageDraw.Draw(out).rounded_rectangle([0, 0, W - 1, CARD_H - 1], radius=R, outline=BORD, width=1 * S)

out.save("signature-card-compact.png", optimize=True)
print("saved", out.size, "logical:", W // S, "x", CARD_H // S)
