#!/usr/bin/env bash
# Pega a versão mais nova do GitHub e reinicia o sistema.
# Uso: bash .devcontainer/atualizar.sh
#
# Vídeos enviados, cortes gerados e o arquivo .env NÃO são apagados (ficam fora
# do controle do git). Alterações feitas à mão nos arquivos do código são
# descartadas: o código passa a ser exatamente o do GitHub.
cd "$(dirname "$0")/.."

ramo="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
[ -z "$ramo" ] || [ "$ramo" = "HEAD" ] && ramo=main

echo "1/4 Baixando a versão nova do GitHub (ramo $ramo)..."
antes="$(git rev-parse HEAD 2>/dev/null)"
if ! git fetch origin "$ramo"; then
  echo "Não consegui falar com o GitHub. Confira a internet do codespace e tente de novo."
  exit 1
fi
git reset --hard "origin/$ramo" >/dev/null
depois="$(git rev-parse HEAD)"
echo "    Versão: $(git log --oneline -1)"

mudou() { [ -n "$antes" ] && ! git diff --quiet "$antes" "$depois" -- "$@"; }

echo "2/4 Conferindo dependências..."
if mudou requirements.txt; then
  echo "    Dependências do servidor mudaram: instalando (pode levar alguns minutos)..."
  .venv/bin/pip install -q -r requirements.txt
fi
if mudou dashboard/package.json dashboard/package-lock.json; then
  echo "    Dependências do painel mudaram: instalando..."
  (cd dashboard && npm install --no-audit --no-fund >/dev/null)
fi

echo "3/4 Desligando a versão antiga..."
pkill -f "uvicorn app:app" 2>/dev/null
pkill -f "vite --port 5173" 2>/dev/null
for _ in $(seq 1 45); do
  pgrep -f "uvicorn app:app" >/dev/null || pgrep -f "vite --port 5173" >/dev/null || break
  sleep 2
done
pkill -9 -f "uvicorn app:app" 2>/dev/null
pkill -9 -f "vite --port 5173" 2>/dev/null

echo "4/4 Ligando a versão nova..."
bash .devcontainer/iniciar.sh
echo ""
echo "Se o painel já estava aberto, recarregue a página (no app do celular: feche e abra de novo)."
