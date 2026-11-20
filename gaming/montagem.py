"""Montagem dos Shorts no modelo escolhido pelo dono (19-nov-2026).

One format only, copied from the reference Short the owner sent (a gameplay
reaction with the streamer's webcam on top):

  com webcam   dark purple background with a magenta glow; the webcam in a
               card with rounded corners and a thin neon border on top
               (x 44-1036, y 84-716); the game full width and full height from
               the seam down (y 760-1920, sides cropped like any Short). The
               title (a torn red paper strip) sits on the seam - drawn by
               gaming/acabamento.py.
  sem webcam   the game fills the whole phone screen.

Pure ffmpeg plus two still images drawn once with PIL (background + neon
frame, and the rounded-corner mask). A sidecar <clip>.montagem.json tells the
finishing step where the title and captions go.
"""
import json
import os
import subprocess
import tempfile

from ffmpeg_utils import METADATA_SCRUB, QUALITY_FAST, audio_encode_args, video_encode_args

W, H = 1080, 1920
TOPO_SEGURO = 200          # platform UI over the top ~10%
BASE_SEGURA = 1420         # nothing important below this (Reels/TikTok UI)
CARTAO = (44, 84, 992, 632)   # webcam card: x, y, w, h
RAIO = 34
Y_JOGO = 760               # the game starts here when the webcam is on top
CAM_H = Y_JOGO             # kept for callers: height of the camera area


def _par(n):
    n = int(round(n))
    return n - (n % 2)


def geometria(src_w, src_h, cam=None):
    """Where things go on the 1080x1920 canvas."""
    if cam:
        x, y, w, h = CARTAO
        return {"tipo": "shorts_cam", "jogo": [Y_JOGO, H], "cam": [y, y + h],
                "titulo_y": Y_JOGO + 86, "legenda_base": BASE_SEGURA}
    return {"tipo": "shorts", "jogo": [0, H], "cam": None,
            "titulo_y": TOPO_SEGURO + 170, "legenda_base": BASE_SEGURA}


def desenhar_fundo(pasta):
    """Background + neon card frame (1080x1920) and the card's rounded mask."""
    from PIL import Image, ImageDraw, ImageFilter
    fundo = Image.new("RGB", (W, H), (20, 6, 30))
    d = ImageDraw.Draw(fundo)
    for yy in range(Y_JOGO + 40):
        t = yy / (Y_JOGO + 40)
        # deep purple at the top, a warmer magenta towards the seam
        d.line([(0, yy), (W, yy)], fill=(int(46 + 52 * t), int(10 + 8 * t), int(70 + 40 * t)))
    x, y, w, h = CARTAO
    brilho = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(brilho)
    bd.rounded_rectangle([x - 14, y - 14, x + w + 14, y + h + 14], RAIO + 12, fill=(214, 64, 255, 150))
    brilho = brilho.filter(ImageFilter.GaussianBlur(26))
    fundo = Image.alpha_composite(fundo.convert("RGBA"), brilho)
    d = ImageDraw.Draw(fundo)
    d.rounded_rectangle([x - 4, y - 4, x + w + 4, y + h + 4], RAIO + 4, outline=(250, 196, 255, 255), width=4)
    caminho_fundo = os.path.join(pasta, "fundo.png")
    fundo.convert("RGB").save(caminho_fundo)
    mascara = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, w - 1, h - 1], RAIO, fill=255)
    caminho_mascara = os.path.join(pasta, "mascara.png")
    mascara.save(caminho_mascara)
    return caminho_fundo, caminho_mascara


def filtergraph(src_w, src_h, cam=None):
    """ffmpeg filter_complex; inputs: 0 video, 1 background, 2 card mask. Output [v]."""
    g = geometria(src_w, src_h, cam)
    if not cam:
        return (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[v]", g)
    x, y, w, h = (int(v) for v in cam)
    cx, cy, cw, ch = CARTAO
    jogo_h = H - Y_JOGO
    partes = [
        "[0:v]split[a][b]",
        f"[a]scale={W}:{jogo_h}:force_original_aspect_ratio=increase,crop={W}:{jogo_h}[jogo]",
        f"[b]crop={w}:{h}:{x}:{y},scale={cw}:{ch}:force_original_aspect_ratio=increase,crop={cw}:{ch},"
        "format=rgba[cam]",
        "[2:v]format=gray[masc]",
        "[cam][masc]alphamerge[camr]",
        f"[1:v][jogo]overlay=0:{Y_JOGO}:shortest=1[c1]",
        f"[c1][camr]overlay={cx}:{cy}:shortest=1,setsar=1[v]",
    ]
    return ";".join(partes), g


def _dimensoes(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height", "-of", "csv=p=0", path],
                         capture_output=True, text=True, timeout=60).stdout.strip()
    w, h = out.split(",")[:2]
    return int(w), int(h)


def caixa_da_camera(src_w, src_h):
    """INSET_BOX="x,y,w,h" (fractions) -> pixel box, or None."""
    raw = (os.environ.get("INSET_BOX") or "").strip()
    if not raw:
        return None
    try:
        fx, fy, fw, fh = (float(v) for v in raw.split(","))
    except ValueError:
        return None
    if not (0 <= fx < 1 and 0 <= fy < 1 and 0 < fw <= 1 and 0 < fh <= 1):
        return None
    x, y = _par(fx * src_w), _par(fy * src_h)
    w, h = _par(min(fw, 1 - fx) * src_w), _par(min(fh, 1 - fy) * src_h)
    return (x, y, w, h) if w >= 32 and h >= 32 else None


def lado(path):
    return path + ".montagem.json"


def ler(clip_path):
    try:
        with open(lado(clip_path), "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def render(input_video, output_video, cam=None):
    """Render the montage. Returns True on success."""
    src_w, src_h = _dimensoes(input_video)
    graph, g = filtergraph(src_w, src_h, cam)
    with tempfile.TemporaryDirectory() as tmp:
        entradas = ["-i", input_video]
        if cam:
            fundo, mascara = desenhar_fundo(tmp)
            entradas += ["-loop", "1", "-i", fundo, "-loop", "1", "-i", mascara]
        cmd = ["ffmpeg", "-y", "-loglevel", "error", *entradas,
               "-filter_complex", graph, "-map", "[v]", "-map", "0:a:0?", "-shortest",
               *video_encode_args(QUALITY_FAST), "-pix_fmt", "yuv420p", *audio_encode_args(),
               *METADATA_SCRUB, "-movflags", "+faststart", output_video]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if r.returncode != 0:
        print(f"   ⚠️ Montagem falhou: {r.stderr[-400:]}")
        return False
    with open(lado(output_video), "w", encoding="utf-8") as f:
        json.dump(g, f)
    print(f"   🎞️ Montagem {g['tipo']}: "
          + ("webcam no cartão em cima, jogo em tela cheia embaixo" if cam else "jogo em tela cheia"))
    return True
