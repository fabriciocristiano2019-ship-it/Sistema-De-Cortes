"""Local thumbnails: the sharpest frame around the clip's peak plus its title.

No model and no API. The frame comes from the rendered clip itself, so the
thumbnail shows what the video shows; the text is drawn with the bundled Anton
font, which keeps accents and spelling exact.
"""
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts", "Anton-Regular.ttf")
SPAN = 3.0       # seconds searched on each side of the peak
SAMPLES = 13


def best_frame(video_path, at):
    """Sharpest, reasonably lit frame within SPAN of ``at`` (BGR array) or None."""
    cap = cv2.VideoCapture(video_path)
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        duration = total / fps if total else 0
        lo = max(0.0, at - SPAN)
        hi = min(duration - 0.1, at + SPAN) if duration else at + SPAN
        if hi <= lo:
            lo, hi = 0.0, max(0.0, duration - 0.1)
        best, best_score = None, -1.0
        for t in np.linspace(lo, hi, SAMPLES):
            cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            gray = cv2.cvtColor(cv2.resize(frame, (270, 480)), cv2.COLOR_BGR2GRAY)
            sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            mean = float(gray.mean())
            # A black or blown-out frame is useless however "sharp" its noise is.
            exposure = 1.0 if 35 <= mean <= 225 else 0.25
            score = sharp * exposure
            if score > best_score:
                best, best_score = frame, score
        return best
    finally:
        cap.release()


def _wrap(draw, text, font, max_width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def render(frame_bgr, out_path, title, tag=None):
    img = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)).convert("RGB")
    w, h = img.size
    # Darken the lower part so white text reads on any gameplay.
    shade = Image.new("L", (1, h), 0)
    for y in range(h):
        k = max(0.0, (y - h * 0.45) / (h * 0.55))
        shade.putpixel((0, y), int(190 * k ** 1.4))
    img = Image.composite(Image.new("RGB", (w, h), (0, 0, 0)), img, shade.resize((w, h)))
    draw = ImageDraw.Draw(img)
    margin = int(w * 0.07)
    title = " ".join(str(title or "").upper().split())[:90]
    size = int(w * 0.135)
    while size > int(w * 0.06):
        font = ImageFont.truetype(FONT, size)
        lines = _wrap(draw, title, font, w - 2 * margin)
        if len(lines) <= 4:
            break
        size -= 6
    line_h = int(size * 1.12)
    y = int(h * 0.88) - line_h * len(lines)
    if tag:
        tfont = ImageFont.truetype(FONT, int(w * 0.05))
        label = str(tag).upper()[:40]
        tw = draw.textlength(label, font=tfont)
        pad = int(w * 0.02)
        box_h = int(w * 0.075)
        draw.rounded_rectangle([margin, y - box_h - pad * 2, margin + tw + pad * 2, y - pad * 2 + 0], radius=pad,
                               fill=(255, 214, 10))
        draw.text((margin + pad, y - box_h - pad * 2 + int(box_h * 0.12)), label, font=tfont, fill=(10, 10, 10))
    for i, ln in enumerate(lines):
        draw.text((margin, y + i * line_h), ln, font=font, fill=(255, 255, 255),
                  stroke_width=max(4, size // 14), stroke_fill=(0, 0, 0))
    tmp = out_path + ".tmp.jpg"
    img.save(tmp, "JPEG", quality=90, optimize=True)
    os.replace(tmp, out_path)
    return {"width": w, "height": h, "bytes": os.path.getsize(out_path)}


def make(video_path, out_path, title, at, tag=None):
    frame = best_frame(video_path, max(0.0, float(at)))
    if frame is None:
        raise RuntimeError("não foi possível ler um quadro do vídeo")
    return render(frame, out_path, title, tag)
