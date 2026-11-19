"""Montagem profissional 9:16 para gameplay (owner, 19-nov-2026).

The old default cut the middle third of a 16:9 frame and blew it up to fill
the phone: a zoom on whoever stood in the centre, HUD and action cut off. Pro
gaming Shorts do it differently, and so does this:

  sem webcam   the WHOLE game (HUD included) across the full width, over a
               blurred, darkened copy of itself; the empty band above it holds
               the animated title, the one below it the captions.
  com webcam   the streamer's camera enlarged on TOP, the whole game under it
               (stacked: action and reaction both in view, same place in every
               clip). The webcam corner inside the game is blurred so the face
               does not show twice.

Pure ffmpeg, one pass, no zoom anywhere. A sidecar <clip>.montagem.json tells
the finishing step (title, captions, progress bar) where everything is.
"""
import json
import os
import subprocess

from ffmpeg_utils import METADATA_SCRUB, QUALITY_FAST, audio_encode_args, video_encode_args

W, H = 1080, 1920
TOPO_SEGURO = 200          # platform UI over the top ~10%
BASE_SEGURA = 1420         # nothing important below this (Reels/TikTok UI)
CAM_H = 600                # camera band height when stacked


def _par(n):
    n = int(round(n))
    return n - (n % 2)


def geometria(src_w, src_h, cam=None):
    """Where the game (and camera) go on the 1080x1920 canvas."""
    jogo_h = _par(W * src_h / max(src_w, 1))
    if cam:
        y_jogo = CAM_H
        return {"tipo": "pro_cam", "jogo": [y_jogo, y_jogo + jogo_h], "cam": [0, CAM_H],
                "titulo_y": CAM_H, "legenda_base": min(BASE_SEGURA, y_jogo + jogo_h + 190)}
    # Game a little above the middle: title band on top, captions under it.
    y_jogo = _par(max(TOPO_SEGURO + 420, (H - jogo_h) / 2 - 40))
    return {"tipo": "pro", "jogo": [y_jogo, y_jogo + jogo_h], "cam": None,
            "titulo_y": (TOPO_SEGURO + y_jogo) // 2 + 20,
            "legenda_base": min(BASE_SEGURA, y_jogo + jogo_h + 190)}


def filtergraph(src_w, src_h, cam=None):
    """ffmpeg filter_complex for the montage; output label [v]."""
    g = geometria(src_w, src_h, cam)
    jogo_h = g["jogo"][1] - g["jogo"][0]
    partes = [
        # Background: the game itself, covering the frame, blurred and dimmed.
        f"[0:v]split=3[a][b][c]",
        f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"boxblur=luma_radius=40:luma_power=2,eq=brightness=-0.16:saturation=1.3[fundo]",
    ]
    jogo = "[b]"
    if cam:
        x, y, w, h = (int(v) for v in cam)
        # Blur the webcam corner inside the game: the face is already on top.
        partes.append(f"{jogo}split[b1][b2]")
        partes.append(f"[b2]crop={w}:{h}:{x}:{y},boxblur=luma_radius=24:luma_power=2[mancha]")
        partes.append(f"[b1][mancha]overlay={x}:{y}[jogo0]")
        jogo = "[jogo0]"
        partes.append(f"[c]crop={w}:{h}:{x}:{y},scale={W}:{CAM_H}:force_original_aspect_ratio=increase,"
                      f"crop={W}:{CAM_H}[cam]")
    else:
        partes.append("[c]nullsink")
    partes.append(f"{jogo}scale={W}:{jogo_h}[jogo]")
    partes.append(f"[fundo][jogo]overlay=0:{g['jogo'][0]}[comp]")
    if cam:
        partes.append(f"[comp][cam]overlay=0:0[comp2]")
        # A thin bright seam between camera and game reads as a designed split.
        partes.append(f"[comp2]drawbox=x=0:y={CAM_H - 3}:w={W}:h=6:color=white@0.85:t=fill,setsar=1[v]")
    else:
        partes.append("[comp]setsar=1[v]")
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
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", input_video,
           "-filter_complex", graph, "-map", "[v]", "-map", "0:a:0?",
           *video_encode_args(QUALITY_FAST), "-pix_fmt", "yuv420p", *audio_encode_args(),
           *METADATA_SCRUB, "-movflags", "+faststart", output_video]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if r.returncode != 0:
        print(f"   ⚠️ Montagem falhou: {r.stderr[-400:]}")
        return False
    with open(lado(output_video), "w", encoding="utf-8") as f:
        json.dump(g, f)
    print(f"   🎞️ Montagem {g['tipo']}: jogo inteiro em y={g['jogo'][0]}-{g['jogo'][1]}"
          + (", webcam em cima" if cam else ", fundo desfocado"))
    return True
