"""Genre profiles: how much each signal counts and which words mean what.

Nothing here is game-specific. A genre profile only says which evidence is
meaningful for that kind of game (a scream in a horror game, a kill-feed word
in a shooter, a sudden engine roar in a racing game). Any game, including ones
added by the user, picks a category and inherits its profile.
"""
import re

# Signal names produced by gaming.signals / gaming.moments.
#   audio_peak  - loudness well above the local baseline (explosions, shouting)
#   audio_spike - sudden rise in loudness vs the previous ~2s (jump scares)
#   motion      - frame-to-frame visual change (action, chases)
#   cut         - hard scene changes / camera whips
#   flash       - brightness flashes (explosions, muzzle flash, deaths)
#   red         - screen turning red (damage indicators in many games)
#   keyword     - transcript hit from the moment lexicon below
#   laughter    - laughter in the transcript (kkkk, hahaha, rsrs)
#   speech_rate - excited, fast talking compared to the speaker's average
SIGNALS = ("audio_peak", "audio_spike", "motion", "cut", "flash", "red",
           "keyword", "laughter", "speech_rate")

CATEGORIES = {
    "fps_br": {
        "label": "FPS e Battle Royale",
        "weights": {"audio_peak": 0.18, "audio_spike": 0.10, "motion": 0.10, "cut": 0.04,
                    "flash": 0.10, "red": 0.08, "keyword": 0.26, "laughter": 0.06, "speech_rate": 0.08},
        "boost": ["eliminacao", "headshot", "clutch", "vitoria", "derrota"],
    },
    "open_world": {
        "label": "Mundo aberto",
        "weights": {"audio_peak": 0.14, "audio_spike": 0.10, "motion": 0.16, "cut": 0.06,
                    "flash": 0.06, "red": 0.04, "keyword": 0.20, "laughter": 0.14, "speech_rate": 0.10},
        "boost": ["perseguicao", "engracado", "inesperado", "descoberta"],
    },
    "rpg": {
        "label": "RPG e MMORPG",
        "weights": {"audio_peak": 0.14, "audio_spike": 0.08, "motion": 0.10, "cut": 0.04,
                    "flash": 0.10, "red": 0.06, "keyword": 0.28, "laughter": 0.10, "speech_rate": 0.10},
        "boost": ["conquista", "vitoria", "descoberta", "derrota"],
    },
    "horror": {
        "label": "Terror",
        "weights": {"audio_peak": 0.18, "audio_spike": 0.26, "motion": 0.08, "cut": 0.06,
                    "flash": 0.04, "red": 0.04, "keyword": 0.20, "laughter": 0.06, "speech_rate": 0.08},
        "boost": ["susto", "tensao", "reacao"],
    },
    "survival": {
        "label": "Sobrevivência",
        "weights": {"audio_peak": 0.16, "audio_spike": 0.14, "motion": 0.10, "cut": 0.04,
                    "flash": 0.06, "red": 0.08, "keyword": 0.24, "laughter": 0.08, "speech_rate": 0.10},
        "boost": ["tensao", "susto", "derrota", "descoberta"],
    },
    "racing": {
        "label": "Corrida",
        "weights": {"audio_peak": 0.18, "audio_spike": 0.12, "motion": 0.18, "cut": 0.08,
                    "flash": 0.04, "red": 0.02, "keyword": 0.22, "laughter": 0.06, "speech_rate": 0.10},
        "boost": ["vitoria", "jogada", "inesperado"],
    },
    "sports": {
        "label": "Esportes",
        "weights": {"audio_peak": 0.22, "audio_spike": 0.12, "motion": 0.10, "cut": 0.06,
                    "flash": 0.02, "red": 0.02, "keyword": 0.28, "laughter": 0.06, "speech_rate": 0.12},
        "boost": ["jogada", "vitoria", "derrota"],
    },
    "strategy": {
        "label": "Estratégia",
        "weights": {"audio_peak": 0.12, "audio_spike": 0.06, "motion": 0.06, "cut": 0.02,
                    "flash": 0.04, "red": 0.04, "keyword": 0.36, "laughter": 0.12, "speech_rate": 0.18},
        "boost": ["vitoria", "derrota", "jogada", "conquista"],
    },
    "simulator": {
        "label": "Simuladores",
        "weights": {"audio_peak": 0.14, "audio_spike": 0.12, "motion": 0.10, "cut": 0.06,
                    "flash": 0.04, "red": 0.04, "keyword": 0.22, "laughter": 0.18, "speech_rate": 0.10},
        "boost": ["engracado", "inesperado"],
    },
    "casual": {
        "label": "Jogos casuais",
        "weights": {"audio_peak": 0.14, "audio_spike": 0.10, "motion": 0.08, "cut": 0.04,
                    "flash": 0.04, "red": 0.02, "keyword": 0.24, "laughter": 0.22, "speech_rate": 0.12},
        "boost": ["engracado", "reacao", "vitoria"],
    },
    "other": {
        "label": "Outros",
        "weights": {"audio_peak": 0.16, "audio_spike": 0.12, "motion": 0.12, "cut": 0.05,
                    "flash": 0.05, "red": 0.04, "keyword": 0.24, "laughter": 0.12, "speech_rate": 0.10},
        "boost": [],
    },
}

