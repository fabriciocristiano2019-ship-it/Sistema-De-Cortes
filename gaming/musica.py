"""Verificador de música: is there music under this clip? (before publishing)

YouTube/TikTok/Instagram block or mute videos with copyrighted songs. There is
no song database here, so this does not say WHICH song: it measures how much
of the clip sounds like music - sustained notes whose harmony holds for
seconds - as opposed to speech (pitch moves all the time) or noise (no
notes). Game soundtracks count as music too; the owner decides.

Pure numpy over a 16 kHz mono decode: about a second per 30 s clip.
"""
import subprocess

import numpy as np

SR = 16000
PASSO = 0.5                       # seconds per analysis frame
N_FFT = 4096
F_MIN, F_MAX = 80.0, 4000.0
MIN_SEGUIDO = 3                   # 1.5 s of steady harmony to count as music


def _audio(path, max_seconds=180):
    args = ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-t", str(max_seconds),
            "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"]
    try:
        out = subprocess.run(args, capture_output=True, timeout=120).stdout
    except (OSError, subprocess.TimeoutExpired):
        return np.zeros(0, dtype=np.float32)
    return np.frombuffer(out, dtype=np.int16).astype(np.float32) / 32768.0


def _chroma_matrix():
    freqs = np.fft.rfftfreq(N_FFT, 1 / SR)
    m = np.zeros((12, len(freqs)))
    ok = (freqs >= F_MIN) & (freqs <= F_MAX)
    pc = np.round(12 * np.log2(freqs[ok] / 440.0)).astype(int) % 12
    m[pc, np.nonzero(ok)[0]] = 1.0
    return m


_CHROMA = _chroma_matrix()


def quadros_musicais(sinal):
    """Boolean per 0.5 s frame: steady harmony (music-like)."""
    hop = int(SR * PASSO)
    n = (len(sinal) - N_FFT) // hop + 1 if len(sinal) >= N_FFT else 0
    if n <= 0:
        return np.zeros(0, dtype=bool)
    janela = np.hanning(N_FFT)
    chroma = np.zeros((n, 12))
    energia = np.zeros(n)
    for i in range(n):
        seg = sinal[i * hop: i * hop + N_FFT]
        mag = np.abs(np.fft.rfft(seg * janela)) ** 2
        chroma[i] = _CHROMA @ mag
        energia[i] = 10 * np.log10(np.mean(seg * seg) + 1e-10)
    soma = chroma.sum(axis=1, keepdims=True) + 1e-12
    p = chroma / soma
    entropia = -(p * np.log(p + 1e-12)).sum(axis=1) / np.log(12)     # 0 = pure notes, 1 = noise
    norm = np.linalg.norm(chroma, axis=1) + 1e-12
    estavel = np.r_[0.0, np.sum(chroma[1:] * chroma[:-1], axis=1) / (norm[1:] * norm[:-1])]
    harmonico = (energia > -45) & (entropia < 0.80) & (estavel > 0.90)
    # Only runs of steady harmony: a sung vowel or a beep is not a song.
    out = np.zeros(n, dtype=bool)
    i = 0
    while i < n:
        if harmonico[i]:
            j = i
            while j < n and harmonico[j]:
                j += 1
            if j - i >= MIN_SEGUIDO:
                out[i:j] = True
            i = j
        else:
            i += 1
    return out


def avaliar(sinal):
    q = quadros_musicais(sinal)
    if len(q) == 0:
        return {"porcentagem": 0, "risco": "sem_audio", "texto": "Sem áudio para analisar."}
    pct = int(round(100 * float(np.mean(q))))
    if pct >= 50:
        risco, texto = "alto", (f"Música em {pct}% do corte. Se não for do próprio jogo, a rede pode "
                                "silenciar ou bloquear o vídeo por direitos autorais.")
    elif pct >= 20:
        risco, texto = "medio", (f"Trechos com música ({pct}% do corte). Confira se é a trilha do jogo "
                                 "ou uma música de terceiros.")
    else:
        risco, texto = "baixo", "Sem música de fundo relevante."
    return {"porcentagem": pct, "risco": risco, "texto": texto}


def analisar_arquivo(path):
    return avaliar(_audio(path))
