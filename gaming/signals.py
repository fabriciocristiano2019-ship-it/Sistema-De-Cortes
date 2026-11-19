"""Audio and visual features, one value per analysis step (default 0.5 s).

Audio and video are analysed separately on purpose: a scream with nothing on
screen and an explosion with no commentary are both real moments, and neither
would be found by reading the transcript alone.

Everything streams through ffmpeg pipes in fixed-size chunks, so a 3-hour VOD
never sits in memory as raw samples. Cost is roughly one decode of the file at
a tiny resolution; no GPU and no network.
"""
import subprocess

import numpy as np

STEP = 0.5            # seconds per feature sample
AUDIO_SR = 8000       # enough for loudness / onset; speech detail comes from Whisper
VIS_FPS = 2           # 1 frame per STEP
VIS_W, VIS_H = 64, 36


class Cancelled(Exception):
    pass


def _ffmpeg_stream(args, chunk_bytes, should_cancel=None):
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while True:
            if should_cancel and should_cancel():
                raise Cancelled()
            buf = proc.stdout.read(chunk_bytes)
            if not buf:
                break
            yield buf
    finally:
        try:
            proc.kill()
        except Exception:
            pass
        proc.wait()


def audio_features(path, should_cancel=None):
    """Return dict of per-step arrays: rms_db, spike_db. Empty arrays if no audio."""
    hop = int(AUDIO_SR * STEP)
    args = ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1",
            "-ar", str(AUDIO_SR), "-f", "s16le", "-"]
    rms = []
    rest = np.zeros(0, dtype=np.int16)
    for buf in _ffmpeg_stream(args, hop * 2 * 120, should_cancel):
        data = np.concatenate([rest, np.frombuffer(buf, dtype=np.int16)])
        n = len(data) // hop
        if n:
            block = data[: n * hop].astype(np.float32).reshape(n, hop) / 32768.0
            rms.extend(np.sqrt(np.mean(block * block, axis=1) + 1e-12).tolist())
        rest = data[n * hop:]
    if not rms:
        return {"rms_db": np.zeros(0), "spike_db": np.zeros(0)}
    rms_db = 20 * np.log10(np.maximum(np.array(rms), 1e-6))
    # Spike: loudness now vs the mean of the previous 2 s.
    k = int(2 / STEP)
    prev = np.convolve(np.pad(rms_db, (k, 0), mode="edge")[:-1], np.ones(k) / k, mode="valid")[: len(rms_db)]
    spike = np.maximum(rms_db - prev, 0)
    return {"rms_db": rms_db, "spike_db": spike}


def visual_features(path, should_cancel=None):
    """Return dict of per-step arrays: motion, cut, flash, red."""
    fsize = VIS_W * VIS_H * 3
    args = ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-an",
            "-vf", f"fps={VIS_FPS},scale={VIS_W}:{VIS_H}:flags=area",
            "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    motion, bright, red = [], [], []
    prev = None
    rest = b""
    for buf in _ffmpeg_stream(args, fsize * 240, should_cancel):
        buf = rest + buf
        n = len(buf) // fsize
        if n:
            frames = np.frombuffer(buf[: n * fsize], dtype=np.uint8).reshape(n, VIS_H, VIS_W, 3).astype(np.float32)
            gray = frames.mean(axis=3)
            for i in range(n):
                g = gray[i]
                motion.append(0.0 if prev is None else float(np.mean(np.abs(g - prev))))
                prev = g
                bright.append(float(g.mean()))
                f = frames[i]
                r, gch, b = f[..., 0], f[..., 1], f[..., 2]
                # Share of pixels clearly dominated by red (damage vignettes, blood screens).
                red.append(float(np.mean((r > 110) & (r > 1.6 * gch) & (r > 1.6 * b))))
        rest = buf[n * fsize:]
    motion = np.array(motion)
    bright = np.array(bright)
    red = np.array(red)
    if len(motion) == 0:
        z = np.zeros(0)
        return {"motion": z, "cut": z, "flash": z, "red": z}
    # A hard cut is a frame difference far above the clip's typical motion.
    thr = np.median(motion) + 4 * (np.median(np.abs(motion - np.median(motion))) + 1e-3)
    cut = (motion > max(thr, 25)).astype(float)
    flash = np.maximum(np.diff(bright, prepend=bright[0]), 0)
    return {"motion": motion, "cut": cut, "flash": flash, "red": red}


# --------------------------------------------------------------------------- #
# HUD reader ("leitor do placar"): the game's own notices - kill feed, "VOCÊ
# ELIMINOU", the kill counter, a "VITÓRIA" banner. No OCR is installed, so it
# does not read the words: it sees NEW TEXT appear in the places games put it
# (corners, top band, centre banner) while the rest of the picture did not
# change the same way (a camera pan changes everything, a notice one spot).
# --------------------------------------------------------------------------- #
HUD_W, HUD_H = 256, 144
HUD_REGIOES = {                      # (x0, y0, x1, y1) as fractions of the frame
    "topo": (0.25, 0.00, 0.75, 0.20),
    "canto_direito": (0.62, 0.00, 1.00, 0.42),
    "lateral_esquerda": (0.00, 0.12, 0.34, 0.55),
    "centro": (0.20, 0.22, 0.80, 0.55),
}
HUD_BASE = 16                        # baseline: the previous 8 s


def _densidade_texto(g):
    """Share of sharp horizontal transitions: text and HUD glyphs, not scenery."""
    return float(np.mean(np.abs(np.diff(g, axis=1)) > 45)) if g.size else 0.0


