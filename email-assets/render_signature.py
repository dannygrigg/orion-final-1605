# Renders the Orion email-signature card to a pixel-perfect PNG (2x retina).
# Every colour/size/spacing comes from the approved HTML design.
from PIL import Image, ImageDraw, ImageFont
import numpy as np

S = 2                    # supersample scale (render 2x, ship as width=680)
W = 680 * S
PAD = 32 * S

# ── palette (exact) ──────────────────────────────────────────────
BG1   = "#07111F"   # row 1
BG2   = "#0B1626"   # rows 2-5
LINE  = "#16283C"   # row separators
BORD  = "#123049"   # card border
CYAN  = "#00D5FF"
BLUE  = "#1E90FF"
WHITE = "#F7FAFF"
BODY  = "#C6D2E0"
MUT1  = "#A9B8C9"
MUT2  = "#8FA0B5"
MUT3  = "#7D8CA0"
LINK  = "#7FE9FF"
PILLB = "#252C36"
PILLT = "#767C84"
PILLBG= "#0D1420"
GREEN = "#32D583"
BTN_T = "#00111D"

F = "fonts/"
def font(file, sz): return ImageFont.truetype(F + file, int(sz * S))
serif_i  = font("f1.ttf", 42)
serif_r  = lambda sz: font("dmserif-regular.ttf", sz)
inter    = lambda sz: font("f4.ttf", sz)
inter_b  = lambda sz: font("f3.ttf", sz)
inter_eb = lambda sz: font("f2.ttf", sz)
mono_b   = lambda sz: font("f5.ttf", sz)

H = 1400 * S             # generous canvas; crop at the end
img = Image.new("RGB", (W, H), BG2)
d = ImageDraw.Draw(img)

def tracked(draw, xy, text, fnt, fill, track_em=0.0):
    """draw text with letter-spacing; returns end x"""
    x, y = xy
    extra = fnt.size * track_em
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + extra
    return x

def runs_wrap(draw, x0, y, runs, maxw, lh):
    """word-wrap mixed-font runs: [(text, font, fill), ...]; returns y after."""
    space_w = draw.textlength(" ", font=runs[0][1])
    x = x0
    for text, fnt, fill in runs:
        for word in text.split(" "):
            if not word:
                continue
            wlen = draw.textlength(word, font=fnt)
            if x > x0 and x + wlen > x0 + maxw:
                x = x0
                y += lh
            draw.text((x, y), word, font=fnt, fill=fill)
            x += wlen + space_w
    return y + lh

y = 0
# ═══ ROW 1 ═══════════════════════════════════════════════════════
r1_top = y
d.rectangle([0, y, W, y + 600 * S], fill=BG1)
y += 28 * S

# 20,000 + parcels an hour
d.text((PAD, y), "20,000", font=serif_i, fill=CYAN)
num_w = d.textlength("20,000", font=serif_i)
lab_x = PAD + num_w + 14 * S
num_bottom = y + serif_i.getbbox("20,000")[3] / 1  # baseline-ish bottom of numeral
lab_y = num_bottom - (2 * 10 * 1.5) * S - 2 * S
tracked(d, (lab_x, lab_y), "PARCELS", mono_b(10), MUT1, 0.12)
tracked(d, (lab_x, lab_y + 10 * 1.5 * S), "AN HOUR", mono_b(10), MUT1, 0.12)
y += 42 * S + 12 * S

# headline
hx = tracked(d, (PAD, y), "BUILT IN BRITAIN. ", inter_eb(15), WHITE, 0.03)
tracked(d, (hx, y), "RUN BY HELIOS.", inter_eb(15), CYAN, 0.03)
y += 15 * S + 14 * S

# body copy (mixed bold)
maxw = W - 2 * PAD
y = runs_wrap(d, PAD, y, [
    ("Helix", inter_b(13), WHITE),
    ("delivers the speed.", inter(13), BODY),
    ("Helios", inter_b(13), WHITE),
    ("delivers the intelligence — monitoring performance, predicting problems and continuously improving your warehouse operation.", inter(13), BODY),
], maxw, int(13 * 1.6 * S))
y += 10 * S

