// Fork (o-041 parte 5): the process tree of this Orca's terminal guards, ended on a close by X.
import { execFile } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { marcarTempoDoX } from './fork-close-timing'

export type PidDoGuarda = { pid: number; startedAtMs: number | null }

function guardasDeTerminais(): PidDoGuarda[] {
  const pasta = join(app.getPath('userData'), 'daemon')
  try {
    return readdirSync(pasta)
      .filter((nome) => nome.endsWith('.pid'))
      .map((nome) => {
        try {
          const dados = JSON.parse(readFileSync(join(pasta, nome), 'utf8'))
          return { pid: Number(dados.pid), startedAtMs: Number(dados.startedAtMs) || null }
        } catch {
          return null
        }
      })
      .filter((item): item is PidDoGuarda => Boolean(item?.pid))
  } catch {
    return []
  }
}

function rodar(comando: string, args: string[], prazoMs: number): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      comando,
      args,
      { encoding: 'utf8', windowsHide: true, timeout: prazoMs },
      (_erro, saida) => resolve(String(saida ?? ''))
    )
  })
}

export type Processo = { pid: number; pai: number; nascido: number }

/** Todos os processos da maquina com pai e hora de nascimento (Windows). */
async function fotoDosProcessos(): Promise<Processo[]> {
  const saida = await rodar(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.ParentProcessId)`t$(if ($_.CreationDate) { [DateTimeOffset]::new($_.CreationDate).ToUnixTimeMilliseconds() } else { 0 })" }'
    ],
    10_000
  )
  return saida
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((linha) => {
      const [pid, pai, nascido] = linha.split('\t').map(Number)
      return { pid, pai, nascido }
    })
}

/**
 * A arvore dos guardas de terminais deste Orca pelo processo pai. O pid do arquivo so vale se o processo vivo nasceu
 * junto com o guarda daquele arquivo (pid reaproveitado por outro programa nunca entra); o filho tem de ter nascido
 * depois do pai.
 */
export function arvoreDosGuardas(lista: Processo[], guardas: PidDoGuarda[]): Processo[] {
  const porPid = new Map(lista.map((p) => [p.pid, p]))
  const dentro = new Set(
    guardas
      .filter((g) => {
        const vivo = porPid.get(g.pid)
        return vivo && (g.startedAtMs === null || Math.abs(vivo.nascido - g.startedAtMs) < 15_000)
      })
      .map((g) => g.pid)
  )
  for (let mudou = true; mudou;) {
    mudou = false
    for (const p of lista) {
      const pai = porPid.get(p.pai)
      if (!dentro.has(p.pid) && dentro.has(p.pai) && pai && pai.nascido <= p.nascido) {
        dentro.add(p.pid)
        mudou = true
      }
    }
  }
  return lista.filter((p) => dentro.has(p.pid))
}

/**
 * Para os chats deste Orca: guarda a arvore dos guardas de terminais (claude, claude.exe.old, node, python, shells),
 * pede o desligamento normal do guarda e depois mata o que sobrou daquela arvore, conferindo pid e hora de nascimento.
 * Nunca por nome: outro Orca e Claude fora do Orca nao estao nessa arvore. Grava o que sobrou depois do guarda (o-044).
 */
export async function stopForkChatTree(desligarGuarda: () => Promise<void>): Promise<void> {
  marcarTempoDoX('arvore-inicio')
  const guardas = guardasDeTerminais()
  const antes =
    process.platform === 'win32' && guardas.length > 0
      ? arvoreDosGuardas(await fotoDosProcessos(), guardas)
      : []
  const inicio = Date.now()
  await Promise.race([desligarGuarda().catch(() => {}), new Promise((r) => setTimeout(r, 4_000))])
  const desligarGuardaMs = Date.now() - inicio
  const agora =
    antes.length === 0 ? new Map() : new Map((await fotoDosProcessos()).map((p) => [p.pid, p]))
  const sobras = antes.filter((p) => agora.get(p.pid)?.nascido === p.nascido)
  try {
    writeFileSync(
      join(app.getPath('userData'), 'fork-x-arvore.json'),
      JSON.stringify({
        em: new Date().toISOString(),
        guardas: guardas.length,
        antes: antes.length,
        sobras: sobras.length,
        desligarGuardaMs
      })
    )
  } catch {
    // The record is evidence only.
  }
  if (sobras.length === 0) {
    return
  }
  for (let i = 0; i < sobras.length; i += 40) {
    const lote = sobras.slice(i, i + 40)
    await rodar('taskkill', ['/F', '/T', ...lote.flatMap((p) => ['/PID', String(p.pid)])], 5_000)
  }
}
