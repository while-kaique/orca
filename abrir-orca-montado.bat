@echo off
rem Abre o fork do Orca no modo MONTADO: monta o app uma vez (~10 s) e roda sem recarregar
rem quando o codigo muda. Para editar o Orca com recarga automatica, use dev-orca.bat.
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
set "pnpm_config_virtual_store_dir_max_length=30"
set "ORCA_DEV_USER_DATA_PATH=%APPDATA%\orca-fork"
set "ORCA_CLOUD_API_URL=https://login.onorca.dev"
set "ORCA_CLOUD_CLIENT_ID=orca-desktop"
set "ELECTRON_RUN_AS_NODE="
if not exist "%ORCA_DEV_USER_DATA_PATH%" (
  robocopy "%APPDATA%\orca\profiles" "%ORCA_DEV_USER_DATA_PATH%\profiles" /E /NFL /NDL /NJH /NJS >nul
  copy /Y "%APPDATA%\orca\orca-profile-index.json" "%ORCA_DEV_USER_DATA_PATH%\" >nul
)
set "ORCA_LOG_DIR=%ORCA_DEV_USER_DATA_PATH%\logs"
if not exist "%ORCA_LOG_DIR%" mkdir "%ORCA_LOG_DIR%"
if exist "%ORCA_LOG_DIR%\main-console.log" move /Y "%ORCA_LOG_DIR%\main-console.log" "%ORCA_LOG_DIR%\main-console.anterior.log" >nul
set "LOG=%ORCA_LOG_DIR%\main-console.log"
cd /d "%~dp0"
echo === modo montado, aberto em %DATE% %TIME% ===>> "%LOG%"
call pnpm run build:electron-vite >> "%LOG%" 2>&1
if errorlevel 1 goto dev
call pnpm run ensure:electron-runtime >> "%LOG%" 2>&1
call npx electron-vite preview --skipBuild >> "%LOG%" 2>&1
if errorlevel 1 goto dev
exit /b 0

:dev
rem Se montar ou abrir falhar, cai no modo dev para voce nunca ficar sem o app.
echo === falhou (errorlevel %ERRORLEVEL%), abrindo em modo dev %TIME% ===>> "%LOG%"
call "%~dp0dev-orca.bat"
