' Abre o fork do Orca ("PC como mesa") sem janela de console, no modo montado.
' 1) Orca ja aberto: so traz a janela para a frente (nunca abre um segundo).
' 2) Ja abrindo: a tela "Abrindo o Orca" ja esta na tela; so a traz para a frente.
' 3) Orca fechado mas com chats ainda trabalhando (queda): mostra quais e pergunta se abre (o-041).
' 4) Senao: mostra a tela de abertura na hora e monta/abre o Orca por tras.
' Opcoes so para teste: /dados:PERFIL /pasta:REPOSITORIO /abrir:"COMANDO" (sem elas, e o Orca em uso).
Option Explicit
Dim sh, fso, appData, logDir, pasta, dados, abrir
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appData = sh.ExpandEnvironmentStrings("%APPDATA%")
dados = appData & "\orca-fork"
pasta = "C:\Users\User\Desktop\Projetos\orca"
abrir = ""
If WScript.Arguments.Named.Exists("dados") Then dados = WScript.Arguments.Named("dados")
If WScript.Arguments.Named.Exists("pasta") Then pasta = WScript.Arguments.Named("pasta")
If WScript.Arguments.Named.Exists("abrir") Then abrir = WScript.Arguments.Named("abrir")
logDir = dados & "\logs"

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

' O guarda de terminais deste Orca ainda roda? So ele mantem chat vivo com o Orca fechado.
Function GuardaVivo()
  Dim pastaGuarda, arquivo, f, texto, achado, re
  GuardaVivo = False
  pastaGuarda = dados & "\daemon"
  If Not fso.FolderExists(pastaGuarda) Then Exit Function
  Set re = New RegExp
  re.Pattern = """pid""\s*:\s*(\d+)"
  For Each arquivo In fso.GetFolder(pastaGuarda).Files
    If LCase(fso.GetExtensionName(arquivo.Name)) = "pid" Then
      Set f = fso.OpenTextFile(arquivo.Path, 1)
      texto = f.ReadAll
      f.Close
      Set achado = re.Execute(texto)
      If achado.Count > 0 Then
        If GetObject("winmgmts:").ExecQuery("SELECT ProcessId FROM Win32_Process WHERE ProcessId=" & achado(0).SubMatches(0)).Count > 0 Then
          GuardaVivo = True
          Exit Function
        End If
      End If
    End If
  Next
End Function

' A porta da hierarquia: a lista dos chats trabalhando (vazia quando pode abrir). Roda escondida, sem janela de cmd.
Function ChatsTrabalhando()
  Dim saida, comando, f
  ChatsTrabalhando = ""
  saida = sh.ExpandEnvironmentStrings("%TEMP%") & "\orca-porta-atalho.txt"
  If fso.FileExists(saida) Then fso.DeleteFile saida, True
  comando = "cmd /c set ""HIERARQUIA_ORCA_DADOS=" & dados & """ && node """ & pasta & "\skills\hierarquia\hierarquia.mjs"" porta --rapido --atalho > """ & saida & """ 2>nul"
  sh.Run comando, 0, True
  If fso.FileExists(saida) Then
    If fso.GetFile(saida).Size > 0 Then
      Set f = fso.OpenTextFile(saida, 1)
      ChatsTrabalhando = Trim(f.ReadAll)
      f.Close
    End If
  End If
End Function

If ArquivoEmUso(dados & "\lockfile") Then
  sh.AppActivate "Orca"
  WScript.Quit 0
End If
If TelaAbrindoAberta() Then
  sh.AppActivate "Abrindo o Orca"
  WScript.Quit 0
End If

If GuardaVivo() Then
  Dim lista, resposta
  lista = ChatsTrabalhando()
  If Len(lista) > 900 Then lista = Left(lista, 900) & vbCrLf & "..."
  If Len(lista) > 0 Then
    resposta = MsgBox("O Orca fechou sem parar estes chats, e eles continuam trabalhando:" & vbCrLf & vbCrLf & lista & vbCrLf & vbCrLf & "Abrir o Orca agora? Ele se reconecta a esses chats sem corta-los.", vbYesNo + vbExclamation + vbDefaultButton1, "Abrir o Orca")
    If resposta <> vbYes Then WScript.Quit 0
  End If
End If

If abrir <> "" Then
  sh.Run abrir, 0, False
  WScript.Quit 0
End If

If Not fso.FolderExists(logDir) Then fso.CreateFolder logDir
On Error Resume Next
fso.DeleteFile logDir & "\abertura-etapa-*", True
On Error GoTo 0
sh.Run "mshta.exe """ & pasta & "\tools\abertura\tela-abrindo.hta"" """ & logDir & """", 1, False
sh.Run """" & pasta & "\abrir-orca-montado.bat""", 0, False
