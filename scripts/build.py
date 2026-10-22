"""
Genera el perfil de GitHub de R4F405: SVG minimalistas animados (tema claro y
oscuro, acento rojo Laravel) y el README que los usa.

    python3 scripts/build.py

Requisitos: fonttools y brotli  (pip install fonttools brotli)
"""
import base64
import io
from pathlib import Path
from xml.sax.saxutils import escape

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = Path(__file__).resolve().parent / "fonts"
RAW = "https://raw.githubusercontent.com/R4F405/R4F405/main/assets"

# ------------------------------------------------------------------ temas
THEMES = {
    "dark": dict(
        text="#e6edf3", muted="#8b949e", soft="#6e7681", line="#30363d",
        card="#161b22", card_line="#262c34", red="#ff2d20", red_soft="#ff6b5e",
        red_tint="#ff2d20", dot="#21262d", bg="#0d1117",
    ),
    "light": dict(
        text="#1f2328", muted="#59636e", soft="#818b98", line="#d1d9e0",
        card="#f6f8fa", card_line="#e1e6eb", red="#e3261a", red_soft="#f0584d",
        red_tint="#ff2d20", dot="#e6eaef", bg="#ffffff",
    ),
}

# ---------------------------------------------------------------- fuentes
FONTS = {
    ("sans", 300, "normal"): "inter-latin-300-normal.woff2",
    ("sans", 400, "normal"): "inter-latin-400-normal.woff2",
    ("sans", 500, "normal"): "inter-latin-500-normal.woff2",
    ("serif", 400, "normal"): "instrument-serif-latin-400-normal.woff2",
    ("serif", 400, "italic"): "instrument-serif-latin-400-italic.woff2",
    ("mono", 400, "normal"): "jetbrains-mono-latin-400-normal.woff2",
    ("mono", 500, "normal"): "jetbrains-mono-latin-500-normal.woff2",
}
FAMILY = {
    "sans": ("R-Inter", "'Inter','Segoe UI',-apple-system,Helvetica,Arial,sans-serif"),
    "serif": ("R-Serif", "'Instrument Serif',Georgia,'Times New Roman',serif"),
    "mono": ("R-Mono", "'JetBrains Mono',Consolas,'DejaVu Sans Mono',monospace"),
}
_tt = {}


def tt(key):
    if key not in _tt:
        _tt[key] = TTFont(FONT_DIR / FONTS[key])
    return _tt[key]


def measure(text, fam, weight=400, size=16, style="normal", spacing=0.0):
    f = tt((fam, weight, style))
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    upm = f["head"].unitsPerEm
    w = 0
    for ch in text:
        g = cmap.get(ord(ch))
        w += hmtx[g][0] if g else upm * 0.5
    return w / upm * size + spacing * len(text)


def wrap(text, width, fam, weight, size, style="normal"):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if measure(t, fam, weight, size, style) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


class Doc:
    """Acumula el texto usado por fuente para incrustar subconjuntos mínimos."""

    def __init__(self, w, h, theme, label):
        self.w, self.h, self.t, self.label = w, h, THEMES[theme], label
        self.used = {}
        self.body = []
        self.css = []
        self.defs = []

    def text(self, x, y, s, fam="sans", weight=400, size=16, style="normal",
             fill=None, anchor="start", spacing=0, cls="", extra=""):
        self.used.setdefault((fam, weight, style), set()).update(s)
        fill = fill or self.t["text"]
        ls = f' letter-spacing="{spacing}"' if spacing else ""
        c = f' class="{cls}"' if cls else ""
        return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FAMILY[fam][0]},{FAMILY[fam][1]}" '
                f'font-weight="{weight}" font-style="{style}" font-size="{size}" fill="{fill}" '
                f'text-anchor="{anchor}"{ls}{c}{extra}>{escape(s)}</text>')

    def rich(self, x, y, parts, size, anchor="start", cls="", extra=""):
        """parts: lista de (texto, fam, weight, style, fill)."""
        spans = []
        for part in parts:
            s, fam, weight, style, fill = part[:5]
            fs = f' font-size="{part[5]}"' if len(part) > 5 else ""
            self.used.setdefault((fam, weight, style), set()).update(s)
            spans.append(f'<tspan{fs} font-family="{FAMILY[fam][0]},{FAMILY[fam][1]}" font-weight="{weight}" '
                         f'font-style="{style}" fill="{fill}">{escape(s)}</tspan>')
        c = f' class="{cls}"' if cls else ""
        return (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}"{c}{extra} '
                f'xml:space="preserve">{"".join(spans)}</text>')

    def add(self, *parts):
        self.body.extend(parts)

    def font_css(self):
        out = []
        for key, chars in self.used.items():
            chars = set(chars) | set(" ")
            f = TTFont(FONT_DIR / FONTS[key])
            opts = Options()
            opts.flavor = "woff2"
            opts.layout_features = ["kern", "liga", "calt"]
            opts.name_IDs = []
            opts.notdef_outline = False
            sub = Subsetter(opts)
            sub.populate(text="".join(chars))
            sub.subset(f)
            buf = io.BytesIO()
            f.flavor = "woff2"
            f.save(buf)
            b64 = base64.b64encode(buf.getvalue()).decode()
            fam, weight, style = key
            out.append(f"@font-face{{font-family:'{FAMILY[fam][0]}';font-weight:{weight};"
                       f"font-style:{style};src:url(data:font/woff2;base64,{b64}) format('woff2')}}")
        return "\n".join(out)

    def svg(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}" fill="none" role="img" aria-label="{escape(self.label)}">\n'
                f'<title>{escape(self.label)}</title>\n<defs>{"".join(self.defs)}<style>\n{self.font_css()}\n'
                f'{BASE_CSS}\n{"".join(self.css)}\n</style></defs>\n' + "\n".join(self.body) + "\n</svg>\n")


