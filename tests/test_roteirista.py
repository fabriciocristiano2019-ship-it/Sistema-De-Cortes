"""Roteirista de títulos: 5 options per clip, a critic picks distinct ones."""
import json

from gaming import gemini_judge as gj


class _Resp:
    def __init__(self, payload):
        self.parsed = None
        self.text = json.dumps(payload)


class _Seq:
    """Answers each call with the next payload (or raises it if it is an error)."""
    def __init__(self, *payloads):
        self.payloads, self.calls = list(payloads), []
        self.models = self

    def generate_content(self, model, contents, config):
        self.calls.append(contents)
        p = self.payloads.pop(0)
        if isinstance(p, Exception):
            raise p
        return _Resp(p)


def _clips():
    return [{"start": 10, "end": 40, "moment_label": "Vitória", "video_title_for_youtube_short": "Vitória no Free Fire",
             "evidence": ["Placar: banner VITÓRIA"]},
            {"start": 60, "end": 90, "moment_label": "Susto", "video_title_for_youtube_short": "Que susto no Free Fire"}]


T = {"segments": [{"words": [{"word": " sobrou", "start": 20, "end": 20.3}, {"word": " só", "start": 20.3, "end": 20.5},
                             {"word": " eu", "start": 20.5, "end": 20.7}]}]}
BRAIN = {"cortes": [{"id": 0, "opcoes": ["Sobrou só eu… e virei a partida 🔥", "Dá pra ganhar 1 contra 4?", "a", "b", "c"]},
                    {"id": 1, "opcoes": ["Ele estava atrás de mim o tempo todo 😱", "x", "y", "z", "w"]}]}


def test_the_critic_picks_one_title_per_clip_and_explains():
    client = _Seq(BRAIN, {"escolhas": [{"id": 0, "titulo": "Sobrou só eu… e virei a partida 🔥", "motivo": "frase real"},
                                       {"id": 1, "titulo": "Ele estava atrás de mim o tempo todo 😱", "motivo": "tensão"}]})
    clips = _clips()
    assert gj.roteirizar(clips, T, {"name": "Free Fire"}, client, log=lambda *a: None) == 2
    assert clips[0]["video_title_for_youtube_short"] == "Sobrou só eu… e virei a partida 🔥"
    assert clips[0]["evidence"][0] == "Título: frase real"
    brainstorm = client.calls[0]
    assert "sobrou só eu" in brainstorm and "banner VITÓRIA" in brainstorm   # speech and scoreboard go in


def test_repeated_or_bad_picks_keep_the_old_title():
    client = _Seq(BRAIN, {"escolhas": [{"id": 0, "titulo": "Mesmo título repetido"},
                                       {"id": 1, "titulo": "Mesmo título repetido"}]})
    clips = _clips()
    gj.roteirizar(clips, T, {"name": "Free Fire"}, client, log=lambda *a: None)
    assert clips[0]["video_title_for_youtube_short"] == "Mesmo título repetido"
    assert clips[1]["video_title_for_youtube_short"] == "Que susto no Free Fire"   # duplicate refused


def test_a_failure_in_judge_keeps_the_editors_titles(tmp_path):
    import subprocess
    v = str(tmp_path / "v.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=5:duration=60",
                    "-pix_fmt", "yuv420p", v], check=True)
    pool = [{"start": 5.0, "end": 35.0, "peak_time": 20.0, "relevance_score": 80, "moment_category": "vitoria",
             "moment_label": "Vitória", "evidence": [], "video_title_for_youtube_short": "local", "description": "d"}]
    verdict = {"picks": [{"id": 0, "keep": True, "score": 90, "start": 5, "end": 35, "moment_category": "vitoria",
                          "title": "Título do editor bem escrito", "description": "d", "hashtags": [], "hook": "OPA",
                          "reason": "r"}], "corrections": []}
    logs = []
    clips = gj.judge(v, T, 60, {"name": "Free Fire"}, {"clip_seconds": 30, "max_clips": 1}, pool,
                     client=_Seq(verdict, RuntimeError("quota")), log=logs.append)
    assert clips[0]["video_title_for_youtube_short"] == "Título do editor bem escrito"
    assert any("Roteirista de títulos indisponível" in l for l in logs)
