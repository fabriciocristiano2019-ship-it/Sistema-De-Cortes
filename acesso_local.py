"""Proteções do servidor local (OpenShorts Gaming Edition, modo self-host).

O painel roda no computador do usuário. Este módulo fecha o que um servidor
local ainda deixa aberto:

1. Pedidos de outros sites (CSRF): qualquer página aberta no navegador consegue
   enviar um POST para http://localhost:8000. Pedidos que alteram dados só são
   aceitos quando vêm do próprio painel (Sec-Fetch-Site / Origin).
2. Cabeçalhos de segurança em todas as respostas.
3. Senha de acesso OPCIONAL. Desligada por padrão (o servidor só escuta em
   127.0.0.1). Para abrir o painel na rede ou na internet, defina a senha com
   ``definir-senha.bat``: ela fica guardada só como hash scrypt em
   OPENSHORTS_SENHA_HASH; a sessão é um cookie assinado, HttpOnly e SameSite;
   tentativas erradas são limitadas por endereço e no total.

Uso pela linha de comando (dentro do container ou com o Python do projeto):
    python acesso_local.py definir-senha   # pede a senha e grava o hash no .env
    python acesso_local.py remover-senha   # volta ao acesso sem senha
    python acesso_local.py gerar-hash      # só imprime o hash (para colar no .env)
"""
import base64
import getpass
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import threading
import unicodedata
import time
from collections import deque
from http.cookies import SimpleCookie

COOKIE = "os_sessao"
SESSAO_SEGUNDOS = 7 * 24 * 3600
ENV_SENHA = "OPENSHORTS_SENHA_HASH"
SENHA_MIN = 4
ENV_USUARIO = "OPENSHORTS_USUARIO"
# Login do dono, versionado no repositório (privado): só o hash scrypt da
# senha, nunca a senha. OPENSHORTS_SENHA_HASH (.env ou Secret) tem prioridade.
ARQUIVO_ACESSO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "acesso.json")

# Tentativas de login erradas: por endereço e no total (contra quem troca de IP).
FALHAS_POR_IP = 5
FALHAS_TOTAL = 30
JANELA_FALHAS = 15 * 60

_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1, "dklen": 32}

# Caminhos que funcionam sem sessão: verificação de saúde e a própria entrada.
_LIVRES = ("/health", "/api/acesso/")
# Prefixos protegidos pela senha (o resto do servidor não serve dados).
_PROTEGIDOS = ("/api", "/videos", "/thumbnails", "/gallery", "/video", "/mcp", "/docs", "/redoc", "/openapi.json")

# Origens do próprio painel em uma instalação local (Docker e desenvolvimento).
ORIGENS_PADRAO = (
    "http://localhost:5175", "http://127.0.0.1:5175",
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8000", "http://127.0.0.1:8000",
)

_METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}


# --------------------------------------------------------------------------- #
# Senha (hash scrypt)
# --------------------------------------------------------------------------- #
def gerar_hash(senha: str) -> str:
    if len(senha) < SENHA_MIN:
        raise ValueError(f"A senha precisa ter pelo menos {SENHA_MIN} caracteres.")
    sal = secrets.token_bytes(16)
    dk = hashlib.scrypt(senha.encode("utf-8"), salt=sal, **_SCRYPT)
    b64 = lambda b: base64.b64encode(b).decode("ascii")
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${b64(sal)}${b64(dk)}"


def conferir_senha(senha: str, guardado: str) -> bool:
    try:
        alg, n, r, p, sal, dk = guardado.split("$")
        if alg != "scrypt":
            return False
        sal_b, dk_b = base64.b64decode(sal), base64.b64decode(dk)
        teste = hashlib.scrypt(senha.encode("utf-8"), salt=sal_b, n=int(n), r=int(r), p=int(p), dklen=len(dk_b))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(teste, dk_b)


def _arquivo_acesso():
    return os.environ.get("OPENSHORTS_ACESSO_FILE") or ARQUIVO_ACESSO


