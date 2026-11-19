"""Backup of the finished clips and the panel's history (owner, 19-nov-2026).

Everything the panel keeps lives inside the codespace: deleting a codespace
deletes every clip and the publication history with it, and GitHub keeps
only the code. So the panel can hand the owner one .zip and take it back in
a fresh codespace.

What goes in (nothing that can be re-made or that is secret):
  gaming/<file>.json, gaming/covers/*   history: publications, learning,
                                        channel list, timing, game covers
  jobs/<job_id>/<file>                  each finished job: its small files
                                        (metadata, captions, sidecars) and
                                        the delivered file of every clip -
                                        not the source video nor the drafts
  backup.json                           what is inside, for the restore

Keys and the access password live outside output/ and never go in.
"""
import json
import os
import re
import shutil
import time
import zipfile
from urllib.parse import unquote

VERSAO = 1
_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
# A plain file name: no folders, no hidden tricks beyond a leading dot.
_NOME = re.compile(r"^[^/\\\x00]{1,255}$")
_MIDIA = (".mp4", ".mkv", ".webm", ".mov", ".m4a", ".m4v", ".wav", ".aac", ".mp3")
# History files merged on restore (by id) instead of replaced.
HISTORICO = ("publications.json", "canais.json", "aprendizado.json", "tempos.json", "games.json")


def _gaming_dir(output_dir):
    return os.path.join(output_dir, "gaming")


def arquivos(output_dir, tem_cortes, clip_url):
    """[(arcname, path)] of everything the backup carries, in order.

    tem_cortes(job_dir) tells a finished gaming job; clip_url(job_id, meta,
    index, clip) is the library's own "which file is this clip" rule."""
    out = []
    g = _gaming_dir(output_dir)
    for nome in HISTORICO:
        p = os.path.join(g, nome)
        if os.path.isfile(p):
            out.append((f"gaming/{nome}", p))
    capas = os.path.join(g, "covers")
    if os.path.isdir(capas):
        for nome in sorted(os.listdir(capas)):
            p = os.path.join(capas, nome)
            if os.path.isfile(p) and _NOME.match(nome):
                out.append((f"gaming/covers/{nome}", p))
    for job_id in sorted(os.listdir(output_dir)):
        job_dir = os.path.join(output_dir, job_id)
        if not _ID.match(job_id) or not os.path.isdir(job_dir) or not tem_cortes(job_dir):
            continue
        metas = [n for n in os.listdir(job_dir) if n.endswith("_metadata.json")]
        try:
            with open(os.path.join(job_dir, metas[0]), "r", encoding="utf-8") as f:
                shorts = json.load(f).get("shorts") or []
        except (OSError, ValueError, IndexError):
            continue
        entregues = set()
        for i, clip in enumerate(shorts):
            url = clip_url(job_id, os.path.join(job_dir, metas[0]), i, clip)
            if url:
                entregues.add(unquote(url.rsplit("/", 1)[-1].split("?")[0]))
        for nome in sorted(os.listdir(job_dir)):
            p = os.path.join(job_dir, nome)
            if not os.path.isfile(p) or not _NOME.match(nome):
                continue
            if nome.lower().endswith(_MIDIA) and nome not in entregues:
                continue            # source video and draft copies: not needed
            out.append((f"jobs/{job_id}/{nome}", p))
    return out


def resumo(output_dir, tem_cortes, clip_url):
    lista = arquivos(output_dir, tem_cortes, clip_url)
    trabalhos = {a.split("/")[1] for a, _ in lista if a.startswith("jobs/")}
    cortes = sum(1 for a, _ in lista if a.startswith("jobs/") and a.lower().endswith(_MIDIA))
    tamanho = sum(os.path.getsize(p) for _, p in lista)
    return {"trabalhos": len(trabalhos), "cortes": cortes, "bytes": tamanho}


class _Saida:
    """Write-only, unseekable sink: zipfile streams into it, we hand out chunks."""

    def __init__(self):
        self.partes = []

    def write(self, b):
        self.partes.append(bytes(b))
        return len(b)

    def flush(self):
        pass

    def tirar(self):
        dados, self.partes = b"".join(self.partes), []
        return dados


def gerar_zip(output_dir, tem_cortes, clip_url, bloco=1024 * 1024):
    """Yield the backup .zip in chunks, without writing it to disk first
    (the disk may be nearly full, which is when a backup matters most)."""
    lista = arquivos(output_dir, tem_cortes, clip_url)
    saida = _Saida()
    with zipfile.ZipFile(saida, "w", allowZip64=True) as zf:
        manifesto = {"versao": VERSAO, "criado": time.time(), "arquivos": len(lista),
                     **resumo(output_dir, tem_cortes, clip_url)}
        zf.writestr("backup.json", json.dumps(manifesto, ensure_ascii=False, indent=1))
        yield saida.tirar()
        for arc, path in lista:
            info = zipfile.ZipInfo(arc, date_time=time.localtime(os.path.getmtime(path))[:6])
            # Video is already compressed: storing it is as small and much faster.
            info.compress_type = zipfile.ZIP_STORED if arc.lower().endswith(_MIDIA) else zipfile.ZIP_DEFLATED
            try:
                with open(path, "rb") as src, zf.open(info, "w", force_zip64=True) as dst:
                    while True:
                        b = src.read(bloco)
                        if not b:
                            break
                        dst.write(b)
                        if sum(len(p) for p in saida.partes) >= bloco:
                            yield saida.tirar()
            except FileNotFoundError:
                continue            # deleted while we were zipping: skip it
            yield saida.tirar()
    yield saida.tirar()


