// Pastas e atalhos que todo o conjunto do Orca de teste divide: raiz do projeto, mundo de teste e espera.
import { execFileSync } from 'node:child_process'
import path from 'node:path'

export const RAIZ = path.resolve(import.meta.dirname, '..', '..')
// Pasta propria desta copia do projeto: duas vistorias de copias diferentes rodando juntas (como dois executores)
// nao podem dividir o mundo de teste, porque cada uma apaga e mata o que cita a pasta dele.
export const MUNDO_PADRAO =
  process.env.VISTORIA_MUNDO ??
  path.join(
    process.env.TEMP ?? process.env.TMPDIR ?? '/tmp',
    `vistoria-fluxograma-${path
      .basename(RAIZ)
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, '-')}`,
    'mundo'
  )

export const TEMP = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp'

export const modoSimulado = () => process.env.ORCA_DE_TESTE_SIMULADO === '1'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export const powershell = (comando) =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], {
    encoding: 'utf8',
    windowsHide: true
  })
