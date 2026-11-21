"""Pasta de vídeos novos (owner, 21-nov-2026).

Model the owner chose (an ad for an automatic "dark channel" line): the
agents make the clip and drop it in a folder; nothing is posted
automatically. Each finished clip is copied to

    prontos/AAAA-MM-DD/NN - Título do corte.mp4
    prontos/AAAA-MM-DD/NN - Título do corte.txt   (title, description, hashtags)

so posting by hand is copy and paste. On the owner's PC (Docker) the project
folder is mounted, so ``prontos`` is a real Windows folder. "Novos" are the
files created after the owner last marked the folder as seen.
"""
import json
import os
import re
import shutil
import time
import unicodedata
import zipfile
from datetime import datetime

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VISTO = ".visto"


def pasta():
    return os.environ.get("GAMING_PASTA_PRONTOS") or os.path.join(RAIZ, "prontos")


def _nome(titulo, limite=70):
    t = unicodedata.normalize("NFKC", str(titulo or "")).strip()
    t = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", t)        # forbidden on Windows
    t = re.sub(r"[^\w\s\-!?.,()áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]", "", t)  # emoji and the like
    t = re.sub(r"\s+", " ", t).strip(" .")
    return t[:limite].rstrip(" .") or "Corte"


def texto(clip):
    titulo = (clip.get("video_title_for_youtube_short") or clip.get("title") or "Gameplay").strip()
    desc = (clip.get("description") or clip.get("video_description_for_instagram") or "").strip()
    tags = clip.get("hashtags") if isinstance(clip.get("hashtags"), list) else []
    tags = " ".join(str(t) for t in tags[:30])
    partes = ["TÍTULO", titulo, "", "DESCRIÇÃO", desc]
    if tags and tags not in desc:
        partes += ["", "HASHTAGS", tags]
    return "\n".join(partes).strip() + "\n"


def entregar(arquivo, clip, indice, agora=None):
    """Copy a finished clip (+ its .txt) into today's folder. Returns the mp4 path or None."""
    if not arquivo or not os.path.isfile(arquivo):
        return None
    dia = (agora or datetime.now()).strftime("%Y-%m-%d")
    destino = os.path.join(pasta(), dia)
    os.makedirs(destino, exist_ok=True)
    base = f"{indice + 1:02d} - {_nome(clip.get('video_title_for_youtube_short') or clip.get('title'))}"
    final = os.path.join(destino, base + ".mp4")
    n = 2
    while os.path.exists(final):                       # never overwrite an earlier clip
        final = os.path.join(destino, f"{base} ({n}).mp4")
        n += 1
    shutil.copy2(arquivo, final)
    with open(final[:-4] + ".txt", "w", encoding="utf-8", newline="\r\n") as f:
        f.write(texto(clip))
    os.utime(final, None)                              # "new" = arrived now, not when rendered
    return final


def _visto():
    try:
        return float(open(os.path.join(pasta(), VISTO), encoding="utf-8").read().strip() or 0)
    except (OSError, ValueError):
        return 0.0


def lista():
    """Every delivered clip, newest first, with whether it is new."""
    raiz, visto, itens = pasta(), _visto(), []
    if os.path.isdir(raiz):
        for dia in sorted(os.listdir(raiz), reverse=True):
            d = os.path.join(raiz, dia)
            if not (os.path.isdir(d) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", dia)):
                continue
            for nome in os.listdir(d):
                if not nome.lower().endswith(".mp4"):
                    continue
                p = os.path.join(d, nome)
                em = os.path.getmtime(p)
                itens.append({"dia": dia, "nome": nome, "caminho": f"{dia}/{nome}", "em": em,
                              "bytes": os.path.getsize(p), "novo": em > visto,
                              "tem_texto": os.path.isfile(p[:-4] + ".txt")})
    itens.sort(key=lambda i: -i["em"])
    return {"pasta": raiz, "itens": itens, "novos": sum(1 for i in itens if i["novo"]), "total": len(itens)}


def marcar_visto(agora=None):
    os.makedirs(pasta(), exist_ok=True)
    with open(os.path.join(pasta(), VISTO), "w", encoding="utf-8") as f:
        f.write(str(agora or time.time()))
    return lista()


def arquivo(caminho):
    """Safe absolute path of one delivered file ("dia/nome.mp4|.txt"), or None."""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}/[^/\\]+\.(mp4|txt)", caminho or ""):
        return None
    raiz = os.path.realpath(pasta())
    p = os.path.realpath(os.path.join(raiz, caminho))
    return p if p.startswith(raiz + os.sep) and os.path.isfile(p) else None


def zip_novos(destino):
    """Zip of the new clips and their .txt (for a phone, or a codespace)."""
    novos = [i for i in lista()["itens"] if i["novo"]]
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_STORED) as z:
        for i in novos:
            p = os.path.join(pasta(), i["caminho"])
            z.write(p, i["caminho"])
            if i["tem_texto"]:
                z.write(p[:-4] + ".txt", i["caminho"][:-4] + ".txt")
    return len(novos)


def resumo_json():
    return json.dumps({k: v for k, v in lista().items() if k != "itens"})
