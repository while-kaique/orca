import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getPowerShellOsc133Bootstrap } from '../powershell-osc133-bootstrap'
import {
  ensurePowerShellOsc133BootstrapFile,
  getPowerShellOsc133BootstrapSource
} from './powershell-osc133-bootstrap-file'
import { resolveWindowsShellLaunchArgs } from './windows-shell-args'

function decodeEncodedCommand(shellArgs: readonly string[]): string {
  const index = shellArgs.indexOf('-EncodedCommand')
  return Buffer.from(shellArgs[index + 1], 'base64').toString('utf16le')
}

describe('PowerShell OSC 133 bootstrap file', () => {
  let previousUserDataPath: string | undefined
  let userDataPath: string

  beforeEach(() => {
    previousUserDataPath = process.env.ORCA_USER_DATA_PATH
    userDataPath = mkdtempSync(join(tmpdir(), 'orca-ps-bootstrap-'))
    process.env.ORCA_USER_DATA_PATH = userDataPath
  })

  afterEach(() => {
    if (previousUserDataPath === undefined) {
      delete process.env.ORCA_USER_DATA_PATH
    } else {
      process.env.ORCA_USER_DATA_PATH = previousUserDataPath
    }
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('writes the exact payload with a UTF-8 BOM under the user data dir', () => {
    const path = ensurePowerShellOsc133BootstrapFile()
    expect(path).not.toBeNull()
    expect(path!.startsWith(join(userDataPath, 'shell-wrappers'))).toBe(true)
    expect(readFileSync(path!, 'utf8')).toBe(`\ufeff${getPowerShellOsc133Bootstrap()}`)
  })

  it('reuses an existing file without rewriting it', () => {
    const path = ensurePowerShellOsc133BootstrapFile()!
    const before = statSync(path).mtimeMs
    expect(ensurePowerShellOsc133BootstrapFile()).toBe(path)
    expect(statSync(path).mtimeMs).toBe(before)
  })

  it('emits a short loader that reads the file by literal path', () => {
    const path = ensurePowerShellOsc133BootstrapFile()!
    const source = getPowerShellOsc133BootstrapSource()
    const quoted = `'${path.replace(/'/g, "''")}'`
    expect(source).toBe(
      `if (Test-Path -LiteralPath ${quoted}) { Invoke-Expression (Get-Content -LiteralPath ${quoted} -Raw -Encoding UTF8) }\n`
    )
  })

  it('keeps the PowerShell command line far below the inline payload size', () => {
    const launch = resolveWindowsShellLaunchArgs('powershell.exe', 'C:\\repo', 'C:\\Users\\me')
    const decoded = decodeEncodedCommand(launch.shellArgs)
    expect(decoded).toContain('Invoke-Expression (Get-Content -LiteralPath')
    expect(decoded).toContain("Set-Location -LiteralPath 'C:\\repo'")
    expect(decoded).not.toContain('Orca OSC 133 shell integration')
    expect(decoded.length).toBeLessThan(getPowerShellOsc133Bootstrap().length / 5)
  })

  it('falls back to the inline payload without a user data dir', () => {
    delete process.env.ORCA_USER_DATA_PATH
    expect(ensurePowerShellOsc133BootstrapFile()).toBeNull()
    expect(getPowerShellOsc133BootstrapSource()).toBe(getPowerShellOsc133Bootstrap())
  })

  it('falls back to the inline payload when the file cannot be written', () => {
    // A regular file where the shell-wrappers directory should be makes mkdir fail.
    writeFileSync(join(userDataPath, 'shell-wrappers'), 'not a directory')
    expect(ensurePowerShellOsc133BootstrapFile()).toBeNull()
    expect(getPowerShellOsc133BootstrapSource()).toBe(getPowerShellOsc133Bootstrap())
  })

  it('falls back to the inline payload when the path holds a typographic quote', () => {
    const quotedDir = mkdtempSync(join(tmpdir(), 'orca-ps-bootstrap-\u2019-'))
    try {
      process.env.ORCA_USER_DATA_PATH = quotedDir
      expect(ensurePowerShellOsc133BootstrapFile()).toBeNull()
    } finally {
      rmSync(quotedDir, { recursive: true, force: true })
    }
  })
})