EASE = "cubic-bezier(.22,.8,.24,1)"
BASE_CSS = f"""
.fu{{opacity:0;animation:fu 1s {EASE} forwards}}
@keyframes fu{{from{{opacity:0;transform:translateY(14px)}}to{{opacity:1;transform:none}}}}
.fi{{opacity:0;animation:fi 1.2s ease forwards}}
@keyframes fi{{to{{opacity:1}}}}
.draw{{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.6s cubic-bezier(.65,0,.35,1) forwards}}
@keyframes draw{{to{{stroke-dashoffset:0}}}}
.blink{{animation:blink 1.1s steps(1) infinite}}
@keyframes blink{{50%{{opacity:0}}}}
@media (prefers-reduced-motion:reduce){{*{{animation:none!important}}.fu,.fi{{opacity:1}}.draw{{stroke-dashoffset:0}}}}
"""


def d(sec):
    return f' style="animation-delay:{sec:.2f}s"'


ALL = {}


def out(name, build):
    for theme in THEMES:
        doc = build(theme)
        p = ROOT / "assets" / theme / f"{name}.svg"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(doc.svg(), encoding="utf-8")
    ALL[name] = True
    print(f"  {name}.svg")


# ============================================================== HERO
TYPED = [
    "construyo funcionalidades SaaS de punta a punta",
    "escribo el test antes que el código",
    "automatizo lo repetitivo con Python",
    "integro IA en flujos reales de negocio",
]


