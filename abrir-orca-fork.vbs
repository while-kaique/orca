' Abre o fork do Orca ("PC como mesa") sem janela de console, no modo montado.
' 1) Orca ja aberto: so traz a janela para a frente (nunca abre um segundo).
' 2) Ja abrindo: a tela "Abrindo o Orca" ja esta na tela; so a traz para a frente.
' 3) Senao: mostra a tela de abertura na hora e monta/abre o Orca por tras.
Option Explicit
Dim sh, fso, appData, logDir, pasta
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appData = sh.ExpandEnvironmentStrings("%APPDATA%")
logDir = appData & "\orca-fork\logs"
pasta = "C:\Users\User\Desktop\Projetos\orca"

Function ArquivoEmUso(caminho)
  Dim f
  ArquivoEmUso = False
  If Not fso.FileExists(caminho) Then Exit Function
  On Error Resume Next
  Set f = fso.OpenTextFile(caminho, 8, False)
  If Err.Number <> 0 Then
    ArquivoEmUso = True
  Else
    f.Close
  End If
  Err.Clear
  On Error GoTo 0
End Function

Function TelaAbrindoAberta()
  Dim lista
  Set lista = GetObject("winmgmts:").ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='mshta.exe' AND CommandLine LIKE '%tela-abrindo.hta%'")
  TelaAbrindoAberta = (lista.Count > 0)
End Function

If ArquivoEmUso(appData & "\orca-fork\lockfile") Then
  sh.AppActivate "Orca"
  WScript.Quit 0
End If
If TelaAbrindoAberta() Then
  sh.AppActivate "Abrindo o Orca"
  WScript.Quit 0
End If

If Not fso.FolderExists(logDir) Then fso.CreateFolder logDir
On Error Resume Next
fso.DeleteFile logDir & "\abertura-etapa-*", True
On Error GoTo 0
sh.Run "mshta.exe """ & pasta & "\tools\abertura\tela-abrindo.hta"" """ & logDir & """", 1, False
sh.Run """" & pasta & "\abrir-orca-montado.bat""", 0, False
