@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title OpenShorts Gaming Edition - Senha de acesso

echo ============================================================
echo   SENHA DE ACESSO DO PAINEL
echo ============================================================
echo.
echo Sem senha, o painel so abre neste computador (padrao).
echo Defina uma senha ANTES de abrir o painel na rede ou na internet.
echo A senha nao fica gravada: o .env guarda so um codigo (hash) dela.
echo.

docker info >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Docker Desktop nao esta em execucao.
    echo        Abra o Docker Desktop, aguarde "Engine running" e rode de novo.
    goto :falha
)

echo   1 - Definir ou trocar a senha
echo   2 - Remover a senha
echo.
choice /c 12 /n /m "Escolha 1 ou 2: "
if errorlevel 2 (set "ACAO=remover-senha") else (set "ACAO=definir-senha")

echo.
docker compose run --rm --no-deps backend python acesso_local.py %ACAO%
if errorlevel 1 (
    echo.
    echo [ERRO] Nada foi alterado. Confira a mensagem acima.
    goto :falha
)

docker compose ps --status running backend 2>nul | findstr /i "openshorts-backend" >nul
if not errorlevel 1 (
    echo [INFO] Reiniciando o servidor para aplicar...
    docker compose restart backend >nul
)
echo.
echo [OK] Pronto. Se o painel estiver aberto, atualize a pagina (F5).
echo.
pause
exit /b 0

:falha
echo.
pause
exit /b 1