def hero(theme):
    W, H = 1200, 400
    doc = Doc(W, H, theme, "Hola, soy Rafa — Backend & Laravel Engineer")
    t = doc.t

    # rejilla de puntos con desvanecimiento radial (detrás del dibujo)
    cx, cy = 930, 200
    doc.defs.append(
        f'<radialGradient id="rg" cx="{cx}" cy="{cy}" r="290" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
        f'<mask id="dm"><rect width="{W}" height="{H}" fill="url(#rg)"/></mask>'
        f'<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">'
        f'<circle cx="2" cy="2" r="1.3" fill="{t["soft"]}"/></pattern>')
    doc.add(f'<rect class="fi" width="{W}" height="{H}" fill="url(#dots)" mask="url(#dm)" opacity=".55"{d(.2)}/>')

    # --- texto
    doc.add(f'<g class="fu"{d(.05)}>' + doc.text(4, 74, "BACKEND & LARAVEL ENGINEER", "mono", 500, 13,
                                                 fill=t["red"], spacing=3.2) + "</g>")
    doc.add(f'<g class="fu"{d(.18)}>' + doc.text(0, 138, "Hola, soy", "sans", 300, 44, fill=t["muted"]) + "</g>")
    name_w = measure("Rafa", "serif", 400, 150, "italic")
    doc.add(f'<g class="fu"{d(.32)}>' + doc.rich(-6, 282, [
        ("Rafa", "serif", 400, "italic", t["text"]), (".", "serif", 400, "italic", t["red"])], 150) + "</g>")
    # subrayado que se dibuja
    doc.add(f'<path d="M2 308 H{name_w * .52:.0f}" stroke="{t["red"]}" stroke-width="2" stroke-linecap="round" '
            f'pathLength="1" class="draw"{d(.9)}/>')

    # --- texto que se escribe solo
    tx, ty, fs = 26, 362, 18
    doc.add(f'<g class="fu"{d(1.1)}>' + doc.text(0, ty, "›", "mono", 500, fs, fill=t["red"]) + "</g>")
    n, period = len(TYPED), 18
    for i, s in enumerate(TYPED):
        w = measure(s, "mono", 400, fs) + 2
        st = i / n
        kt = f"0;{st:.3f};{st + .07:.3f};{st + .21:.3f};{st + .235:.3f};1"
        vals = f"0;0;{w:.0f};{w:.0f};0;0"
        xs = ";".join(f"{tx + v + 3:.0f}" for v in (0, 0, w, w, 0, 0))
        doc.defs.append(f'<clipPath id="tc{i}"><rect x="{tx}" y="{ty - 20}" height="30" width="0">'
                        f'<animate attributeName="width" values="{vals}" keyTimes="{kt}" dur="{period}s" '
                        f'begin="1.3s" repeatCount="indefinite"/></rect></clipPath>')
        doc.add(f'<g clip-path="url(#tc{i})">' + doc.text(tx, ty, s, "mono", 400, fs, fill=t["muted"]) + "</g>")
        doc.add(f'<rect x="{tx + 3}" y="{ty - 16}" width="2" height="21" fill="{t["red"]}" opacity="0">'
                f'<animate attributeName="x" values="{xs}" keyTimes="{kt}" dur="{period}s" begin="1.3s" repeatCount="indefinite"/>'
                f'<animate attributeName="opacity" values="0;1;1;1;0;0" keyTimes="{kt}" dur="{period}s" begin="1.3s" '
                f'calcMode="discrete" repeatCount="indefinite"/></rect>')

    # --- dibujo: capas de una arquitectura limpia (isométrico)
    a, b, gap = 150, 75, 74

    def rhomb(y):
        return f"M{cx} {y - b} L{cx + a} {y} L{cx} {y + b} L{cx - a} {y} Z"

    layers = [("HTTP · API", -gap, True), ("DOMINIO", 0, False), ("DATOS", gap, False)]
    doc.css.append(f"""
.lay{{animation:lay 1.1s {EASE} both}}
@keyframes lay{{from{{opacity:0;transform:translateY(-26px)}}to{{opacity:1;transform:none}}}}
.br0{{animation:br0 7s ease-in-out 2.6s infinite}}
.br2{{animation:br2 7s ease-in-out 2.6s infinite}}
@keyframes br0{{50%{{transform:translateY(-12px)}}}}
@keyframes br2{{50%{{transform:translateY(12px)}}}}
""")
    # conectores verticales (detrás)
    for xo in (-a, 0, a):
        yb = b if xo == 0 else 0
        doc.add(f'<path d="M{cx + xo} {cy - gap + yb} V{cy + gap + yb}" stroke="{t["line"]}" stroke-width="1" '
                f'stroke-dasharray="3 5" class="fi"{d(1.6)}/>')
    for i, (lab, yo, top) in reversed(list(enumerate(layers))):
        y = cy + yo
        delay = .5 + (2 - i) * .18
        fill = f'fill="{t["red_tint"]}" fill-opacity=".09"' if top else f'fill="{t["card"]}"'
        stroke = t["red"] if top else t["soft"]
        lx = cx + a + 26
        g = (f'<g class="br{i}"><g class="lay"{d(delay)}>'
             f'<path d="{rhomb(y)}" fill="{t["bg"]}"/>'
             f'<path d="{rhomb(y)}" {fill} stroke="{stroke}" stroke-width="{1.6 if top else 1.2}" stroke-linejoin="round"/>'
             f'<path d="M{cx + a + 6} {y} H{lx + 4}" stroke="{t["line"]}" stroke-width="1"/>'
             + doc.text(lx + 10, y + 4.5, lab, "mono", 500, 11.5, fill=t["red"] if top else t["muted"], spacing=1.6)
             + "</g></g>")
        doc.add(g)
    # punto que recorre la capa superior
    doc.add(f'<g class="br0"><circle r="4" fill="{t["red"]}" opacity="0">'
            f'<animate attributeName="opacity" values="0;1" begin="2.2s" dur=".4s" fill="freeze"/>'
            f'<animateMotion dur="9s" begin="2.2s" repeatCount="indefinite" path="{rhomb(cy - gap)}"/></circle>'
            f'<circle r="10" fill="{t["red"]}" opacity="0">'
            f'<animate attributeName="opacity" values="0;.18;0" begin="2.2s" dur="2.2s" repeatCount="indefinite"/>'
            f'<animateMotion dur="9s" begin="2.2s" repeatCount="indefinite" path="{rhomb(cy - gap)}"/></circle></g>')
    return doc


