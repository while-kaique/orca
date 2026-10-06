# Instala a caixa-preta do Orca como tarefa agendada com privilégio de administrador.
# Roda ao entrar no Windows, reinicia sozinha se cair, sem janela.
# Requisito: python -m pip install --user pywintrace psutil
# Rodar uma vez (pede o "Sim" do Windows):  powershell -ExecutionPolicy Bypass -File instalar.ps1

$script = Join-Path $PSScriptRoot 'caixa-preta.py'
$pythonw = Join-Path (Split-Path (Get-Command python).Source) 'pythonw.exe'
$usuario = "$env:USERDOMAIN\$env:USERNAME"

$acao = New-ScheduledTaskAction -Execute $pythonw -Argument "`"$script`""
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $usuario
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Highest
$config = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName 'Orca caixa-preta' -Action $acao -Trigger $gatilho -Principal $principal `
  -Settings $config -Force | Out-Null
Stop-ScheduledTask -TaskName 'Orca caixa-preta' -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName 'Orca caixa-preta'
Start-Sleep -Seconds 4
Get-ScheduledTask -TaskName 'Orca caixa-preta' | Select-Object TaskName, State
