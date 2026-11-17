import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '' } }))

import { gravarAbaFechadaDoConsole } from './fork-aba-fechada-diagnostico'

const AGORA = new Date('2026-11-17T20:00:00.000Z')
const MENSAGEM =
  '[fork-aba-fechada] {"ramo":"painel-unico-fecha-aba","aba":"tab-1","painel":"tab-1:leaf-1","ptyId":"pty-9","codigoDeSaida":0,"msDesdeAbrir":10432,"registroDeDormindo":{"origem":"quit","estado":"working","conversa":"dc17dfe2"},"estadoDoAgente":null,"restaurado":true,"morteConfirmadaAoReabrir":false,"digitouNoTerminal":false}'

describe('fork aba fechada diagnostico', () => {
  let pasta: string
  beforeEach(() => {
    pasta = mkdtempSync(join(tmpdir(), 'fork-aba-fechada-'))
  })
  afterEach(() => {
    rmSync(pasta, { recursive: true, force: true })
  })

  it('appends the note of a closed chat tab with the time it was written', () => {
    gravarAbaFechadaDoConsole(MENSAGEM, pasta, AGORA)
    const linhas = readFileSync(join(pasta, 'fork-abas-fechadas.jsonl'), 'utf8').trim().split('\n')
    expect(linhas).toHaveLength(1)
    expect(JSON.parse(linhas[0])).toEqual({
      em: '2026-11-17T20:00:00.000Z',
      ramo: 'painel-unico-fecha-aba',
      aba: 'tab-1',
      painel: 'tab-1:leaf-1',
      ptyId: 'pty-9',
      codigoDeSaida: 0,
      msDesdeAbrir: 10432,
      registroDeDormindo: { origem: 'quit', estado: 'working', conversa: 'dc17dfe2' },
      estadoDoAgente: null,
      restaurado: true,
      morteConfirmadaAoReabrir: false,
      digitouNoTerminal: false
    })
  })

  it('ignores other console messages and broken notes', () => {
    gravarAbaFechadaDoConsole(
      '[terminal-lifecycle] restored PTY reattach returned no PTY id',
      pasta,
      AGORA
    )
    gravarAbaFechadaDoConsole('[fork-aba-fechada] {quebrado', pasta, AGORA)
    expect(existsSync(join(pasta, 'fork-abas-fechadas.jsonl'))).toBe(false)
  })
})