# ======================================================== SECTION HEADER
def section_header(doc, y, num, title, cmd, delay=0.0):
    t = doc.t
    tw = measure(title, "serif", 400, 44)
    cw = measure(cmd, "mono", 400, 13) + 18
    doc.add(f'<g class="fu"{d(delay)}>' + doc.text(0, y, num, "mono", 500, 13, fill=t["red"], spacing=1) +
            doc.text(38, y + 6, title, "serif", 400, 44) + "</g>")
    x1 = 38 + tw + 26
    x2 = doc.w - cw - 14
    doc.add(f'<path d="M{x1:.0f} {y - 6} H{x2:.0f}" stroke="{t["line"]}" stroke-width="1" pathLength="1" '
            f'class="draw"{d(delay + .25)}/>')
    doc.add(f'<g class="fi"{d(delay + .9)}>' + doc.rich(doc.w, y - 2, [
        ("$ ", "mono", 400, "normal", t["red"]), (cmd, "mono", 400, "normal", t["soft"])], 13, anchor="end") + "</g>")


def sec(num, title, cmd):
    def build(theme):
        doc = Doc(1200, 84, theme, title)
        section_header(doc, 52, num, title, cmd)
        return doc
    return build


# ================================================================ ABOUT
ABOUT_ROWS = [
    ("AHORA", "Full Stack en Softtalia · desde 2025"),
    ("PRODUCTO", "RapidGest — CRM, ~100 equipos"),
    ("ÚLTIMO", "OCR de facturas · chatbot · nóminas"),
    ("STACK", "Laravel · Livewire · MySQL · Python"),
    ("IDIOMAS", "Español · Català · English"),
]


def about(theme):
    W, H = 1200, 420
    doc = Doc(W, H, theme, "Sobre mí")
    t = doc.t
    section_header(doc, 52, "01", "Sobre mí", "php artisan about")
    S, I = ("sans", 300, "normal"), ("serif", 400, "italic")
    lines = [
        [("Desarrollo ", *S), ("productos SaaS", *I), (" en Softtalia,", *S)],
        [("sobre todo RapidGest, un CRM para", *S)],
        [("autónomos y pymes. Hago cada", *S)],
        [("funcionalidad ", *S), ("de principio a fin", *I), (" y", *S)],
        [("hablo con clientes cuando algo falla.", *S)],
    ]
    for i, ln in enumerate(lines):
        parts = [(s, f, w, st, t["red"] if f == "serif" else t["text"], 33 if f == "serif" else 28)
                 for s, f, w, st in ln]
        doc.add(f'<g class="fu"{d(.35 + i * .09)}>' + doc.rich(0, 150 + i * 44, parts, 28) + "</g>")
    # filas a la derecha
    x0, y0, rh = 700, 122, 52
    for i, (k, v) in enumerate(ABOUT_ROWS):
        y = y0 + i * rh
        doc.add(f'<g class="fu"{d(.55 + i * .1)}>' + doc.text(x0, y + 26, k, "mono", 500, 11.5, fill=t["soft"], spacing=2)
                + doc.text(x0 + 118, y + 27, v, "sans", 400, 17) + "</g>")
        doc.add(f'<path d="M{x0} {y + rh - 4} H{W}" stroke="{t["line"]}" stroke-width="1" pathLength="1" class="draw"'
                f'{d(.7 + i * .1)}/>')
    doc.add(f'<path d="M{x0} {y0 - 4} H{W}" stroke="{t["line"]}" stroke-width="1" pathLength="1" class="draw"{d(.6)}/>')
    # pequeño acento
    doc.add(f'<circle cx="{x0 - 30}" cy="{y0 - 4}" r="3.5" fill="{t["red"]}" class="fi"{d(1.2)}/>')
    return doc


# ================================================================ STACK
ROW1 = ["PHP 8.5", "Laravel 12", "Livewire", "Alpine.js", "Tailwind CSS", "MySQL", "Redis", "PestPHP", "Sanctum", "Jetstream"]
ROW2 = ["Python", "FastAPI", "Playwright", "Docker", "Sail", "AWS S3", "GitHub Actions", "CI/CD", "Webhooks",
        "Swagger / OpenAPI", "Git", "Linux"]