# --------------------------------------------------------------------------- #
# Restore
# --------------------------------------------------------------------------- #
def _destino(arc):
    """Where a member goes, as ('gaming'|'capa'|'job', job_id, name), or None
    for anything that is not exactly one of our own paths (no ../, no
    absolute paths, no surprise folders)."""
    partes = arc.split("/")
    if len(partes) == 2 and partes[0] == "gaming" and partes[1] in HISTORICO:
        return ("gaming", None, partes[1])
    if len(partes) == 3 and partes[:2] == ["gaming", "covers"] and _NOME.match(partes[2]) and partes[2] not in (".", ".."):
        return ("capa", None, partes[2])
    if len(partes) == 3 and partes[0] == "jobs" and _ID.match(partes[1]) and _NOME.match(partes[2]) \
            and partes[2] not in (".", ".."):
        return ("job", partes[1], partes[2])
    return None


def _ler_json(path, padrao):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return padrao


def _gravar_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _por_id(atual, vindo, chave="id"):
    """Union of two lists of dicts by `chave`; what is here already wins."""
    vistos = {str(x.get(chave)) for x in atual if isinstance(x, dict)}
    novos = [x for x in vindo if isinstance(x, dict) and str(x.get(chave)) not in vistos]
    return atual + novos, len(novos)


def _juntar(nome, atual_path, dados):
    """Merge one history file from the backup into the one here. Returns how
    many entries were added."""
    if nome == "publications.json":
        atual = _ler_json(atual_path, {}).get("items", []) if os.path.exists(atual_path) else []
        itens, n = _por_id(atual, (dados or {}).get("items") or [])
        _gravar_json(atual_path, {"items": itens})
        return n
    if nome == "canais.json":
        atual = _ler_json(atual_path, [])
        itens, n = _por_id(atual if isinstance(atual, list) else [], dados if isinstance(dados, list) else [])
        _gravar_json(atual_path, itens)
        return n
    if nome == "aprendizado.json":
        atual = _ler_json(atual_path, {"posts": {}})
        posts = dict((dados or {}).get("posts") or {})
        posts.update(atual.get("posts") or {})
        n = len(posts) - len(atual.get("posts") or {})
        atual["posts"] = posts
        _gravar_json(atual_path, atual)
        return n
    if nome == "tempos.json":
        atual = _ler_json(atual_path, {"historico": []})
        itens, n = _por_id(atual.get("historico") or [], (dados or {}).get("historico") or [], chave="job")
        atual["historico"] = itens
        _gravar_json(atual_path, atual)
        return n
    if not os.path.exists(atual_path):          # games.json: only when missing
        _gravar_json(atual_path, dados)
        return 1
    return 0


def restaurar(output_dir, zip_path):
    """Put a backup back. Jobs already here are left alone (nothing here is
    ever overwritten); history is merged by id. Returns a summary."""
    try:
        zf = zipfile.ZipFile(zip_path)
    except (zipfile.BadZipFile, OSError):
        raise ValueError("Esse arquivo não é um backup do painel (não é um .zip válido).")
    with zf:
        nomes = zf.namelist()
        if "backup.json" not in nomes:
            raise ValueError("Esse .zip não é um backup do painel (falta o backup.json).")
        precisa = sum(i.file_size for i in zf.infolist())
        livre = shutil.disk_usage(output_dir).free
        if precisa > livre:
            raise ValueError(f"Falta espaço: o backup precisa de {precisa / 1024 ** 3:.1f} GB "
                             f"e há {livre / 1024 ** 3:.1f} GB livres.")
        g = _gaming_dir(output_dir)
        os.makedirs(os.path.join(g, "covers"), exist_ok=True)
        ja_tinha = {j for j in os.listdir(output_dir) if os.path.isdir(os.path.join(output_dir, j))}
        res = {"trabalhos": 0, "trabalhos_ja_existiam": 0, "cortes": 0, "publicacoes": 0,
               "canais": 0, "ignorados": 0}
        trabalhos, pulados = set(), set()
        for info in zf.infolist():
            if info.is_dir() or info.filename == "backup.json":
                continue
            d = _destino(info.filename)
            if not d:
                res["ignorados"] += 1
                continue
            tipo, job_id, nome = d
            if tipo == "gaming":
                try:
                    dados = json.loads(zf.read(info).decode("utf-8"))
                except ValueError:
                    res["ignorados"] += 1
                    continue
                n = _juntar(nome, os.path.join(g, nome), dados)
                if nome == "publications.json":
                    res["publicacoes"] = n
                elif nome == "canais.json":
                    res["canais"] = n
                continue
            if tipo == "capa":
                alvo = os.path.join(g, "covers", nome)
            else:
                if job_id in ja_tinha:
                    pulados.add(job_id)
                    continue
                pasta = os.path.join(output_dir, job_id)
                os.makedirs(pasta, exist_ok=True)
                alvo = os.path.join(pasta, nome)
                trabalhos.add(job_id)
                if nome.lower().endswith(_MIDIA):
                    res["cortes"] += 1
            if os.path.exists(alvo):
                continue
            tmp = alvo + ".restaurando"
            with zf.open(info) as src, open(tmp, "wb") as dst:
                shutil.copyfileobj(src, dst, 1024 * 1024)
            os.replace(tmp, alvo)
            try:
                t = time.mktime(info.date_time + (0, 0, -1))
                os.utime(alvo, (t, t))      # keep the clip's own date: the library sorts by it
            except (OverflowError, ValueError, OSError):
                pass
        res["trabalhos"] = len(trabalhos)
        res["trabalhos_ja_existiam"] = len(pulados)
    return res
