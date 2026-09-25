@echo off
rem Abre a versao modificada do Orca (fork "PC como mesa"), separada do Orca instalado.
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
rem Nomes curtos nas dependencias: o compilador do Windows falha com caminho longo.
set "pnpm_config_virtual_store_dir_max_length=30"
rem Perfil proprio (copia dos seus projetos), para nao disputar dados com o Orca instalado.
set "ORCA_DEV_USER_DATA_PATH=%APPDATA%\orca-fork"
rem Liga o Orca Relay: o modo dev nao traz o endereco oficial de login, entao passamos aqui.
set "ORCA_CLOUD_API_URL=https://login.onorca.dev"
set "ORCA_CLOUD_CLIENT_ID=orca-desktop"
if not exist "%ORCA_DEV_USER_DATA_PATH%" (
  echo Copiando seus projetos do Orca instalado para o perfil do fork...
  robocopy "%APPDATA%\orca\profiles" "%ORCA_DEV_USER_DATA_PATH%\profiles" /E /NFL /NDL /NJH /NJS >nul
  copy /Y "%APPDATA%\orca\orca-profile-index.json" "%ORCA_DEV_USER_DATA_PATH%\" >nul
)
rem Grava a saida do app (avisos do processo principal) para investigar quedas depois.
set "ORCA_LOG_DIR=%ORCA_DEV_USER_DATA_PATH%\logs"
if not exist "%ORCA_LOG_DIR%" mkdir "%ORCA_LOG_DIR%"
if exist "%ORCA_LOG_DIR%\main-console.log" move /Y "%ORCA_LOG_DIR%\main-console.log" "%ORCA_LOG_DIR%\main-console.anterior.log" >nul
cd /d "%~dp0"
rem O modo dev reescreve out\, entao a montagem do atalho deixa de valer.
if exist "out\.pc-desk-build-key" del "out\.pc-desk-build-key"
echo === aberto em %DATE% %TIME% ===>> "%ORCA_LOG_DIR%\main-console.log"
pnpm dev-stable-name >> "%ORCA_LOG_DIR%\main-console.log" 2>&1
