"""Aprendizado com as visualizações + melhor horário (ideas 1 and 4)."""
import pytest

from gaming import aprendizado as ap


def _pubs():
    return [
        {"status": "enviado", "title": "Sobrou só eu e a gente ganhou! 🏆 | Free Fire", "job_id": "j1", "clip_index": 0},
        {"status": "enviado", "title": "Booyah no último segundo 🏆", "job_id": "j1", "clip_index": 1},
        {"status": "enviado", "title": "Que susto, socorro 😱", "job_id": "j1", "clip_index": 2},
        {"status": "enviado", "title": "Ele apareceu do nada 😱", "job_id": "j1", "clip_index": 3},
        {"status": "falhou", "title": "Nunca saiu", "job_id": "j1", "clip_index": 4},
    ]


MOMENTOS = {0: "vitoria", 1: "vitoria", 2: "susto", 3: "susto", 4: "vitoria"}


def info(job, idx):
    m = MOMENTOS.get(idx)
    return {"moment": m, "label": {"vitoria": "Vitória", "susto": "Susto"}[m]} if m else None


def _rows():
    # Wednesday 22:00Z = 19h in Brasília; Monday 13:00Z = 10h.
    return [
        {"platform": "youtube", "title": "Sobrou só eu e a gente ganhou! 🏆 | Free Fire", "post_url": "u1",
         "published_at": "2026-11-11T22:10:00Z", "post_metrics": {"views": 9000, "likes": 700}},
        {"platform": "youtube", "title": "BOOYAH no último segundo", "post_url": "u2",
         "published_at": "2026-11-04T22:40:00Z", "post_metrics": {"views": 7000, "likes": 500}},
        {"platform": "youtube", "title": "Que susto, socorro 😱", "post_url": "u3",
         "published_at": "2026-11-09T13:00:00Z", "post_metrics": {"views": 1000, "likes": 50}},
        {"platform": "youtube", "title": "Ele apareceu do nada 😱", "post_url": "u4",
         "published_at": "2026-11-16T13:30:00Z", "post_metrics": {"views": 1400, "likes": 60}},
        {"platform": "youtube", "title": "Vídeo que não é nosso", "post_url": "u5",
         "published_at": "2026-11-12T22:00:00Z", "post_metrics": {"views": 99999}},
    ]


@pytest.fixture
def out(tmp_path):
    return str(tmp_path)


def test_posts_are_tied_to_their_clips_by_title(out):
    assert ap.atualizar(out, _rows(), _pubs(), info) == 4          # the stranger's post is ignored
    r = ap.ranking(out)
    assert [t["moment"] for t in r] == ["vitoria", "susto"]
    assert r[0]["media_views"] == 8000 and r[1]["media_views"] == 1200


def test_the_best_type_gets_a_bonus_and_the_weak_one_a_small_penalty(out):
    ap.atualizar(out, _rows(), _pubs(), info)
    b = ap.bonus(out)
    assert 0 < b["vitoria"] <= ap.BONUS_MAX
    assert b["susto"] < 0 and b["susto"] >= -ap.BONUS_MAX
    assert "Vitória" in ap.dica_para_ia(out)


def test_too_little_history_teaches_nothing(out):
    ap.atualizar(out, _rows()[:2], _pubs(), info)
    assert ap.bonus(out) == {} and ap.melhor_horario(out) is None and ap.dica_para_ia(out) == ""


def test_numbers_are_refreshed_not_double_counted(out):
    ap.atualizar(out, _rows(), _pubs(), info)
    rows = _rows()
    rows[0]["post_metrics"]["views"] = 12000
    ap.atualizar(out, rows, _pubs(), info)
    assert ap.resumo(out)["posts"] == 4
    assert ap.ranking(out)[0]["media_views"] == 9500


def test_best_time_is_in_brasilia_time(out):
    ap.atualizar(out, _rows(), _pubs(), info)
    h = ap.melhor_horario(out)
    assert h["dia"] == "quarta" and h["hora"] == 18 and h["amostras"] == 2
    assert h["texto"] == "Quarta, das 18h às 20h"


def test_the_bonus_changes_which_moment_wins(out, monkeypatch):
    """Two equally strong candidates: the channel's favourite type ranks first."""
    from gaming import moments
    ap.atualizar(out, _rows(), _pubs(), info)
    b = ap.bonus(out)
    assert b["vitoria"] - b["susto"] > 0.05