# Moment types, labels and lexicons. Patterns are matched against the
# lower-cased, accent-stripped transcript, so "eliminação" and "eliminacao"
# are the same. PT-BR first, EN gaming slang second (streamers mix both).
MOMENTS = {
    "eliminacao": {
        "label": "Eliminação",
        "patterns": [r"\bmatei\b", r"\bmatamos\b", r"\bderrubei\b", r"\bderrubado\b", r"\bdown(ei|ou|ado|ados)?\b",
                     r"\babati\b", r"\bkill\w*\b", r"\bmorreu\b", r"\bpeguei ele\b", r"\bpega ele\b",
                     r"\bacabou com ele\b", r"\bdouble\b", r"\btriple\b", r"\bquad\w*\b", r"\bace\b",
                     r"\bpenta\w*\b", r"\bknock\w*\b", r"\beliminad\w+\b", r"\beliminei\b"],
    },
    "headshot": {
        "label": "Headshot",
        "patterns": [r"\bheadshot\w*\b", r"\bhs\b", r"\bna cabeca\b", r"\bcapa\b", r"\bcapinha\b",
                     r"\bone ?tap\b", r"\bum tiro\b", r"\btiro na cabeca\b"],
    },
    "vitoria": {
        "label": "Vitória",
        "patterns": [r"\bganh\w+\b", r"\bvenc\w+\b", r"\bvitoria\b", r"\bbooyah\b", r"\bbuyah\b",
                     r"\bchampion\w*\b", r"\bcampe\w+\b", r"\bwin\b", r"\bwon\b", r"\bvictory\b",
                     r"\bgol+\b", r"\bgoo+l\b", r"\bprimeiro lugar\b", r"\bchicken dinner\b", r"\btop ?1\b"],
    },
    "derrota": {
        "label": "Derrota",
        "patterns": [r"\bperd\w+\b", r"\bmorri\b", r"\bmorremos\b", r"\bgame over\b", r"\bderrota\b",
                     r"\bnao acredito\b", r"\bque raiva\b", r"\bdefeat\b", r"\bi died\b", r"\bwe lost\b"],
    },
    "clutch": {
        "label": "Clutch",
        "patterns": [r"\bclutch\w*\b", r"\b1 ?v ?[2-5]\b", r"\bum contra (dois|tres|quatro|cinco)\b",
                     r"\bsozinho\b", r"\bso eu\b", r"\bsobrou so eu\b", r"\bultimo vivo\b"],
    },
    "jogada": {
        "label": "Jogada extraordinária",
        "patterns": [r"\bjogada\b", r"\bque jogada\b", r"\binsano\b", r"\binsana\b", r"\bsurreal\b",
                     r"\bmonstro\b", r"\bbrabo\b", r"\bbrabissimo\b", r"\bdemais\b", r"\bperfeit\w+\b",
                     r"\binsane\b", r"\bnasty\b", r"\bcrazy\b", r"\bno way\b", r"\bwhat a\b", r"\bclip it\b",
                     r"\bclipa\b", r"\bclipou\b", r"\bdribl\w+\b", r"\bultrapass\w+\b"],
    },
    "engracado": {
        "label": "Momento engraçado",
        "patterns": [r"\bk{3,}\b", r"\b(ha){2,}h?\b", r"\b(he){3,}\b", r"\brs(rs)+\b", r"\bkkk\w*\b",
                     r"\bque isso\b", r"\bbug\w*\b", r"\bglitch\w*\b", r"\blol\b", r"\blmao\b"],
    },
    "susto": {
        "label": "Susto",
        "patterns": [r"\bsusto\b", r"\bassust\w+\b", r"\bsocorro\b", r"\bmeu deus\b", r"\bai meu deus\b",
                     r"\bmisericordia\b", r"\bjesus\b", r"\bnossa senhora\b", r"\baa+h+\b", r"\bnaoo+\b",
                     r"\boh my god\b", r"\bjump ?scare\b", r"\bwhat the\b"],
    },
    "reacao": {
        "label": "Reação espontânea",
        "patterns": [r"\bmano\b", r"\bcara\b", r"\bvei\b", r"\bnossa\b", r"\bcaramba\b", r"\bcaraca\b",
                     r"\bque isso\b", r"\bserio\b", r"\bnao acredito\b", r"\bbro\b", r"\bdude\b", r"\bomg\b",
                     r"\bwow\b", r"\bpqp\b", r"\bputz\b"],
    },
    "perseguicao": {
        "label": "Perseguição",
        "patterns": [r"\bcorre+\b", r"\bcorr(endo|am|ei|emos)\b", r"\bfoge\b", r"\bfug\w+\b", r"\bta vindo\b",
                     r"\batras de mim\b", r"\bpolicia\b", r"\bperseg\w+\b", r"\brun\b", r"\bchase\w*\b",
                     r"\bescap\w+\b"],
    },
    "conquista": {
        "label": "Conquista",
        "patterns": [r"\bconquista\b", r"\bconsegui\w*\b", r"\bfinalmente\b", r"\bupei\b", r"\bup de\b",
                     r"\bsubi de nivel\b", r"\blevel ?up\b", r"\bachievement\b", r"\btrofeu\b", r"\bplatin\w+\b",
                     r"\blendari\w+\b", r"\bdrop\w*\b", r"\bboss\b", r"\bchefe\b"],
    },
    "descoberta": {
        "label": "Descoberta",
        "patterns": [r"\bachei\b", r"\bencontrei\b", r"\bdescobri\w*\b", r"\bsegredo\b", r"\bsecret\w*\b",
                     r"\beaster ?egg\b", r"\bolha isso\b", r"\bolha so\b", r"\bfound\b", r"\bbau\b",
                     r"\btesouro\b"],
    },
    "inesperado": {
        "label": "Situação inesperada",
        "patterns": [r"\bdo nada\b", r"\bdo nadaa+\b", r"\bcomo assim\b", r"\bque\?", r"\boxe\b",
                     r"\bwtf\b", r"\bwhat\?", r"\bsurpresa\b", r"\bnunca vi\b", r"\bimpossivel\b"],
    },
    "tensao": {
        "label": "Tensão",
        "patterns": [r"\bcuidado\b", r"\bsilencio\b", r"\bdevagar\b", r"\bescondid\w+\b", r"\bta ouvindo\b",
                     r"\bescuta\b", r"\bpassos\b", r"\bultima vida\b", r"\bpouca vida\b",
                     r"\bsem bala\b", r"\bcareful\b", r"\bquiet\b", r"\blow hp\b"],
    },
}