y = runs_wrap(d, PAD, y, [
    ("Finance the complete system — the labour it saves pays for it, from month one.", inter_b(13), WHITE),
], maxw, int(13 * 1.6 * S))
y += 18 * S

# gradient pill button
btn_f = inter_eb(14)
btn_label = "Find out more  →"
btn_tw = d.textlength(btn_label, font=btn_f)
bw, bh = int(btn_tw + 44 * S), int(14 * S + 28 * S)
grad = np.zeros((bh, bw, 3), dtype=np.uint8)
c1 = np.array([30, 144, 255]); c2 = np.array([0, 213, 255])
for i in range(bw):
    t = i / max(bw - 1, 1)
    grad[:, i] = (c1 * (1 - t) + c2 * t).astype(np.uint8)
btn = Image.fromarray(grad)
mask = Image.new("L", (bw, bh), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=bh // 2, fill=255)
img.paste(btn, (PAD, int(y)), mask)
bd = ImageDraw.Draw(img)
bd.text((PAD + 22 * S, y + (bh - 14 * S) / 2 - 1 * S), btn_label, font=btn_f, fill=BTN_T)
y += bh + 26 * S

d.rectangle([0, y, W, y + 1 * S], fill=LINE)
r1_bottom = y
y += 1 * S

# ═══ ROW 2 ═══════════════════════════════════════════════════════
y += 24 * S
# logo + right tagline
logo = Image.open("../images/orion-logo-white.png")
lw = 112 * S
lh_ = int(lw * logo.height / logo.width)
logo = logo.resize((lw, lh_), Image.LANCZOS)
img.paste(logo, (PAD, int(y)), logo)
ty = y + lh_ / 2 - 9 * 1.6 * S
for i, t in enumerate(["UK BUILT", "WAREHOUSE AUTOMATION"]):
    fw = sum(d.textlength(c, font=mono_b(9)) + 9 * S * 0.14 for c in t)
    tracked(d, (W - PAD - fw, ty + i * 9 * 1.6 * S), t, mono_b(9), MUT3, 0.14)
y += lh_ + 20 * S

# eyebrow: dash + label
d.rectangle([PAD, y + 5.5 * S, PAD + 32 * S, y + 5.5 * S + 1 * S], fill=CYAN)
tracked(d, (PAD + 32 * S + 12 * S, y), "DIRECTOR · ORION MIS", mono_b(11), CYAN, 0.16)
y += 11 * S + 9 * S

name_f = serif_r(28)
d.text((PAD, y), "Danny Grigg", font=name_f, fill=WHITE)
y += name_f.getbbox("Danny Grigg")[3] + 8 * S
d.text((PAD, y), "Director, Orion MIS Limited", font=inter(13), fill=MUT2)
y += 13 * S + 18 * S

rows = [("T", "+44 3333 355 269", WHITE), ("M", "07923 913 445", WHITE),
        ("E", "Danny.Grigg@orionmis.co.uk", LINK), ("W", "orionmis.co.uk", LINK)]
row_h = 13.5 * 1.85 * S
for lab, val, col in rows:
    d.text((PAD, y + 3 * S), lab, font=mono_b(10), fill=CYAN)
    d.text((PAD + 22 * S + 8 * S, y), val, font=inter(13.5), fill=col)
    y += row_h
y += 18 * S - (row_h - 13.5 * S)

# outline pill
ol_f = inter_eb(14)
ol_label = "All my links  →"
ol_tw = d.textlength(ol_label, font=ol_f)
ow, oh = int(ol_tw + 44 * S), int(14 * S + 28 * S)
d.rounded_rectangle([PAD, y, PAD + ow, y + oh], radius=oh // 2, fill="#070C14", outline="#405670", width=1 * S)
d.text((PAD + 22 * S, y + (oh - 14 * S) / 2 - 1 * S), ol_label, font=ol_f, fill="#FFFFFF")
y += oh + 24 * S
d.rectangle([0, y, W, y + 1 * S], fill=LINE)
y += 1 * S

# ═══ ROW 3 · address ═════════════════════════════════════════════
y += 14 * S
tracked(d, (PAD, y), "HEAD OFFICE", mono_b(10), CYAN, 0.14)
y += 10 * S + 6 * S
d.text((PAD, y), "1 Fontwell Avenue, Chichester, West Sussex, PO20 3RU", font=inter(13), fill=BODY)
y += 13 * S + 14 * S
d.rectangle([0, y, W, y + 1 * S], fill=LINE)
y += 1 * S

# ═══ ROW 4 · certifications ══════════════════════════════════════
y += 16 * S
tracked(d, (PAD, y), "ACCREDITED & RECOGNISED", mono_b(9), MUT3, 0.16)
y += 9 * S + 10 * S
pill_f_b, pill_f = inter_b(13), inter(13)
px = PAD
ph = int(13 * S + 16 * S)
for name, rest in [("ISO 9001 : 2015", "Registered"), ("Avetta", "Approved"), ("IPN", "Company of the Year 2022")]:
    t1w = d.textlength(name, font=pill_f_b)
    sep = "  ·  "
    t2w = d.textlength(sep + rest, font=pill_f)
    pw = int(t1w + t2w + 22 * S)
    d.rounded_rectangle([px, y, px + pw, y + ph], radius=ph // 2, fill=PILLBG, outline=PILLB, width=1 * S)
    tx = px + 11 * S
    d.text((tx, y + 8 * S), name, font=pill_f_b, fill=CYAN)
    d.text((tx + t1w, y + 8 * S), sep + rest, font=pill_f, fill=PILLT)
    px += pw + 8 * S
y += ph + 16 * S
d.rectangle([0, y, W, y + 1 * S], fill=LINE)
y += 1 * S

# ═══ ROW 5 · legal ═══════════════════════════════════════════════
y += 14 * S
legal_lh = int(10.5 * 1.55 * S)
y = runs_wrap(d, PAD, y, [
    ("This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error please notify the sender. Orion MIS Limited is a company registered in England and Wales. Registration Number:", inter(10.5), MUT3),
    ("11735049.", inter_b(10.5), BODY),
    ("Registered Office: 1 Fontwell Avenue, Chichester, PO20 3RU.", inter(10.5), MUT3),
], W - 2 * PAD, legal_lh)
y += 6 * S
d.text((PAD, y), "Please consider the environment before printing this email.", font=inter_b(10.5), fill=GREEN)
y += legal_lh + 18 * S

CARD_H = int(y)

# ── subtle radial glows (site hero treatment) ────────────────────
arr = np.array(img.crop((0, 0, W, CARD_H))).astype(np.float32)
yy, xx = np.mgrid[0:CARD_H, 0:W]
def glow(cx, cy, radius, rgb, strength):
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip(1 - dist / radius, 0, 1) ** 2 * strength
    for c in range(3):
        arr[:, :, c] += a * rgb[c]
glow(W * 0.85, CARD_H * 0.02, W * 0.55, (0, 213, 255), 0.10)
glow(W * 0.06, CARD_H * 0.98, W * 0.5, (30, 144, 255), 0.08)
card = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

# ── rounded corners + border ─────────────────────────────────────
R = 16 * S
m = Image.new("L", (W, CARD_H), 0)
ImageDraw.Draw(m).rounded_rectangle([0, 0, W - 1, CARD_H - 1], radius=R, fill=255)
out = Image.new("RGB", (W, CARD_H), "#0A1018")   # blends into dark; acceptable corner on white too
out.paste(card, (0, 0), m)
ImageDraw.Draw(out).rounded_rectangle([0, 0, W - 1, CARD_H - 1], radius=R, outline=BORD, width=1 * S)

out.save("signature-card.png", optimize=True)
print("saved signature-card.png", out.size, "logical:", W // S, "x", CARD_H // S)