def credenciais():
    """(usuario ou None, hash ou ""): do ambiente, senão do acesso.json."""
    env = (os.environ.get(ENV_SENHA) or "").strip()
    if env:
        return ((os.environ.get(ENV_USUARIO) or "").strip() or None), env
    try:
        with open(_arquivo_acesso(), encoding="utf-8") as f:
            d = json.load(f)
        return (str(d.get("usuario") or "").strip() or None), str(d.get("senha_hash") or "").strip()
    except (OSError, ValueError, AttributeError):
        return None, ""


def hash_configurado() -> str:
    return credenciais()[1]


def _normalizar(nome):
    tira = unicodedata.normalize("NFKD", str(nome or ""))
    return "".join(c for c in tira if not unicodedata.combining(c)).strip().casefold()


def usuario_confere(digitado, esperado) -> bool:
    """Sem usuário configurado, qualquer um serve (só a senha conta). Ignora
    acentos e maiúsculas: Fabrício = Fabricio = fabricio."""
    if not esperado:
        return True
    return hmac.compare_digest(_normalizar(digitado).encode(), _normalizar(esperado).encode())


# --------------------------------------------------------------------------- #
# Sessão (cookie assinado)
# --------------------------------------------------------------------------- #
def _chave_sessao():
    """Chave das sessões guardada fora do repositório (0600), para o login
    sobreviver às reinicializações (a atualização automática reinicia o
    servidor). Sem onde gravar, uma chave nova a cada início."""
    caminho = os.environ.get("OPENSHORTS_SESSAO_KEY_FILE") or os.path.join(
        os.path.expanduser("~"), ".openshorts", "sessao.key")
    try:
        with open(caminho, "rb") as f:
            chave = f.read()
        if len(chave) >= 32:
            return chave
    except OSError:
        pass
    chave = secrets.token_bytes(32)
    try:
        os.makedirs(os.path.dirname(caminho), mode=0o700, exist_ok=True)
        fd = os.open(caminho, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(chave)
    except OSError:
        pass
    return chave


_CHAVE = _chave_sessao()


def _assinar(dados: str) -> str:
    return base64.urlsafe_b64encode(hmac.new(_CHAVE, dados.encode(), hashlib.sha256).digest()).decode().rstrip("=")


def criar_sessao(agora=None) -> str:
    exp = int((agora or time.time()) + SESSAO_SEGUNDOS)
    dados = f"{exp}.{secrets.token_urlsafe(12)}"
    return f"{dados}.{_assinar(dados)}"


def sessao_valida(valor: str, agora=None) -> bool:
    try:
        exp, nonce, assinatura = (valor or "").split(".")
        dados = f"{exp}.{nonce}"
        if not hmac.compare_digest(assinatura, _assinar(dados)):
            return False
        return int(exp) > (agora or time.time())
    except ValueError:
        return False


# --------------------------------------------------------------------------- #
# Limite de tentativas
# --------------------------------------------------------------------------- #
class LimiteTentativas:
    def __init__(self, por_ip=FALHAS_POR_IP, total=FALHAS_TOTAL, janela=JANELA_FALHAS):
        self.por_ip, self.total, self.janela = por_ip, total, janela
        self._ip = {}
        self._todas = deque()
        self._lock = threading.Lock()

    def _limpar(self, agora):
        while self._todas and self._todas[0] < agora - self.janela:
            self._todas.popleft()
        for ip in list(self._ip):
            q = self._ip[ip]
            while q and q[0] < agora - self.janela:
                q.popleft()
            if not q:
                del self._ip[ip]

    def bloqueado(self, ip, agora=None):
        """Segundos até poder tentar de novo (0 = liberado)."""
        agora = agora or time.time()
        with self._lock:
            self._limpar(agora)
            q = self._ip.get(ip) or deque()
            if len(q) >= self.por_ip:
                return int(q[0] + self.janela - agora) + 1
            if len(self._todas) >= self.total:
                return int(self._todas[0] + self.janela - agora) + 1
            return 0

    def falhou(self, ip, agora=None):
        agora = agora or time.time()
        with self._lock:
            self._ip.setdefault(ip, deque()).append(agora)
            self._todas.append(agora)

    def acertou(self, ip):
        with self._lock:
            self._ip.pop(ip, None)


LIMITE = LimiteTentativas()


# --------------------------------------------------------------------------- #
# Middleware ASGI
# --------------------------------------------------------------------------- #
def _headers(scope):
    return {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers") or []}


def _https(scope, h):
    return scope.get("scheme") == "https" or h.get("x-forwarded-proto", "").split(",")[0].strip() == "https"


def origens_permitidas():
    extra = [o.strip().rstrip("/") for o in (os.environ.get("ALLOWED_ORIGINS") or "").split(",") if o.strip()]
    return list(dict.fromkeys(list(ORIGENS_PADRAO) + extra))


def pedido_de_outro_site(metodo, h, permitidas):
    """True quando um pedido que altera dados veio de uma página de outro site."""
    if metodo in _METODOS_SEGUROS:
        return False
    site = h.get("sec-fetch-site")
    if site == "cross-site":
        return True
    if site in ("same-origin", "none"):
        # The browser itself says the page and the request share an origin
        # (e.g. the panel behind the Codespaces / dev-server proxy).
        return False
    origem = (h.get("origin") or "").rstrip("/")
    if not origem or origem == "null":
        # Sem Origin: ferramenta de linha de comando ou chamada interna.
        return origem == "null"
    if origem in permitidas:
        return False
    host = h.get("host") or ""
    return not (origem.endswith("://" + host) and host)


def cabecalhos_seguranca(https):
    hs = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"no-referrer"),
        (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=()"),
        (b"cross-origin-opener-policy", b"same-origin"),
        (b"content-security-policy", b"frame-ancestors 'none'; base-uri 'none'; form-action 'self'"),
    ]
    if https:
        hs.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
    return hs


def _precisa_sessao(path):
    if any(path == p.rstrip("/") or path.startswith(p) for p in _LIVRES):
        return False
    return any(path == p or path.startswith(p + "/") for p in _PROTEGIDOS)


def _caminho_bloqueado(path):
    """Arquivos internos que a pasta pública /videos não deve entregar."""
    if not path.startswith("/videos/"):
        return False
    partes = path.split("/")
    if any(p.startswith(".") for p in partes if p):
        return True
    return path.startswith("/videos/gaming/") and path.endswith(".json")


class ProtecaoLocal:
    """Middleware ASGI puro (não interfere em vídeos servidos por partes)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        h = _headers(scope)
        https = _https(scope, h)
        extra = cabecalhos_seguranca(https)
        path = scope.get("path") or "/"
        metodo = scope.get("method", "GET").upper()

        async def responder(status, corpo, mais=()):
            body = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
            await send({"type": "http.response.start", "status": status, "headers": [
                (b"content-type", b"application/json; charset=utf-8"),
                (b"content-length", str(len(body)).encode()), (b"cache-control", b"no-store"), *extra, *mais]})
            await send({"type": "http.response.body", "body": body})

        if pedido_de_outro_site(metodo, h, origens_permitidas()):
            return await responder(403, {"detail": "Pedido recusado: veio de outro site."})
        if _caminho_bloqueado(path):
            return await responder(404, {"detail": "Not Found"})
        if hash_configurado() and _precisa_sessao(path):
            cookie = SimpleCookie()
            try:
                cookie.load(h.get("cookie", ""))
            except Exception:
                pass
            valor = cookie[COOKIE].value if COOKIE in cookie else ""
            if not sessao_valida(valor):
                return await responder(401, {"detail": "Digite a senha de acesso.", "code": "acesso_necessario"})

        async def send_com_cabecalhos(msg):
            if msg["type"] == "http.response.start":
                existentes = {k.lower() for k, _ in msg.get("headers") or []}
                msg = {**msg, "headers": list(msg.get("headers") or []) + [x for x in extra if x[0] not in existentes]}
            await send(msg)

        return await self.app(scope, receive, send_com_cabecalhos)


# --------------------------------------------------------------------------- #
# Rotas de entrada / saída
# --------------------------------------------------------------------------- #
def criar_router():
    from fastapi import APIRouter, HTTPException, Request, Response
    from pydantic import BaseModel, Field

    router = APIRouter()

    class Entrada(BaseModel):
        senha: str = Field(..., min_length=1, max_length=256)
        usuario: str = Field("", max_length=80)

    def _cookie(resp, request, valor, max_age):
        h = {k.lower(): v for k, v in request.headers.items()}
        resp.set_cookie(COOKIE, valor, max_age=max_age, httponly=True, samesite="strict",
                        secure=_https({"scheme": request.url.scheme}, h), path="/")

    @router.get("/api/acesso/estado")
    async def estado(request: Request):
        usuario, guardado = credenciais()
        valor = request.cookies.get(COOKIE, "")
        return {"exige_senha": bool(guardado), "pede_usuario": bool(guardado and usuario),
                "autenticado": (not guardado) or sessao_valida(valor)}

    @router.post("/api/acesso/entrar")
    async def entrar(body: Entrada, request: Request, response: Response):
        usuario, guardado = credenciais()
        if not guardado:
            return {"ok": True, "exige_senha": False}
        ip = request.client.host if request.client else "?"
        espera = LIMITE.bloqueado(ip)
        if espera:
            raise HTTPException(status_code=429, detail=f"Muitas tentativas. Tente de novo em {max(1, espera // 60)} min.",
                                headers={"Retry-After": str(espera)})
        # Both checks always run: the answer time does not tell which one failed.
        senha_ok = conferir_senha(body.senha, guardado)
        if not (usuario_confere(body.usuario, usuario) and senha_ok):
            LIMITE.falhou(ip)
            raise HTTPException(status_code=401,
                                detail="Usuário ou senha incorretos." if usuario else "Senha incorreta.")
        LIMITE.acertou(ip)
        _cookie(response, request, criar_sessao(), SESSAO_SEGUNDOS)
        return {"ok": True}

    @router.post("/api/acesso/sair")
    async def sair(request: Request, response: Response):
        _cookie(response, request, "", 0)
        return {"ok": True}

    return router


# --------------------------------------------------------------------------- #
# Linha de comando
# --------------------------------------------------------------------------- #
def _gravar_env(caminho, valor):
    linhas = []
    if os.path.exists(caminho):
        with open(caminho, "r", encoding="utf-8") as f:
            linhas = f.read().splitlines()
    linhas = [l for l in linhas if not re.match(rf"\s*{ENV_SENHA}\s*=", l)]
    if valor:
        linhas.append(f"{ENV_SENHA}={valor}")
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(linhas) + "\n")
    os.replace(tmp, caminho)


def _pedir_senha():
    s1 = getpass.getpass(f"Nova senha (mínimo {SENHA_MIN} caracteres): ")
    s2 = getpass.getpass("Repita a senha: ")
    if s1 != s2:
        sys.exit("As senhas não conferem. Nada foi alterado.")
    return gerar_hash(s1)


def main(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    try:
        if cmd == "gerar-hash":
            print(f"{ENV_SENHA}={_pedir_senha()}")
        elif cmd == "definir-senha":
            _gravar_env(env, _pedir_senha())
            print("Senha definida. Reinicie o servidor para valer.")
        elif cmd == "remover-senha":
            _gravar_env(env, "")
            print("Senha removida. Reinicie o servidor para valer.")
        else:
            print(__doc__)
            return 2
    except ValueError as e:
        sys.exit(str(e))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