def stack(theme):
    W, H = 1200, 250
    doc = Doc(W, H, theme, "Stack: " + ", ".join(ROW1 + ROW2))
    t = doc.t
    section_header(doc, 52, "02", "Stack", "composer show")
    doc.defs.append(
        '<linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset=".1" stop-color="#fff"/>'
        '<stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>'
        f'<mask id="em"><rect width="{W}" height="{H}" fill="url(#edge)"/></mask>')

    def row(items, y, fam, weight, size, color, sep_r, speed, reverse, delay):
        gap = size * 1.4
        xs, x = [], 0.0
        for it in items:
            xs.append(x)
            x += measure(it, fam, weight, size) + gap * 2
        seq = x
        parts = []
        for rep in range(3):
            off = rep * seq
            for it, xi in zip(items, xs):
                parts.append(doc.text(off + xi, y, it, fam, weight, size, fill=color))
                sx = off + xi + measure(it, fam, weight, size) + gap
                parts.append(f'<circle cx="{sx:.1f}" cy="{y - size * .34:.1f}" r="{sep_r}" fill="{t["red"]}"/>')
        name = f"mq{int(y)}"
        frm, to = (f"-{seq:.1f}px", "0") if reverse else ("0", f"-{seq:.1f}px")
        doc.css.append(f".{name}{{animation:{name} {seq / speed:.1f}s linear infinite}}"
                       f"@keyframes {name}{{from{{transform:translateX({frm})}}to{{transform:translateX({to})}}}}")
        doc.add(f'<g mask="url(#em)"><g class="fi"{d(delay)}><g class="{name}">' + "".join(parts) + "</g></g></g>")

    row(ROW1, 152, "serif", 400, 40, t["text"], 3.2, 34, False, .4)
    row(ROW2, 212, "mono", 400, 16, t["muted"], 2.2, 26, True, .7)
    return doc


# ================================================================ CARDS
def card(num, title, kind, desc, tags, delay=0.0):
    def build(theme):
        W, H = 590, 280
        doc = Doc(W, H, theme, f"{title} — {desc}")
        t = doc.t
        doc.defs.append(
            f'<linearGradient id="sw" x1="0" x2="1"><stop offset="0" stop-color="{t["red"]}" stop-opacity="0"/>'
            f'<stop offset=".5" stop-color="{t["red"]}"/><stop offset="1" stop-color="{t["red"]}" stop-opacity="0"/></linearGradient>'
            f'<clipPath id="cc"><rect x="1" y="1" width="{W - 2}" height="{H - 2}" rx="18"/></clipPath>')
        doc.css.append(f"""
.sweep{{animation:sweep 11s {EASE} {delay + 1.4:.2f}s infinite}}
@keyframes sweep{{0%{{transform:translateX(-220px)}}22%,100%{{transform:translateX({W + 40}px)}}}}
.arrow{{animation:arr 1s {EASE} {delay + .8:.2f}s both}}
@keyframes arr{{from{{opacity:0;transform:translate(-8px,8px)}}to{{opacity:1;transform:none}}}}
""")
        doc.add(f'<g class="fi"{d(delay)}><rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="18" '
                f'fill="{t["card"]}" stroke="{t["card_line"]}"/></g>')
        doc.add(f'<g clip-path="url(#cc)"><rect class="sweep" x="0" y="0" width="200" height="1.5" fill="url(#sw)"/></g>')
        P = 36
        doc.add(f'<g class="fu"{d(delay + .15)}>' + doc.rich(P, 58, [
            (num, "mono", 500, "normal", t["red"]), ("   " + kind.upper(), "mono", 400, "normal", t["soft"])],
            12, extra=' letter-spacing="1.8"') + "</g>")
        doc.add(f'<g class="arrow"><path d="M{W - 58} 60 L{W - 38} 40 M{W - 54} 40 H{W - 38} V56" '
                f'stroke="{t["muted"]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>')
        doc.add(f'<g class="fu"{d(delay + .25)}>' + doc.text(P - 2, 118, title, "serif", 400, 40) + "</g>")
        for i, ln in enumerate(wrap(desc, W - 2 * P, "sans", 300, 16)):
            doc.add(f'<g class="fu"{d(delay + .35 + i * .06)}>' + doc.text(P, 160 + i * 25, ln, "sans", 300, 16,
                                                                           fill=t["muted"]) + "</g>")
        parts = []
        for i, tg in enumerate(tags):
            if i:
                parts.append(("  /  ", "mono", 400, "normal", t["red"]))
            parts.append((tg, "mono", 400, "normal", t["soft"]))
        doc.add(f'<g class="fu"{d(delay + .55)}>' + doc.rich(P, H - 34, parts, 12.5) + "</g>")
        doc.add(f'<path d="M{P} {H - 62} H{P + 48}" stroke="{t["red"]}" stroke-width="2" stroke-linecap="round" '
                f'pathLength="1" class="draw"{d(delay + .7)}/>')
        return doc
    return build


