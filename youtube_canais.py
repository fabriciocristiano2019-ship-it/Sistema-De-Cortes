"""Buscar canais: find YouTube videos the owner may cut, with the proof.

YouTube has no "clips allowed" flag, so a video only shows up here with a
reason that can be shown and kept:

  cc     the video carries YouTube's own Creative Commons licence (reuse
         allowed with credit) - checked on the video itself, not trusted from
         the search filter alone;
  texto  the video or channel description says clips are allowed ("cortes
         liberados", "pode fazer cortes"...) and nothing there forbids them;
  lista  a channel the owner added by hand, with the link/print where the
         creator allows clips (a channel without that proof stays "pendente"
         and is never searched).

Every clip made from a result carries a credit line in its descriptions
(see linha_credito). Costs are YouTube Data API quota, free up to 10 000
units a day: a search is 100 units, everything else 1, so a full search
(Creative Commons + "liberados") is ~200 units, about 50 a day.

The API key lives like the Gemini one: ~/.openshorts/youtube_api.key (0600,
outside the repository) or YOUTUBE_API_KEY, never sent back to the browser.
"""
import json
import os
import re
import tempfile
import time
import unicodedata

import httpx

ENV = "YOUTUBE_API_KEY"
API = "https://www.googleapis.com/youtube/v3"
_FORMATO = re.compile(r"^[!-~]{20,200}$")
_CANAL_ID = re.compile(r"^UC[A-Za-z0-9_-]{22}$")
_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
MIN_SEGUNDOS = 120          # shorter videos are already Shorts: nothing to cut


class ChaveErro(ValueError):
    pass


class BuscaErro(RuntimeError):
    pass


# --------------------------------------------------------------------------- #
# API key (same shape as gemini_chave)
# --------------------------------------------------------------------------- #
def path():
    return os.environ.get("OPENSHORTS_YOUTUBE_KEY_FILE") or os.path.join(
        os.path.expanduser("~"), ".openshorts", "youtube_api.key")


