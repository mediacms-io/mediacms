import colorsys
import hashlib
import math
import os
import random
import re
import unicodedata
from functools import lru_cache
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from fontTools.ttLib import TTFont
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, features

HAS_RAQM = features.check("raqm")
ZWJ, ZWNJ = "‍", "‌"
WORD_SPLIT = re.compile(r"[\s\-‐‑·・‧._]+")
FONT_EXT = (".ttf", ".otf", ".ttc")
IGNORED_CPS = {ord(ZWJ), ord(ZWNJ)} | set(range(0xFE00, 0xFE10))
SKIPPED_FONTS = ("mono", "math", "symbol", "emoji", "dingbat", "icon", "awesome", "glyphicons")
FONT_DIRS = ["/usr/share/fonts", os.path.join(settings.BASE_DIR, "static/lib/gfonts")]


def graphemes(text):
    out = []
    for ch in text:
        if out:
            prev = out[-1][-1]
            joins = [
                unicodedata.category(ch).startswith("M"),
                ch in (ZWJ, ZWNJ),
                0xFE00 <= ord(ch) <= 0xFE0F,
                prev == ZWJ,
                unicodedata.combining(prev) == 9 and unicodedata.category(ch).startswith("L"),
            ]
            if any(joins):
                out[-1] += ch
                continue
        out.append(ch)
    return out


def is_letter(g):
    return unicodedata.category(g[0]).startswith("L")


def is_rtl(text):
    return any(unicodedata.bidirectional(c) in ("R", "AL") for c in text)


def to_upper(g):
    up = unicodedata.normalize("NFC", g[0].title() + g[1:])
    return up if len(graphemes(up)) == 1 else g


def to_lower(g):
    lo = unicodedata.normalize("NFC", g.lower())
    return lo if len(graphemes(lo)) == 1 else g


def initials(name, fonts):
    firsts = []
    for word in WORD_SPLIT.split(name):
        letters = [g for g in graphemes(word) if is_letter(g) and fonts.covers(to_upper(g))]
        if letters:
            firsts.append(to_upper(letters[0]))
    if not firsts:
        return ""
    parts = firsts[:1] if len(firsts) == 1 else [firsts[0], firsts[-1]]
    if is_rtl("".join(parts)):
        if HAS_RAQM:
            return ZWNJ.join(parts)
        parts.reverse()
    return "".join(parts)


def font_rank(path):
    n = os.path.basename(path).lower()
    if n.startswith("roboto"):
        return 0
    if n.startswith("noto") and "cjk" not in n:
        return 1
    if "dejavu" in n:
        return 2
    if "cjk" in n:
        return 4
    return 3


def font_info(path):
    try:
        tt = TTFont(path, fontNumber=0, lazy=True)
        if any(t in tt for t in ("CBDT", "sbix", "SVG ")):
            return None
        cmap = set(tt.getBestCmap() or {})
        os2 = tt["OS/2"] if "OS/2" in tt else None
        family = (tt["name"].getDebugName(1) or "").lower() if "name" in tt else ""
        tt.close()
    except Exception:
        return None
    weight = os2.usWeightClass if os2 else 400
    italic = bool(os2 and os2.fsSelection & 1)
    if italic or weight < 350 or any(k in family or k in os.path.basename(path).lower() for k in SKIPPED_FONTS):
        return None
    family_class = (os2.sFamilyClass >> 8) if os2 else 0
    if ("serif" in family and "sans" not in family) or 1 <= family_class <= 7:
        return cmap, "serif"
    return cmap, "bold" if weight >= 600 else "regular"


