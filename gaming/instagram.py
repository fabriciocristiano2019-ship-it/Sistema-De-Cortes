"""Instagram connection check for the Instagram tab (owner, 20-nov-2026).

Publishing to Instagram already goes through the same path as YouTube
(Upload-Post or Postiz); what was missing was a way to see whether the
Instagram account is really connected, on which profile, and to turn it on
for "publicar ao aprovar". This module only reads: it never posts.

Upload-Post: GET /api/uploadposts/users lists the profiles; a connected
network is a dict under ``social_accounts`` (an empty string when it is not).
Postiz: an integration whose identifier is instagram / instagram-standalone.
"""
import os

import httpx

from gaming import postiz

UPLOAD_POST_USERS = "https://api.upload-post.com/api/uploadposts/users"
NOMES_CONTA = ("display_name", "username", "handle", "name")


def _nome(info):
    for k in NOMES_CONTA:
        v = info.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()[:80]
    return None


def perfis_upload_post(data):
    """Upload-Post users payload -> [{perfil, instagram, conta, redes}]."""
    saida = []
    perfis = data.get("profiles") if isinstance(data, dict) else None
    for p in perfis if isinstance(perfis, list) else []:
        if not isinstance(p, dict) or not p.get("username"):
            continue
        contas = p.get("social_accounts") if isinstance(p.get("social_accounts"), dict) else {}
        redes = [r for r in ("youtube", "instagram", "tiktok") if isinstance(contas.get(r), dict)]
        ig = contas.get("instagram")
        saida.append({"perfil": str(p["username"])[:80], "instagram": isinstance(ig, dict),
                      "conta": _nome(ig) if isinstance(ig, dict) else None, "redes": redes})
    return saida


def status(upload_key=None, postiz_key=None, postiz_url=None, perfil=None, client=None):
    """Where Instagram stands. Postiz wins when configured (same rule as approve)."""
    perfil = (perfil or os.environ.get("UPLOAD_POST_USER") or "").strip() or None
    if postiz.configured(postiz_key):
        try:
            itens = postiz.integrations(postiz_key, postiz_url, client=client)
        except postiz.PostizError as e:
            return {"servico": "postiz", "conectado": False, "erro": str(e)}
        except httpx.HTTPError as e:
            return {"servico": "postiz", "conectado": False,
                    "erro": f"Não foi possível falar com o Postiz ({type(e).__name__})."}
        contas = [i for i in itens if str(i.get("identifier") or i.get("providerIdentifier") or "")
                  in postiz.IDENTIFIERS["instagram"]]
        ativa = next((i for i in contas if not i.get("disabled") and not i.get("refreshNeeded")), None)
        erro = None
        if contas and not ativa:
            erro = "A conta do Instagram no Postiz precisa ser reconectada (o acesso expirou)."
        return {"servico": "postiz", "conectado": bool(ativa),
                "conta": (ativa or (contas[0] if contas else {})).get("name"), "erro": erro}

    key = (upload_key or os.environ.get("UPLOAD_POST_API_KEY") or "").strip()
    if not key:
        return {"servico": None, "conectado": False}
    own = client is None
    client = client or httpx.Client(timeout=30)
    try:
        r = client.get(UPLOAD_POST_USERS, headers={"Authorization": f"Apikey {key}"})
    except httpx.HTTPError as e:
        return {"servico": "upload-post", "conectado": False,
                "erro": f"Não foi possível falar com o Upload-Post ({type(e).__name__})."}
    finally:
        if own:
            client.close()
    if r.status_code in (401, 403):
        return {"servico": "upload-post", "conectado": False, "erro": "A chave do Upload-Post foi recusada. Confira em Chaves."}
    if r.status_code != 200:
        return {"servico": "upload-post", "conectado": False, "erro": f"O Upload-Post respondeu com erro {r.status_code}."}
    try:
        perfis = perfis_upload_post(r.json())
    except ValueError:
        perfis = []
    escolhido = next((p for p in perfis if p["perfil"] == perfil), None)
    com_ig = [p for p in perfis if p["instagram"]]
    res = {"servico": "upload-post", "perfis": perfis, "perfil": perfil,
           "conectado": bool(escolhido and escolhido["instagram"]),
           "conta": escolhido["conta"] if escolhido else None, "erro": None}
    if not perfis:
        res["erro"] = "Nenhum perfil criado no Upload-Post ainda."
    elif not perfil:
        res["erro"] = "Escolha qual perfil do Upload-Post o painel usa."
        res["sugestao"] = com_ig[0]["perfil"] if com_ig else perfis[0]["perfil"]
    elif not escolhido:
        res["erro"] = f"O perfil “{perfil}” não existe no Upload-Post."
        res["sugestao"] = com_ig[0]["perfil"] if com_ig else perfis[0]["perfil"]
    elif not escolhido["instagram"]:
        res["erro"] = f"O perfil “{perfil}” ainda não tem o Instagram conectado."
        if com_ig:
            res["sugestao"] = com_ig[0]["perfil"]
    return res