def _ler():
    try:
        with open(path(), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def chave():
    return os.environ.get(ENV, "").strip() or _ler()


def status():
    atual = chave()
    if not atual:
        return {"configured": False, "final": None}
    return {"configured": True, "final": atual[-4:],
            "source": "painel" if atual == _ler() else "secret"}


def salvar(valor):
    valor = (valor or "").strip()
    if not _FORMATO.match(valor):
        raise ChaveErro("Isso não parece uma chave da API do YouTube (tem espaço ou é curta demais).")
    destino = path()
    os.makedirs(os.path.dirname(destino), mode=0o700, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(destino), prefix=".yt-")
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(valor + "\n")
        os.replace(tmp, destino)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return status()


def remover():
    try:
        os.remove(path())
    except FileNotFoundError:
        pass
    return status()


def _explicar(code, corpo):
    texto = str(corpo or "")
    if code == 400 and ("API key not valid" in texto or "API_KEY_INVALID" in texto):
        return "Chave inválida. Confira se copiou a chave inteira no Google Cloud."
    if code == 403 and ("quotaExceeded" in texto or "dailyLimitExceeded" in texto):
        return "A cota grátis de hoje acabou (10 000 unidades). Volta amanhã."
    if code == 403 and ("accessNotConfigured" in texto or "has not been used" in texto or "disabled" in texto):
        return "A YouTube Data API v3 não está ativada no projeto dessa chave. Ative em Google Cloud → APIs."
    if code == 403:
        return "O YouTube recusou a chave (403). Confira as restrições da chave no Google Cloud."
    return f"O YouTube respondeu {code}. Tente de novo em instantes."


def _get(client, recurso, params):
    k = chave()
    if not k:
        raise BuscaErro("Falta a chave da API do YouTube (Buscar canais → Chave do YouTube).")
    try:
        r = client.get(f"{API}/{recurso}", params={**params, "key": k})
    except httpx.HTTPError as e:
        raise BuscaErro(f"Não foi possível falar com o YouTube ({type(e).__name__}).")
    if r.status_code != 200:
        raise BuscaErro(_explicar(r.status_code, r.text[:600]))
    return r.json()


def testar(client=None):
    c = client or httpx.Client(timeout=15)
    try:
        _get(c, "videos", {"part": "id", "id": "dQw4w9WgXcQ"})   # 1 unit
    except BuscaErro as e:
        return {"ok": False, "mensagem": str(e)}
    return {"ok": True, "mensagem": "Chave funcionando: a busca no YouTube está liberada."}


# --------------------------------------------------------------------------- #
# Permission in a description
# --------------------------------------------------------------------------- #
def _norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", t)


_PROIBE = [re.compile(p) for p in (
    r"\b(proibid\w*|nao (e |sao |estao )?(permitid|autorizad|liberad)\w*)\b.{0,25}\b(cortes?|clips?|recortes?)\b",
    r"\b(cortes?|clips?|recortes?)\b.{0,25}\b(proibid\w*|nao (sao |estao )?(permitid|autorizad|liberad)\w*)",
    r"\bnao (faca|facam|pode|podem|autorizo)\b.{0,20}\b(cortes?|clips?|recortes?)\b",
    r"\b(no|don.?t) (clips?|clipping|reuploads?)\b",
    r"\bconcessao\b.{0,60}\brevogad",
)]
_LIBERA = [re.compile(p) for p in (
    r"\b(cortes?|recortes?)\b.{0,12}\b(liberad|permitid|autorizad)\w*",
    r"\b(liberad|permitid|autorizad)\w*\b.{0,12}\b(para|pra|a|os)? ?(fazer )?(cortes?|recortes?)\b",
    r"\bpode(m)? (fazer|postar|criar|publicar) (os |seus )?(cortes?|recortes?)\b",
    r"\b(faca|facam|faz) (seus |os )?(cortes?|recortes?)\b",
    r"\bcanais? de cortes? (sao |e |esta |estao )?(bem[- ]?vindos?|liberad\w*|permitid\w*)",
    r"\b(clips?|clipping) (are |is )?(allowed|welcome|permitted)\b",
    r"\bfeel free to clip\b",
)]


def prova_no_texto(texto):
    """The sentence where the creator allows clips, or None (also None when
    anything in the text forbids them: a "no" always wins)."""
    n = _norm(texto)
    if not n or any(p.search(n) for p in _PROIBE):
        return None
    for p in _LIBERA:
        m = p.search(n)
        if m:
            a, b = max(0, m.start() - 70), min(len(n), m.end() + 70)
            return ("…" if a else "") + n[a:b].strip() + ("…" if b < len(n) else "")
    return None


# --------------------------------------------------------------------------- #
# The owner's list of allowed channels
# --------------------------------------------------------------------------- #
SEMENTE = [{"id": "alanzoka", "entrada": "https://www.youtube.com/@alanzoka", "nome": "@alanzoka",
            "canal_id": None, "prova_url": "", "prova_texto": "", "adicionado_em": 0}]


def _arquivo(output_dir):
    d = os.path.join(output_dir, "gaming")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "canais.json")


def _situacao(c):
    return "liberado" if (c.get("prova_url") or c.get("prova_texto")) else "pendente"


def lista(output_dir):
    p = _arquivo(output_dir)
    if not os.path.exists(p):
        _gravar(output_dir, [dict(c, adicionado_em=time.time()) for c in SEMENTE])
    try:
        with open(p, encoding="utf-8") as f:
            itens = json.load(f)
    except (OSError, ValueError):
        itens = []
    return [dict(c, situacao=_situacao(c)) for c in itens if isinstance(c, dict)]