# Signal-only moments: when no word explains a peak, the dominant visual/audio
# evidence still names the category honestly.
SIGNAL_MOMENT = {
    "audio_spike": "susto",
    "audio_peak": "reacao",
    "flash": "eliminacao",
    "red": "tensao",
    "motion": "perseguicao",
    "cut": "inesperado",
    "laughter": "engracado",
    "speech_rate": "reacao",
}

_COMPILED = {k: [re.compile(p) for p in v["patterns"]] for k, v in MOMENTS.items()}


def strip_accents(text: str) -> str:
    import unicodedata
    norm = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in norm if not unicodedata.combining(c)).lower()


def match_moments(text: str):
    """Return {moment_key: [matched strings]} for one text span."""
    t = strip_accents(text)
    hits = {}
    for key, pats in _COMPILED.items():
        for p in pats:
            for m in p.finditer(t):
                hits.setdefault(key, []).append(m.group(0))
    return hits


LAUGH_RE = re.compile(r"\bk{3,}\w*|\b(?:ha){2,}h?\b|\brs(?:rs)+\b|\blol\b|\blmao\b|\bkkk\w*")


def category(cat_id: str) -> dict:
    return CATEGORIES.get(cat_id) or CATEGORIES["other"]


def category_list():
    return [{"id": k, "label": v["label"]} for k, v in CATEGORIES.items()]


def moment_list():
    return [{"id": k, "label": v["label"]} for k, v in MOMENTS.items()]
