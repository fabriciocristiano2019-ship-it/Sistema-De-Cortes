"""Time left and live build of a job, from a real measured console (CPU,
3-min gameplay, 5 clips of 15 s, 284 s in total)."""
import json
import os

import pytest

from gaming import progresso as pg

CON = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "console_medido.json"), encoding="utf-8"))
FIM = CON[-1]["t"]
SETTINGS = {"clip_seconds": 15, "max_clips": 5}


def _ate(t):
    return [c for c in CON if c["t"] <= t]


def _snap(t):
    vis = _ate(t)
    f = pg.ler_console(vis)
    pront = len(f["exportados"])
    return {"clips": {"total": f["selecionados"], "ready": pront, "reframed": pront, "started": len(f["cortes"])},
            "working": [], "whisper_pct": None}


def test_reads_what_the_console_states():
    f = pg.ler_console(CON)
    assert f["fonte_s"] == 180 and f["clip_s"] == 15 and f["selecionados"] == 5
    assert f["cortes"][1] == (16.25, 30.87) and len(f["exportados"]) == 5
    assert f["render_inicio"] == pytest.approx(30, abs=1)


def test_measured_rates_of_this_machine():
    r = pg.medir(CON)
    assert r["por_minuto"] == pytest.approx(7.2, abs=0.5)
    assert r["primeiro_por_seg"] == pytest.approx(5.7, abs=0.3)
    assert r["seguinte_por_seg"] == pytest.approx(2.8, abs=0.3)


@pytest.mark.parametrize("t", [0, 30, 60, 120, 180])
def test_time_left_is_close_until_the_last_minute(t):
    e = pg.estimar(t, "processing", _snap(t), _ate(t), SETTINGS, pg.taxas([]))
    assert abs(e["restante_s"] - (FIM - t)) <= 15, (t, e["restante_s"], FIM - t)


@pytest.mark.parametrize("t", [210, 240, 270])
def test_time_left_never_says_done_too_early(t):
    e = pg.estimar(t, "processing", _snap(t), _ate(t), SETTINGS, pg.taxas([]))
    assert 0 < FIM - t <= e["restante_s"] <= (FIM - t) + 50


def test_progress_follows_time_not_stages():
    # The old bar said 59% at 30 s of a 284 s job.
    e = pg.estimar(30, "processing", _snap(30), _ate(30), SETTINGS, pg.taxas([]))
    assert 8 <= e["progresso"] <= 15


def test_stage_list_states():
    e = pg.estimar(120, "processing", _snap(120), _ate(120), SETTINGS, pg.taxas([]))
    est = {x["id"]: x["estado"] for x in e["etapas"]}
    assert est["analise"] == "concluido" and est["edicao"] == "andamento" and est["exportacao"] == "andamento"


def test_rates_are_recorded_once_and_learned(tmp_path):
    assert pg.registrar(str(tmp_path), "job1", CON) is True
    assert pg.registrar(str(tmp_path), "job1", CON) is False, "same job twice"
    hist = pg.carregar(str(tmp_path))["historico"]
    assert len(hist) == 1 and pg.taxas(hist)["primeiro_por_seg"] == pytest.approx(5.7, abs=0.3)


def test_live_build_uses_the_real_intermediate_files(tmp_path, monkeypatch):
    jid = "abc"
    for n in (f"{jid}_x_clip_1.mp4", f"hooked_1_{jid}_x_clip_1.mp4", f"{jid}_x_clip_2.mp4", f"{jid}_x_clip_3.mp4"):
        (tmp_path / n).write_bytes(b"x")
    monkeypatch.setattr(pg, "_video_ok", lambda p: not p.endswith("clip_3.mp4"))   # clip 3 still being written
    obras = {o["indice"]: o for o in pg.construcao(str(tmp_path), jid, _ate(100))}
    assert obras[1]["estagio"] == "legendas" and obras[1]["video_url"].endswith(f"hooked_1_{jid}_x_clip_1.mp4")
    assert obras[2]["estagio"] == "gancho" and obras[2]["video_url"].endswith("clip_2.mp4")
    assert obras[3]["estagio"] == "enquadrando" and obras[3]["video_url"] is None
    assert obras[1]["inicio"] == 16.25