PROJECTS = [
    ("rapidgest", "01", "RapidGest", "Producción · Softtalia",
     "CRM para autónomos y pymes. Compras con OCR por IA, chatbot que trabaja sobre el CRM y reparto de nóminas.",
     ["Laravel 12", "Livewire 3", "Redis", "AWS S3"], "https://rapidgest.com/"),
    ("multiscraping", "02", "MultiScraping", "Open source",
     "Suite modular para captar leads desde Google Maps, Instagram y LinkedIn, con panel web unificado y exportación CSV.",
     ["Python", "FastAPI", "Playwright", "Docker"], "https://github.com/R4F405/MultiScraping"),
    ("whistleblowing", "03", "Canal de denuncias", "Privado · Ley 2/2023",
     "Denuncias anónimas o identificadas. No guarda IP ni metadatos del informante; la empresa gestiona los casos desde su panel.",
     ["Laravel 12", "Livewire 3", "MySQL", "Redis"], None),
    ("licitaciones", "04", "Licitaciones", "Privado · Automatización",
     "Buscador de licitaciones públicas sobre los datos abiertos de PLACSP. Descarga los pliegos y los resume con IA.",
     ["Next.js 16", "Prisma", "PostgreSQL", "MiniMax M3"], None),
]

# ============================================================== LAB
ICONS = {
    # trazos en una rejilla de 24x24
    "bot": ["M7 9h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3z", "M12 9V5.8",
            ("c", 12, 4.4, 1.4), "M9.5 13.6v1", "M14.5 13.6v1", "M2 13v2", "M22 13v2"],
    "board": ["M4 5h16v14H4z", "M9.3 5v14", "M14.7 5v14", "M5.6 8h2.2", "M11 8h2.2", "M11 11h2.2", "M16.3 8h2.2"],
    "shield": ["M12 3l7.5 3v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V6z", "M8.8 12.2l2.2 2.2 4.4-4.6"],
    "pin": ["M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z", ("c", 12, 10, 2.5)],
    "net": ["M5 6.5L12 9M5 6.5L12 15M5 12L12 9M5 12L12 15M5 17.5L12 9M5 17.5L12 15M12 9L19 12M12 15L19 12",
            ("n", 5, 6.5), ("n", 5, 12), ("n", 5, 17.5), ("n", 12, 9), ("n", 12, 15), ("n", 19, 12)],
    "image": ["M4 5h16v14H4z", "M4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 17", ("c", 15.5, 9.3, 1.3)],
}

LAB = [
    ("bot", "Git-Discord Sync", "Webhooks que avisan de PRs, workflows y comentarios en Discord.", "PYTHON · AIOHTTP",
     "https://github.com/R4F405/bot-discord-github"),
    ("board", "Jira Agile Bot", "Puente entre Jira y Discord para el día a día del equipo.", "PYTHON · DISCORD.PY",
     "https://github.com/R4F405/discord-jira-bot"),
    ("shield", "FlexBot Mod", "Moderación de servidores y registro de auditoría.", "PYTHON · DISCORD.PY",
     "https://github.com/R4F405/flexbot-moderacion-discord"),
    ("pin", "Maps Scraper GUI", "Interfaz de escritorio para extraer negocios de Google Maps.", "PYTHON · TKINTER",
     "https://github.com/R4F405/google-maps-scrap-automation"),
    ("net", "MNIST Recognizer", "Red neuronal clásica que reconoce dígitos manuscritos.", "PYTHON · TENSORFLOW",
     "https://github.com/R4F405/mnist-number-recognition-python"),
    ("image", "Stable Diffusion", "Generador de imágenes a partir de descripciones en texto.", "PYTHON · PYTORCH",
     "https://github.com/R4F405/python-stable-diffusion-generator"),
]