class FontLibrary:
    def __init__(self, dirs):
        paths = {os.path.join(root, f) for d in dirs if os.path.isdir(d) for root, _, files in os.walk(d) for f in files if f.lower().endswith(FONT_EXT)}
        ordered = sorted(paths, key=lambda p: (font_rank(p), os.path.basename(p).lower()))
        self.fonts = [(p, info) for p in ordered if (info := font_info(p))]
        self.picks = {}
        self.loaded = {}

    def path_for(self, text, style):
        key = (text, style)
        if key not in self.picks:
            need = {ord(c) for c in text} - IGNORED_CPS
            covering = [(path, font_style) for path, (cmap, font_style) in self.fonts if need <= cmap]
            fallback = covering[0][0] if covering else None
            self.picks[key] = next((path for path, font_style in covering if font_style == style), fallback)
        return self.picks[key]

    def covers(self, text):
        return self.path_for(text, "bold") is not None

    def get(self, text, style, size):
        key = (self.path_for(text, style), size)
        if key not in self.loaded:
            self.loaded[key] = ImageFont.truetype(key[0], size)
        return self.loaded[key]


@lru_cache(maxsize=1)
def font_library():
    return FontLibrary(FONT_DIRS)


def hsl(h, s, lightness):
    r, g, b = colorsys.hls_to_rgb(h % 1.0, lightness, s)
    return int(r * 255), int(g * 255), int(b * 255)


def make_palette(rng):
    base = rng.randrange(16) / 16 + rng.uniform(-0.015, 0.015)
    scheme = rng.choice(["analogous", "complementary", "triadic", "split"])
    if scheme == "analogous":
        hues = [base + d for d in (-0.08, -0.04, 0.0, 0.04, 0.08)]
    elif scheme == "complementary":
        hues = [base, base + 0.03, base + 0.5, base + 0.47, base - 0.03]
    elif scheme == "triadic":
        hues = [base, base + 1 / 3, base + 2 / 3, base + 0.05, base + 1 / 3 + 0.05]
    else:
        hues = [base, base + 0.42, base + 0.58, base + 0.04, base + 0.46]

    if rng.random() < 0.6:
        bg = hsl(base, rng.uniform(0.35, 0.55), rng.uniform(0.11, 0.17))
        cloud = [hsl(h, rng.uniform(0.55, 0.85), rng.uniform(0.55, 0.75)) for h in hues]
        accent = hsl(hues[0], 0.85, 0.80)
    else:
        bg = hsl(base, rng.uniform(0.30, 0.55), rng.uniform(0.92, 0.96))
        cloud = [hsl(h, rng.uniform(0.55, 0.80), rng.uniform(0.35, 0.55)) for h in hues]
        accent = hsl(hues[0], 0.75, 0.25)
    return bg, accent, cloud


