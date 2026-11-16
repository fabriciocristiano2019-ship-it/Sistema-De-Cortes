@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title OpenShorts Gaming Edition - Encerrar

echo ============================================================
echo   ENCERRANDO OPENSHORTS GAMING EDITION...
echo ============================================================
echo.

docker info >nul 2>nul
if errorlevel 1 (
    echo [INFO] O Docker Desktop nao esta em execucao: nao ha nada para encerrar.
    pause
    exit /b 0
)

rem --- Avisa se houver processamento em andamento (para nao perder trabalho) --
call :porta backend 8000 8000 PORTA_API
set "FILA="
where curl >nul 2>nul
if not errorlevel 1 (
    for /f "usebackq delims=" %%Q in (`curl -s -m 5 "http://localhost:%PORTA_API%/api/gaming/queue" 2^>nul`) do set "FILA=%%Q"
)
if defined FILA (
    echo !FILA! | findstr /R "jobs_active.:0" >nul
    if errorlevel 1 (
        echo [AVISO] Ha um processamento de video em andamento.
        echo         Se encerrar agora, ele sera interrompido ^(o video original
        echo         e os cortes ja prontos continuam salvos^).
        choice /c SN /n /m "Encerrar mesmo assim? [S/N] "
        if errorlevel 2 (
            echo Encerramento cancelado. O sistema continua em execucao.
            pause
            exit /b 0
        )
    )
)

docker compose down
if errorlevel 1 (
    echo [ERRO] Nao foi possivel encerrar os containers. Confira a mensagem acima.
    pause
    exit /b 1
)

echo.
echo [OK] Servicos encerrados com seguranca.
echo      Seus videos continuam nas pastas output e uploads.
echo.
pause
exit /b 0

rem ---------------------------------------------------------------------------
rem :porta SERVICO PORTA_INTERNA PADRAO VARIAVEL
rem Le do Docker a porta realmente publicada ("0.0.0.0:5175" ou "[::]:5175").
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