def lab_tile(icon, title, desc, tag, delay):
    def build(theme):
        W, H = 390, 236
        doc = Doc(W, H, theme, f"{title} — {desc}")
        t = doc.t
        doc.css.append(f".float{{animation:float 6s ease-in-out {delay + 2:.2f}s infinite}}"
                       "@keyframes float{50%{transform:translateY(-3px)}}"
                       ".ico{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.8s cubic-bezier(.65,0,.35,1) forwards}")
        doc.add(f'<g class="fi"{d(delay)}><rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="16" '
                f'fill="{t["card"]}" stroke="{t["card_line"]}"/></g>')
        doc.add(f'<g class="fi"{d(delay + .1)}><rect x="28.5" y="28.5" width="60" height="60" rx="15" fill="none" '
                f'stroke="{t["card_line"]}"/></g>')
        paths = []
        for i, p in enumerate(ICONS[icon]):
            dl = delay + .3 + i * .1
            if isinstance(p, str):
                paths.append(f'<path d="{p}" stroke="{t["red"]}" stroke-width="1.2" stroke-linecap="round" '
                             f'stroke-linejoin="round" pathLength="1" class="ico" style="animation-delay:{dl:.2f}s"/>')
            elif p[0] == "c":
                paths.append(f'<circle cx="{p[1]}" cy="{p[2]}" r="{p[3]}" stroke="{t["red"]}" stroke-width="1.2" '
                             f'pathLength="1" class="ico" style="animation-delay:{dl:.2f}s"/>')
            else:  # nodo relleno
                paths.append(f'<circle cx="{p[1]}" cy="{p[2]}" r="1.7" fill="{t["card"]}" stroke="{t["red"]}" '
                             f'stroke-width="1.2" class="fi" style="animation-delay:{dl + .3:.2f}s"/>')
        doc.add(f'<g class="float"><g transform="translate(41.7 41.7) scale(1.4)">' + "".join(paths) + "</g></g>")
        doc.add(f'<g class="fu"{d(delay + .25)}>' + arrow(W - 30, 34, 10, t["soft"]) + "</g>")
        doc.add(f'<g class="fu"{d(delay + .3)}>' + doc.text(28, 130, title, "sans", 500, 19) + "</g>")
        for i, ln in enumerate(wrap(desc, W - 56, "sans", 300, 14.5)):
            doc.add(f'<g class="fu"{d(delay + .38 + i * .06)}>' + doc.text(28, 158 + i * 21, ln, "sans", 300, 14.5,
                                                                           fill=t["muted"]) + "</g>")
        doc.add(f'<g class="fu"{d(delay + .5)}>' + doc.text(28, H - 24, tag, "mono", 400, 10.5, fill=t["red"], spacing=1.4)
                + "</g>")
        return doc
    return build


def arrow(x, y, size, color, sw=1.5):
    """Flecha ↗ dibujada; (x, y) = esquina superior derecha."""
    return (f'<path d="M{x - size} {y + size} L{x} {y} M{x - size * .72} {y} H{x} V{y + size * .72}" '
            f'stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>')


# ============================================================ CONTACTO
def button(label, delay):
    def build(theme):
        w = int(measure(label, "sans", 500, 15) + 82)
        doc = Doc(w, 48, theme, label)
        t = doc.t
        doc.add(f'<g class="fu"{d(delay)}><rect x=".75" y=".75" width="{w - 1.5}" height="46.5" rx="23.25" '
                f'fill="{t["card"]}" stroke="{t["card_line"]}" stroke-width="1.5"/>'
                f'<circle cx="24" cy="24" r="3.5" fill="{t["red"]}"/>'
                + doc.text(38, 29.5, label, "sans", 500, 15)
                + arrow(w - 22, 19, 9, t["soft"]) + "</g>")
        return doc
    return build


# ============================================================= FOOTER
def footer(theme):
    W, H = 1200, 230
    doc = Doc(W, H, theme, "Si tengo que hacer algo dos veces a mano, a la tercera lo automatizo.")
    t = doc.t
    doc.css.append(".pulse{animation:pulse 3.2s ease-in-out 2s infinite;transform-box:fill-box;transform-origin:center}"
                   "@keyframes pulse{50%{transform:scale(1.7);opacity:.35}}")
    doc.add(f'<path d="M{W / 2} 30 H{W / 2 - 560}" stroke="{t["line"]}" pathLength="1" class="draw"{d(.1)}/>')
    doc.add(f'<path d="M{W / 2} 30 H{W / 2 + 560}" stroke="{t["line"]}" pathLength="1" class="draw"{d(.1)}/>')
    doc.add(f'<g class="fi"{d(.5)}><rect x="{W / 2 - 14}" y="22" width="28" height="16" fill="{t["dot"]}" opacity="0"/>'
            f'<circle cx="{W / 2}" cy="30" r="4" fill="{t["red"]}" class="pulse"/></g>')
    q1 = "“Si tengo que hacer algo dos veces a mano,"
    q2 = "a la tercera lo automatizo.”"
    doc.add(f'<g class="fu"{d(.6)}>' + doc.text(W / 2, 104, q1, "serif", 400, 30, "italic", anchor="middle") + "</g>")
    doc.add(f'<g class="fu"{d(.72)}>' + doc.text(W / 2, 144, q2, "serif", 400, 30, "italic", anchor="middle") + "</g>")
    doc.add(f'<g class="fu"{d(1.0)}>' + doc.text(W / 2, 196, "R4F405", "mono", 400, 11.5,
                                                 fill=t["soft"], anchor="middle", spacing=3) + "</g>")
    return doc


