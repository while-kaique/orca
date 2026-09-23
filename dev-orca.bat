@echo off
rem Abre a versao modificada do Orca (fork "PC como mesa"), separada do Orca instalado.
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
rem Pasta curta para as dependencias: o compilador do Windows falha com caminho longo.
set "pnpm_config_virtual_store_dir=C:/pvs/orca"
rem Perfil proprio (copia dos seus projetos), para nao disputar dados com o Orca instalado.
set "ORCA_DEV_USER_DATA_PATH=%APPDATA%\orca-fork"
if not exist "%ORCA_DEV_USER_DATA_PATH%" (
  echo Copiando seus projetos do Orca instalado para o perfil do fork...
  robocopy "%APPDATA%\orca\profiles" "%ORCA_DEV_USER_DATA_PATH%\profiles" /E /NFL /NDL /NJH /NJS >nul
  copy /Y "%APPDATA%\orca\orca-profile-index.json" "%ORCA_DEV_USER_DATA_PATH%\" >nul
)
cd /d "%~dp0"
pnpm dev-stable-name