def hud_score(dens, dens_total):
    """Per-step HUD evidence from region text densities (T x R) and the whole
    frame's (T). Pure function so it can be tested without video."""
    dens = np.asarray(dens, dtype=float)
    total = np.asarray(dens_total, dtype=float)
    t = len(total)
    if t == 0:
        return np.zeros(0)

    def base(x):
        xp = np.pad(x, (HUD_BASE, 0), mode="edge")
        w = np.lib.stride_tricks.sliding_window_view(xp, HUD_BASE)[:t]
        return np.median(w, axis=1)

    salto_total = np.maximum(total - base(total), 0)
    melhor = np.zeros(t)
    for r in range(dens.shape[1]):
        x = dens[:, r]
        b = base(x)
        spread = np.median(np.abs(x - np.median(x))) + 0.01
        z = (x - b - 1.5 * salto_total) / spread
        melhor = np.maximum(melhor, z)
    # A notice stays on screen: keep only what lasts at least 1 s (2 steps).
    dur = np.minimum(melhor, np.roll(melhor, -1))
    dur[-1] = melhor[-1] if t == 1 else min(melhor[-1], melhor[-2])
    return np.clip(dur, 0, None)


def hud_features(path, should_cancel=None):
    """Return {"hud": per-step array}; empty when the video has no picture."""
    fsize = HUD_W * HUD_H
    args = ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-an",
            "-vf", f"fps={VIS_FPS},scale={HUD_W}:{HUD_H}:flags=area,format=gray",
            "-f", "rawvideo", "-"]
    boxes = [(int(x0 * HUD_W), int(y0 * HUD_H), int(x1 * HUD_W), int(y1 * HUD_H))
             for x0, y0, x1, y1 in HUD_REGIOES.values()]
    dens, total = [], []
    rest = b""
    for buf in _ffmpeg_stream(args, fsize * 240, should_cancel):
        buf = rest + buf
        n = len(buf) // fsize
        if n:
            frames = np.frombuffer(buf[: n * fsize], dtype=np.uint8).reshape(n, HUD_H, HUD_W).astype(np.int16)
            for g in frames:
                dens.append([_densidade_texto(g[y0:y1, x0:x1]) for x0, y0, x1, y1 in boxes])
                total.append(_densidade_texto(g))
        rest = buf[n * fsize:]
    if not total:
        return {"hud": np.zeros(0)}
    return {"hud": hud_score(np.array(dens), np.array(total))}


def robust_z(x, window_steps=None, floor=0.0):
    """(x - median) / MAD, clipped at 0. Local baseline when window_steps given,
    so a loud game section does not hide every peak in a quiet one.

    floor: minimum spread in the signal's own units. Without it a near-constant
    signal (steady noise, a static menu) has MAD≈0 and any wobble becomes z=50."""
    x = np.asarray(x, dtype=float)
    if len(x) == 0:
        return x
    if window_steps and len(x) > window_steps:
        # Rolling median via strided percentile on a coarse grid (cheap for long VODs).
        stride = max(1, window_steps // 8)
        centers = np.arange(0, len(x), stride)
        meds, mads = [], []
        for c in centers:
            lo, hi = max(0, c - window_steps // 2), min(len(x), c + window_steps // 2)
            seg = x[lo:hi]
            m = np.median(seg)
            meds.append(m)
            mads.append(np.median(np.abs(seg - m)))
        med = np.interp(np.arange(len(x)), centers, meds)
        mad = np.interp(np.arange(len(x)), centers, mads)
    else:
        med = np.median(x)
        mad = np.median(np.abs(x - med))
    z = (x - med) / np.maximum(1.4826 * np.asarray(mad), floor + 1e-6)
    return np.clip(z, 0, None)


def robust_z_active(x, q=60.0, floor=0.0):
    """Like robust_z, but the baseline is the ACTIVE part of the signal (samples
    above the q-th percentile), not the whole of it.

    Commentary over a quiet game is mostly silence: against a whole-signal
    median every calm sentence is a "peak". Measured against the level of the
    talking itself, only shouting, laughter bursts and explosions stand out.
    """
    x = np.asarray(x, dtype=float)
    if len(x) == 0:
        return x
    thr = np.percentile(x, q)
    active = x[x > thr]
    if len(active) < 8:
        return robust_z(x, floor=floor)
    med = np.median(active)
    mad = np.median(np.abs(active - med))
    return np.clip((x - med) / max(1.4826 * mad, floor + 1e-6), 0, None)


def level_above_active(x, scale):
    """How far each sample sits above the signal's ordinary ACTIVE level, in
    units of `scale` (same unit as x, e.g. 3 dB).

    Active = samples above the midpoint between the floor (p10) and the top
    (p99); the ordinary level is the lower quartile of those. So calm talking
    or steady game audio scores 0 and only what is clearly louder than usual
    counts, whether the background is silent or a constant firefight.
    """
    x = np.asarray(x, dtype=float)
    if len(x) < 8:
        return np.zeros_like(x)
    lo, hi = np.percentile(x, [10, 99])
    active = x[x > lo + 0.5 * (hi - lo)]
    if len(active) < 4:
        return np.zeros_like(x)
    base = np.percentile(active, 25)
    return np.clip((x - base) / scale, 0, None)


def media_duration(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "default=nk=1:nw=1", path], capture_output=True, text=True, timeout=60)
        return float(out.stdout.strip())
    except Exception:
        return 0.0