# ============================================================= README
def pic(name, alt, width=None):
    w = f' width="{width}"' if width else ""
    return (f'<picture><source media="(prefers-color-scheme: dark)" srcset="{RAW}/dark/{name}.svg">'
            f'<img src="{RAW}/light/{name}.svg"{w} alt="{escape(alt)}"></picture>')


def readme():
    contact = [
        ("btn-linkedin", "LinkedIn", "https://www.linkedin.com/in/rafaspg"),
        ("btn-email", "Email", "mailto:sanpablorafa@gmail.com"),
        ("btn-portfolio", "Portfolio", "https://r4f405.github.io/Portfolio-Rafa/"),
    ]
    cards = []
    for slug, num, title, kind, desc, tags, url in PROJECTS:
        img = pic(f"card-{slug}", f"{title}: {desc}", "49%")
        cards.append(f'<a href="{url}">{img}</a>' if url else img)
    lab = []
    for i, (icon, title, desc, tag, url) in enumerate(LAB):
        lab.append(f'<a href="{url}">{pic(f"lab-{i + 1}", f"{title}: {desc}", "32%")}</a>')

    md = f"""<!-- Generado con scripts/build.py — edita el script, no este archivo -->

<p align="center">
  {pic("hero", "Hola, soy Rafa — Backend & Laravel Engineer", "100%")}
</p>

<p align="center">
  {" ".join(f'<a href="{u}">{pic(s, l)}</a>' for s, l, u in contact)}
</p>

<br>

<p align="center">
  {pic("about", "Sobre mí: desarrollo productos SaaS en Softtalia, sobre todo RapidGest, un CRM para autónomos y pymes. Hago cada funcionalidad de principio a fin y hablo con clientes cuando algo falla. Full Stack desde 2025. Últimos: OCR de facturas, chatbot, reparto de nóminas. Laravel, Livewire, MySQL, Python. Español, Català, English.", "100%")}
</p>

<br>

<p align="center">
  {pic("stack", "Stack: " + ", ".join(ROW1 + ROW2), "100%")}
</p>

<br>

<p align="center">
  {pic("sec-projects", "03 — Proyectos", "100%")}
</p>

<p align="center">
  {cards[0]}
  {cards[1]}
</p>
<p align="center">
  {cards[2]}
  {cards[3]}
</p>

<br>

<p align="center">
  {pic("sec-lab", "04 — Laboratorio", "100%")}
</p>

<p align="center">
  {lab[0]}
  {lab[1]}
  {lab[2]}
</p>
<p align="center">
  {lab[3]}
  {lab[4]}
  {lab[5]}
</p>

<br>

<p align="center">
  {pic("sec-activity", "05 — Actividad", "100%")}
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/R4F405/R4F405/output/snake-dark.svg">
    <img src="https://raw.githubusercontent.com/R4F405/R4F405/output/snake-light.svg" width="100%" alt="Serpiente recorriendo el gráfico de contribuciones">
  </picture>
</p>

<p align="center">
  {pic("footer", "“Si tengo que hacer algo dos veces a mano, a la tercera lo automatizo.”", "100%")}
</p>
"""
    (ROOT / "README.md").write_text(md, encoding="utf-8")
    print("  README.md")


if __name__ == "__main__":
    print("Generando…")
    out("hero", hero)
    out("about", about)
    out("stack", stack)
    out("sec-projects", sec("03", "Proyectos", "php artisan route:list"))
    out("sec-lab", sec("04", "Laboratorio", "php artisan tinker"))
    out("sec-activity", sec("05", "Actividad", "git log --oneline"))
    for i, (slug, num, title, kind, desc, tags, url) in enumerate(PROJECTS):
        out(f"card-{slug}", card(num, title, kind, desc, tags, delay=(i % 2) * .15))
    for i, (icon, title, desc, tag, url) in enumerate(LAB):
        out(f"lab-{i + 1}", lab_tile(icon, title, desc, tag, delay=(i % 3) * .12))
    for i, (slug, label) in enumerate([("btn-linkedin", "LinkedIn"), ("btn-email", "Email"),
                                       ("btn-portfolio", "Portfolio")]):
        out(slug, button(label, i * .1))
    out("footer", footer)
    readme()
