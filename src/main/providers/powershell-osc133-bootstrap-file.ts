/**
 * Ships the PowerShell OSC 133 bootstrap as a file and puts only a short loader
 * on the command line.
 *
 * Why: on Windows hosts with Defender real-time protection, CreateProcess for
 * `powershell.exe -EncodedCommand <~15KB of base64>` was measured at 7.7-9.3s
 * versus ~0.2s for a short command, because the command line itself is scanned
 * before the process may start. node-pty's ConPTY connect runs that CreateProcess
 * synchronously, so every new terminal froze the whole terminal daemon for those
 * seconds and the renderer's 5s launch watchdog reported "the terminal did not
 * start". Same payload via this loader: ~0.9s to spawn, half the time to prompt.
 *
 * Why Invoke-Expression over Get-Content and not `-File`/dot-sourcing: dot-sourcing
 * a .ps1 is execution-policy gated (blocked under Restricted/AllSigned), inline
 * text is not -- see powershell-osc133-bootstrap.ts. Both cmdlets run in
 * ConstrainedLanguage, and Invoke-Expression evaluates in the caller's (global)
 * scope, so the payload behaves exactly as when it was the encoded command.
 */
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { quoteStartupArg } from '../../shared/tui-agent-startup-shell'
import { getPowerShellOsc133Bootstrap } from '../powershell-osc133-bootstrap'
import { writeShellWrapperFiles } from '../shell-wrapper-file-writer'

const BOOTSTRAP_HASH_LENGTH = 16
// Why: PowerShell also closes a single-quoted string on typographic quotes, so a
// path holding one cannot be quoted safely; such hosts keep the inline payload.
const POWERSHELL_EXTRA_QUOTE_CHARS = new RegExp(
  `[${String.fromCharCode(0x2018, 0x2019, 0x201a, 0x201b)}]`
)
// Why the BOM: Windows PowerShell 5.1 reads BOM-less files as the ANSI code page.
const UTF8_BOM = String.fromCharCode(0xfeff)

function getBootstrapFilePath(script: string): string | null {
  // Why only under ORCA_USER_DATA_PATH: it is seeded before anything spawns in
  // production (main and the daemon fork share it); without it there is no
  // per-user directory we trust, so the inline payload stays.
  const userDataPath = process.env.ORCA_USER_DATA_PATH
  if (!userDataPath) {
    return null
  }
  const digest = createHash('sha256').update(script).digest('hex').slice(0, BOOTSTRAP_HASH_LENGTH)
  const path = join(userDataPath, 'shell-wrappers', digest, 'powershell', 'orca-osc133.ps1')
  return POWERSHELL_EXTRA_QUOTE_CHARS.test(path) ? null : path
}

function isNonEmptyFile(path: string): boolean {
  try {
    return statSync(path).size > 0
  } catch {
    return false
  }
}

/** Path of this build's bootstrap file, written on first use; null keeps the inline payload. */
export function ensurePowerShellOsc133BootstrapFile(): string | null {
  const script = getPowerShellOsc133Bootstrap()
  const path = getBootstrapFilePath(script)
  if (!path) {
    return null
  }
  // Why existence decides: the directory is named after a hash of the content,
  // so a non-empty file there is this exact payload (atomic temp+rename write).
  if (isNonEmptyFile(path)) {
    return path
  }
  const written = writeShellWrapperFiles([[path, `${UTF8_BOM}${script}`]], '[powershell-osc133]')
  return written && isNonEmptyFile(path) ? path : null
}

/** The OSC 133 bootstrap as PowerShell source: a short file loader, or the full payload inline. */
export function getPowerShellOsc133BootstrapSource(): string {
  const path = ensurePowerShellOsc133BootstrapFile()
  if (!path) {
    return getPowerShellOsc133Bootstrap()
  }
  const quotedPath = quoteStartupArg(path, 'powershell')
  return `if (Test-Path -LiteralPath ${quotedPath}) { Invoke-Expression (Get-Content -LiteralPath ${quotedPath} -Raw -Encoding UTF8) }\n`
}
