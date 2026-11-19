"""Verificador de música: steady harmony = music; speech, noise, silence = not."""
import json
import os
import subprocess

import numpy as np
import pytest

from gaming import musica

SR = musica.SR


def _musica(seg=20):
    t = np.arange(0, seg, 1 / SR)
    notas = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]]
    m = np.zeros_like(t)
    for k in range(int(seg / 2)):
        s = (t >= 2 * k) & (t < 2 * k + 2)
        for f in notas[k % 4]:
            m[s] += 0.15 * np.sin(2 * np.pi * f * t[s])
    return (m + 0.01 * np.random.default_rng(0).standard_normal(len(t))).astype(np.float32)


def _fala(seg=20):
    t = np.arange(0, seg, 1 / SR)
    rng = np.random.default_rng(0)
    sp, f = np.zeros_like(t), 150.0
    for k in range(int(seg / 0.15)):
        s = (t >= k * 0.15) & (t < (k + 1) * 0.15)
        f = max(90, min(280, f + rng.normal(0, 40)))
        sp[s] = 0.2 * np.sign(np.sin(2 * np.pi * f * t[s])) * (rng.random() > 0.25)
    return (sp + 0.05 * rng.standard_normal(len(t))).astype(np.float32)


def test_music_is_flagged():
    r = musica.avaliar(_musica())
    assert r["risco"] == "alto" and r["porcentagem"] >= 50


@pytest.mark.parametrize("sinal", [_fala(), (0.2 * np.random.default_rng(1).standard_normal(SR * 20)).astype(np.float32),
                                   np.zeros(SR * 20, dtype=np.float32)])
def test_speech_noise_and_silence_are_not_music(sinal):
    assert musica.avaliar(sinal)["risco"] == "baixo"


def test_no_audio():
    assert musica.avaliar(np.zeros(0, dtype=np.float32))["risco"] == "sem_audio"


def test_endpoint_checks_the_delivered_file_and_caches(tmp_path, monkeypatch):
    import asyncio
    import gaming_api
    monkeypatch.setitem(gaming_api._STATE, "output_dir", str(tmp_path))
    monkeypatch.setitem(gaming_api._STATE, "jobs", {})
    d = tmp_path / "job1"
    d.mkdir()
    wav = tmp_path / "m.wav"
    import wave
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((_musica(12) * 32767).astype(np.int16).tobytes())
    final = d / "subtitled_1_job1_x_clip_1.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=12",
                    "-i", str(wav), "-shortest", "-c:v", "libx264", "-c:a", "aac", str(final)], check=True)
    (d / "job1_x_metadata.json").write_text(json.dumps({"shorts": [{"start": 0, "end": 12}]}), encoding="utf-8")
    (d / "gaming_job.json").write_text("{}", encoding="utf-8")
    r = asyncio.run(gaming_api.clip_musica("job1", 0))
    assert r["risco"] == "alto"
    cache = json.loads((d / ".musica.json").read_text(encoding="utf-8"))
    assert cache["0"]["arquivo"] == final.name
    meta_antes = os.path.getmtime(d / "job1_x_metadata.json")
    assert asyncio.run(gaming_api.clip_musica("job1", 0)) == r          # from the cache
    assert os.path.getmtime(d / "job1_x_metadata.json") == meta_antes   # metadata untouched
