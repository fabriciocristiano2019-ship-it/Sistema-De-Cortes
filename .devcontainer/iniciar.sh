#!/usr/bin/env bash
# Liga o servidor e o painel toda vez que o Codespace inicia.
cd "$(dirname "$0")/.."
mkdir -p .logs
if ! pgrep -f "uvicorn app:app" >/dev/null; then
  nohup .venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000 > .logs/servidor.log 2>&1 &
fi
if ! pgrep -f "vite --port 5173" >/dev/null; then
  (cd dashboard && VITE_PROXY_TARGET=http://127.0.0.1:8000 nohup npx vite --port 5173 --host 127.0.0.1 > ../.logs/painel.log 2>&1 &)
fi
echo "Servidor e painel iniciando. Registros em .logs/ (servidor.log e painel.log)."
