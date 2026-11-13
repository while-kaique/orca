// A pergunta do atalho e uma janela de verdade do Windows: estas funcoes acham a janela pelo titulo, tiram o print
// so dela (nada do resto da tela) e respondem por ela. Usadas pelo roteiro do atalho (o-041 criterio 4).
import { execFileSync } from 'node:child_process'

const powershell = (comando) =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], {
    encoding: 'utf8',
    windowsHide: true
  }).trim()

const USER32 = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Janela {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
`

/** true quando ha uma janela visivel com exatamente este titulo. */
export function janelaAberta(titulo) {
  return (
    powershell(
      `${USER32}; $h=[Janela]::FindWindow($null,'${titulo}'); if ($h -ne [IntPtr]::Zero -and [Janela]::IsWindowVisible($h)) { 'sim' } else { 'nao' }`
    ) === 'sim'
  )
}

/** Print so da janela (o retangulo dela na tela). */
export function printDaJanela(titulo, arquivo) {
  return powershell(`${USER32}
Add-Type -AssemblyName System.Drawing
$h=[Janela]::FindWindow($null,'${titulo}')
if ($h -eq [IntPtr]::Zero) { 'sem janela'; exit }
$r=New-Object Janela+RECT; [void][Janela]::GetWindowRect($h,[ref]$r)
$w=$r.Right-$r.Left; $a=$r.Bottom-$r.Top
$bmp=New-Object System.Drawing.Bitmap $w,$a
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left,$r.Top,0,0,$bmp.Size)
$bmp.Save('${arquivo}')
"$w x $a"`)
}

/** Responde a pergunta: traz a janela dela para a frente e aperta a tecla ("n" = Nao, "s" = Sim). */
export function responder(titulo, tecla) {
  return powershell(
    `$s=New-Object -ComObject WScript.Shell; if ($s.AppActivate('${titulo}')) { Start-Sleep -Milliseconds 400; $s.SendKeys('${tecla}'); 'respondido' } else { 'sem janela' }`
  )
}
