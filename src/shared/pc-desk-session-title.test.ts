import { describe, expect, it } from 'vitest'
import {
  buildPcDeskSessionTitlePrompt,
  parsePcDeskSessionTitleOutput
} from './pc-desk-session-title'

describe('parsePcDeskSessionTitleOutput', () => {
  it('reads KEEP as keep', () => {
    expect(parsePcDeskSessionTitleOutput('KEEP\n', 'Botão adicionar projeto')).toEqual({
      kind: 'keep'
    })
  })

  it('caps and unquotes a new name', () => {
    expect(parsePcDeskSessionTitleOutput('"Nome da sessão inteligente."', 'orca')).toEqual({
      kind: 'rename',
      title: 'Nome sessão inteligente'
    })
  })

  it('treats the same name as keep', () => {
    expect(
      parsePcDeskSessionTitleOutput('Botão adicionar projeto', 'Botão adicionar projeto')
    ).toEqual({
      kind: 'keep'
    })
  })

  it('reports empty output as an error', () => {
    expect(parsePcDeskSessionTitleOutput('  \n', 'orca').kind).toBe('error')
  })
})

describe('buildPcDeskSessionTitlePrompt', () => {
  it('forces a real name while the tab still shows the project name', () => {
    const prompt = buildPcDeskSessionTitlePrompt({
      cwd: '/tmp',
      projectName: 'orca',
      currentTitle: 'orca',
      currentIsPlaceholder: true,
      recentPrompts: ['arruma o botão +']
    })
    expect(prompt).toContain('proponha um nome')
    expect(prompt).toContain('- arruma o botão +')
  })
})