def _gravar(output_dir, itens):
    p = _arquivo(output_dir)
    limpos = [{k: v for k, v in c.items() if k != "situacao"} for c in itens]
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(limpos, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def _url_ok(u):
    u = str(u or "").strip()
    if u and not re.match(r"^https?://\S+$", u):
        raise BuscaErro("O link da prova precisa começar com http:// ou https://")
    return u[:500]


def entrada_canal(texto):
    """'@alanzoka', a channel URL or a UC... id -> ('handle'|'id', value)."""
    t = str(texto or "").strip()
    m = re.search(r"youtube\.com/(@[\w.\-]+)", t) or re.match(r"^(@[\w.\-]+)$", t)
    if m:
        return "handle", m.group(1)
    m = re.search(r"youtube\.com/channel/(UC[\w-]{22})", t)
    if m:
        return "id", m.group(1)
    if _CANAL_ID.match(t):
        return "id", t
    raise BuscaErro("Use o @ do canal, o link do canal ou o código que começa com UC.")


def adicionar(output_dir, entrada, prova_url="", prova_texto="", client=None):
    tipo, valor = entrada_canal(entrada)
    itens = lista(output_dir)
    nome, canal_id = valor, valor if tipo == "id" else None
    if chave():
        c = client or httpx.Client(timeout=15)
        params = {"part": "snippet"}
        params["forHandle" if tipo == "handle" else "id"] = valor
        found = (_get(c, "channels", params).get("items") or [])
        if not found:
            raise BuscaErro("Não achei esse canal no YouTube.")
        canal_id, nome = found[0]["id"], found[0]["snippet"].get("title") or valor
    ident = re.sub(r"[^a-z0-9_-]", "", (canal_id or valor).lower())[:40] or "canal"
    novo = {"id": ident, "entrada": str(entrada).strip()[:200], "nome": str(nome)[:120], "canal_id": canal_id,
            "prova_url": _url_ok(prova_url), "prova_texto": str(prova_texto or "").strip()[:500],
            "adicionado_em": time.time()}
    def mesmo(c):
        if c["id"] == ident or (canal_id and c.get("canal_id") == canal_id):
            return True
        try:
            return entrada_canal(c.get("entrada"))[1].lower() == valor.lower()   # same @ or UC id
        except BuscaErro:
            return False
    itens = [c for c in itens if not mesmo(c)]
    itens.append(novo)
    _gravar(output_dir, itens)
    return dict(novo, situacao=_situacao(novo))


def atualizar(output_dir, ident, prova_url=None, prova_texto=None):
    itens = lista(output_dir)
    for c in itens:
        if c["id"] == ident:
            if prova_url is not None:
                c["prova_url"] = _url_ok(prova_url)
            if prova_texto is not None:
                c["prova_texto"] = str(prova_texto).strip()[:500]
            _gravar(output_dir, itens)
            return dict(c, situacao=_situacao(c))
    return None


def remover_canal(output_dir, ident):
    itens = lista(output_dir)
    resto = [c for c in itens if c["id"] != ident]
    _gravar(output_dir, resto)
    return len(resto) != len(itens)


# --------------------------------------------------------------------------- #
# Search
# --------------------------------------------------------------------------- #
def _segundos(iso):
    m = re.match(r"^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$", str(iso or ""))
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _detalhes(client, ids):
    """videos.list for up to 50 ids -> {id: item}."""
    ids = [i for i in ids if _VIDEO_ID.match(str(i))][:50]
    if not ids:
        return {}
    data = _get(client, "videos", {"part": "snippet,contentDetails,status", "id": ",".join(ids)})
    return {v["id"]: v for v in data.get("items") or []}


def _canais(client, ids):
    ids = sorted({i for i in ids if i})[:50]
    if not ids:
        return {}
    data = _get(client, "channels", {"part": "snippet", "id": ",".join(ids)})
    return {c["id"]: c for c in data.get("items") or []}


def _resultado(v, nivel, prova):
    sn = v.get("snippet") or {}
    thumbs = sn.get("thumbnails") or {}
    thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
    live = sn.get("liveBroadcastContent")
    return {
        "video_id": v["id"], "url": f"https://www.youtube.com/watch?v={v['id']}",
        "titulo": sn.get("title") or "", "canal": sn.get("channelTitle") or "", "canal_id": sn.get("channelId"),
        "publicado": sn.get("publishedAt"), "thumb": thumb,
        "segundos": _segundos((v.get("contentDetails") or {}).get("duration")),
        "ao_vivo": live in ("live", "upcoming"), "nivel": nivel, "prova": prova,
    }


def _pesquisar(client, q, extra, n):
    params = {"part": "snippet", "type": "video", "q": q, "maxResults": n, "regionCode": "BR",
              "relevanceLanguage": "pt", "safeSearch": "moderate", **extra}
    return [i["id"]["videoId"] for i in _get(client, "search", params).get("items") or []
            if (i.get("id") or {}).get("videoId")]


def buscar_cc(client, q, n=15):
    ids = _pesquisar(client, q, {"videoLicense": "creativeCommon"}, n)
    out = []
    for v in _detalhes(client, ids).values():
        # The search filter is only a hint; the licence on the video decides.
        if (v.get("status") or {}).get("license") == "creativeCommon":
            out.append(_resultado(v, "cc", "Licença Creative Commons (CC BY) marcada pelo YouTube neste vídeo: "
                                            "pode reutilizar dando crédito ao canal."))
    return out


def buscar_liberados(client, q, n=25):
    ids = _pesquisar(client, q, {}, n)
    videos = _detalhes(client, ids)
    canais = _canais(client, [(v.get("snippet") or {}).get("channelId") for v in videos.values()])
    out = []
    for v in videos.values():
        sn = v.get("snippet") or {}
        canal_desc = ((canais.get(sn.get("channelId")) or {}).get("snippet") or {}).get("description", "")
        if any(p.search(_norm(t)) for t in (sn.get("description"), canal_desc) for p in _PROIBE):
            continue
        prova = prova_no_texto(sn.get("description"))
        onde = "descrição do vídeo"
        if not prova:
            prova, onde = prova_no_texto(canal_desc), "descrição do canal"
        if prova:
            out.append(_resultado(v, "texto", f'Na {onde}: "{prova}"'))
    return out


def buscar_lista(client, output_dir, por_canal=6):
    out = []
    for c in lista(output_dir):
        if c["situacao"] != "liberado" or not c.get("canal_id"):
            continue
        uploads = "UU" + c["canal_id"][2:]
        data = _get(client, "playlistItems", {"part": "contentDetails", "playlistId": uploads, "maxResults": por_canal})
        ids = [(i.get("contentDetails") or {}).get("videoId") for i in data.get("items") or []]
        prova = "Canal da sua lista: " + (c.get("prova_url") or c.get("prova_texto"))
        out += [_resultado(v, "lista", prova) for v in _detalhes(client, ids).values()]
    return out


def buscar(output_dir, q="", modo="todos", client=None):
    """modo: todos | cc | liberados | lista. Shorts (< 2 min) are dropped."""
    c = client or httpx.Client(timeout=20)
    q = re.sub(r"\s+", " ", str(q or "")).strip()[:120]
    res = []
    if modo in ("todos", "lista"):
        res += buscar_lista(c, output_dir)
    if q and modo in ("todos", "cc"):
        res += buscar_cc(c, q)
    if q and modo in ("todos", "liberados"):
        res += buscar_liberados(c, q)
    vistos, out = set(), []
    for r in res:
        if r["video_id"] in vistos or (r["segundos"] and r["segundos"] < MIN_SEGUNDOS):
            continue
        vistos.add(r["video_id"])
        out.append(r)
    ordem = {"lista": 0, "cc": 1, "texto": 2}
    out.sort(key=lambda r: r.get("publicado") or "", reverse=True)   # newest first...
    out.sort(key=lambda r: ordem[r["nivel"]])                        # ...inside each level
    return out


# --------------------------------------------------------------------------- #
# Credit on every clip
# --------------------------------------------------------------------------- #
def limpar_credito(raw):
    """The credit sent with a job, sanitised; None when absent or unusable."""
    if not isinstance(raw, dict):
        return None
    url = str(raw.get("url") or "").strip()
    if not re.match(r"^https://(www\.|m\.)?(youtube\.com|youtu\.be)/\S+$", url):
        return None
    nivel = raw.get("nivel") if raw.get("nivel") in ("cc", "texto", "lista") else None
    return {"canal": re.sub(r"\s+", " ", str(raw.get("canal") or "")).strip()[:100] or "canal original",
            "url": url[:300], "nivel": nivel, "prova": str(raw.get("prova") or "").strip()[:600]}


def linha_credito(credito):
    if not credito:
        return ""
    lic = " (licença Creative Commons CC BY)" if credito.get("nivel") == "cc" else ""
    return f"Créditos: {credito['canal']} – {credito['url']}{lic}"


def aplicar_credito(clips, credito):
    """Append the credit line to every description a clip is published with."""
    linha = linha_credito(credito)
    if not linha:
        return clips
    for c in clips or []:
        c["credito"] = credito
        for k in ("description", "video_description_for_tiktok", "video_description_for_instagram"):
            atual = str(c.get(k) or "").strip()
            if linha not in atual:
                c[k] = f"{atual}\n\n{linha}".strip()
    return clips
