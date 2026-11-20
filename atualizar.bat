@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title OpenShorts Gaming Edition - Atualizar

echo ============================================================
echo   ATUALIZAR OPENSHORTS GAMING EDITION
echo ============================================================
echo.
echo Baixa a versao nova do GitHub e religa o sistema.
echo Seus videos, cortes, chaves e o .env NAO sao apagados.
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Git nao encontrado. Instale em https://git-scm.com/download/win
    goto :falha
)
docker info >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Docker Desktop nao esta em execucao.
    echo        Abra o Docker Desktop, aguarde "Engine running" e rode de novo.
    goto :falha
)

rem --- Nao interrompe um video sendo processado ------------------------------
call :porta backend 8000 8000 PORTA_API
set "FILA="
where curl >nul 2>nul
if not errorlevel 1 (
    for /f "usebackq delims=" %%Q in (`curl -s -m 5 "http://localhost:%PORTA_API%/api/gaming/queue" 2^>nul`) do set "FILA=%%Q"
)
rem With the access password on, the answer is a login error (no
rem jobs_active): only a real queue answer can mean "busy".
if defined FILA echo !FILA! | findstr "jobs_active" >nul || set "FILA="
if defined FILA (
    echo !FILA! | findstr /R "jobs_active.:0" >nul
    if errorlevel 1 (
        echo [AVISO] Ha um video sendo processado. Atualizar agora interrompe ele.
        choice /c SN /n /m "Atualizar mesmo assim? [S/N] "
        if errorlevel 2 (
            echo Atualizacao cancelada.
            goto :fim
        )
    )
)

echo [INFO] Baixando a versao nova...
git pull --ff-only origin main
if errorlevel 1 (
    echo.
    echo [ERRO] Nao consegui baixar. Se houver arquivos alterados neste PC,
    echo        rode:  git stash   e depois este arquivo de novo.
    goto :falha
)

echo.
echo [INFO] Atualizando as pecas do sistema ^(pode levar alguns minutos^)...
docker compose build
if errorlevel 1 (
    echo [ERRO] Falha ao montar a versao nova. Confira a mensagem acima.
    goto :falha
)
docker compose up -d
if errorlevel 1 (
    echo [ERRO] Nao foi possivel religar. Confira a mensagem acima.
    goto :falha
)

echo.
echo [OK] Atualizado e ligado. Recarregue o painel no navegador e no celular.
:fim
echo.
pause
exit /b 0

:falha
echo.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem :porta SERVICO PORTA_INTERNA PADRAO VARIAVEL
rem ---------------------------------------------------------------------------
:porta
set "%4=%3"
for /f "tokens=1-4 delims=:" %%A in ('docker compose port %1 %2 2^>nul') do (
    if not "%%D"=="" (
        set "%4=%%D"
    ) else if not "%%C"=="" (
        set "%4=%%C"
    ) else if not "%%B"=="" (
        set "%4=%%B"
    )
)
exit /b 0