def render_glyph(text, font, angle):
    kw = {"direction": "rtl"} if HAS_RAQM and is_rtl(text) else {}
    left, top, right, bottom = font.getbbox(text, **kw)
    pad = 4
    img = Image.new("L", (max(1, right - left) + 2 * pad, max(1, bottom - top) + 2 * pad), 0)
    ImageDraw.Draw(img).text((pad - left, pad - top), text, font=font, fill=255, **kw)
    if angle:
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def generate_logo(name, size=200):
    fonts = font_library()
    name = unicodedata.normalize("NFC", name or "").strip()
    letters = [g for g in graphemes(name) if is_letter(g) and fonts.covers(g) and fonts.covers(to_upper(g))]
    if not letters:
        return None

    rng = random.Random(int(hashlib.sha256(name.lower().encode()).hexdigest(), 16))
    n = size * 2
    bg, accent, cloud = make_palette(rng)
    canvas = Image.new("RGB", (n, n), bg)
    allowed = Image.new("L", (n, n), 0)
    inset = int(n * 0.06)
    ImageDraw.Draw(allowed).ellipse((inset, inset, n - inset - 1, n - inset - 1), fill=255)
    occupied = Image.new("L", (n, n), 0)
    margin = max(3, int(n * 0.006)) | 1

    def try_place(glyph, tries, centre_bias):
        solid = glyph.point(lambda v: 255 if v > 40 else 0)
        padded = solid.filter(ImageFilter.MaxFilter(margin))
        gw, gh = glyph.size
        if gw >= n or gh >= n:
            return None
        for _ in range(tries):
            if rng.random() < centre_bias:
                r = rng.random() ** 0.5 * n * 0.35
                a = rng.random() * math.tau
                x, y = int(n / 2 + r * math.cos(a) - gw / 2), int(n / 2 + r * math.sin(a) - gh / 2)
            else:
                x, y = rng.randrange(0, n - gw), rng.randrange(0, n - gh)
            box = (x, y, x + gw, y + gh)
            if x < 0 or y < 0 or box[2] > n or box[3] > n:
                continue
            if ImageChops.subtract(solid, allowed.crop(box)).getbbox():
                continue
            if ImageChops.multiply(padded, occupied.crop(box)).getbbox():
                continue
            occupied.paste(255, box, padded)
            return x, y
        return None

    def stamp(glyph, xy, colour, alpha=255):
        canvas.paste(colour, (xy[0], xy[1], xy[0] + glyph.width, xy[1] + glyph.height), glyph.point(lambda v: v * alpha // 255))

    hero = initials(name, fonts)
    if hero:
        ini_size = int(n * (0.42 if len(graphemes(hero.replace(ZWNJ, ""))) == 1 else 0.34))
        glyph = render_glyph(hero, fonts.get(hero, rng.choice(["bold", "bold", "serif"]), ini_size), rng.uniform(-6, 6))
        limit = int(n * 0.70)
        if max(glyph.size) > limit:
            k = limit / max(glyph.size)
            glyph = glyph.resize((max(1, int(glyph.width * k)), max(1, int(glyph.height * k))), Image.LANCZOS)
        gw, gh = glyph.size
        x, y = (n - gw) // 2, (n - gh) // 2
        halo_y, halo_x = int(n * 0.035), int(n * 0.07)
        occupied.paste(255, (max(0, x - halo_x), max(0, y - halo_y), min(n, x + gw + halo_x), min(n, y + gh + halo_y)))
        shadow = glyph.filter(ImageFilter.GaussianBlur(n * 0.012))
        shadow_xy = (min(n - gw, x + int(n * 0.006)), min(n - gh, y + int(n * 0.01)))
        stamp(shadow, shadow_xy, (0, 0, 0), 70)
        stamp(glyph, (x, y), accent)

    rng.shuffle(letters)
    max_frac, min_frac = 0.20, 0.035
    sizes = []
    f = max_frac
    while f >= min_frac:
        sizes.append(f)
        f *= 0.86

    idx = 0
    for step, frac in enumerate(sizes):
        px = max(8, int(n * frac))
        failures, placed = 0, 0
        while placed < 3 + step * 2 and failures < 6:
            ch = letters[idx % len(letters)]
            idx += 1
            lower = to_lower(ch)
            ch = lower if frac < 0.08 and rng.random() < 0.5 and fonts.covers(lower) else to_upper(ch)
            style = rng.choices(["bold", "regular", "serif"], [5, 3, 2])[0]
            angle = rng.choice([0, 0, 0, 90, -90]) if rng.random() < 0.25 else rng.gauss(0, 14)
            glyph = render_glyph(ch, fonts.get(ch, style, px), angle)
            pos = try_place(glyph, 140, 0.6 if frac > 0.1 else 0.3)
            if pos is None:
                failures += 1
                continue
            placed += 1
            alpha = int(255 * (0.55 + 0.45 * (frac - min_frac) / (max_frac - min_frac)))
            stamp(glyph, pos, rng.choice(cloud), max(110, min(255, alpha + rng.randint(-25, 25))))

    return canvas.resize((size, size), Image.LANCZOS)


def letter_cloud_logo(name):
    image = generate_logo(name)
    if image is None:
        return None
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return ContentFile(buffer.getvalue())
