// Tipo c (e o pior caso de texto): nome de executor com 2 palavras longas, nome de planejador com 4 palavras
// longas, titulo de PO e de chat livre muito compridos, nome de projeto comprido, etiqueta de modelo, estado
// "aguardando equipe", contexto de 987k e selos, tudo junto, em cada tipo de card.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { chavesPorPapel, guardarNoArmazenamento } from './ajudas.mjs'

const PASTA_DO_TRANSCRITO = path.join(homedir(), '.claude', 'projects', 'TESTE-vistoria-fluxograma')
const ARQUIVO_DO_TRANSCRITO = path.join(PASTA_DO_TRANSCRITO, 'pior-caso.jsonl')
const NOME_EXECUTOR = 'Organizador Fluxogramatico'
const NOME_PLANEJADOR = 'Planejador Arquitetonico Fluxogramatico Organizacional'
const TITULO_COMPRIDO =
  'Orquestrador Hierarquico de Projetos Fluxogramaticos Extremamente Longos para Testar Texto Cortado'
const PROJETO_COMPRIDO = 'Projeto com um Nome Extremamente Comprido para Testar o Cabecalho'

export function limpar() {
  rmSync(PASTA_DO_TRANSCRITO, { recursive: true, force: true })
}

export default async function (page, { lerTela, recarregar, dizer }) {
  const fatos = await lerTela()
  const nomes = {}
  for (const card of chavesPorPapel(fatos, 'executor')) {
    nomes[card.chave] = NOME_EXECUTOR
  }
  for (const card of chavesPorPapel(fatos, 'planejador')) {
    nomes[card.chave] = NOME_PLANEJADOR
  }
  await guardarNoArmazenamento(page, 'orca-fork.canvas-executor-names', nomes)
  await recarregar()

  // Contexto de 987k: o Orca so le transcritos de ~/.claude/projects; o arquivo de teste mora numa pasta TESTE-...
  // e e apagado no fim (`limpar`).
  mkdirSync(PASTA_DO_TRANSCRITO, { recursive: true })
  const transcrito = ARQUIVO_DO_TRANSCRITO.split(path.sep).join('/')
  writeFileSync(
    transcrito,
    `${JSON.stringify({ type: 'assistant', message: { model: 'claude-fable-5-2', usage: { input_tokens: 987000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } })}
`
  )
  const papeis = Object.fromEntries(
    fatos.cards.filter((c) => c.tipo === 'chat').map((c) => [c.chave, c.papel])
  )

  const titulos = {}
  for (const card of fatos.cards.filter(
    (c) => c.tipo === 'chat' && ['po', 'free', 'abrindo-po'].includes(c.papel)
  )) {
    titulos[card.chave] = TITULO_COMPRIDO
  }
  const chats = fatos.cards.filter((c) => c.tipo === 'chat').map((c) => c.chave)
  const resumo = await page.evaluate(
    ({ titulos, projeto, chats, transcrito, papeis }) => {
      const loja = window.__store
      const agora = Date.now()
      loja.setState((estado) => {
        const tabsByWorktree = Object.fromEntries(
          Object.entries(estado.tabsByWorktree).map(([pasta, abas]) => [
            pasta,
            abas.map((aba) => (titulos[aba.id] ? { ...aba, customTitle: titulos[aba.id] } : aba))
          ])
        )
        const repos = estado.repos.map((repo, i) =>
          i === 0 ? { ...repo, displayName: projeto } : repo
        )
        const agentStatusByPaneKey = { ...estado.agentStatusByPaneKey }
        for (const chave of chats) {
          const paneKey = Object.keys(agentStatusByPaneKey).find((k) => k.startsWith(`${chave}:`))
          const base = paneKey ? agentStatusByPaneKey[paneKey] : null
          const chaveDoPainel = paneKey ?? `${chave}:00000000-0000-4000-8000-000000000001`
          agentStatusByPaneKey[chaveDoPainel] = {
            stateHistory: [],
            prompt: 'pedido de prova',
            agentType: 'claude',
            ...base,
            paneKey: chaveDoPainel,
            tabId: chave,
            // PO e planejador esperam a equipe (parados com executores trabalhando): "aguardando equipe".
            state: ['po', 'planejador'].includes(papeis[chave]) ? 'done' : 'working',
            updatedAt: agora,
            stateStartedAt: base?.stateStartedAt ?? agora,
            model: 'claude-fable-5-2',
            providerSession: { ...base?.providerSession, transcriptPath: transcrito },
            subagents: [
              { id: `${chave}-a1`, name: 'agente de prova um', state: 'working', startedAt: agora },
              {
                id: `${chave}-a2`,
                name: 'agente de prova dois',
                // PO e planejador esperam a equipe (parados com executores trabalhando): "aguardando equipe".
                state: ['po', 'planejador'].includes(papeis[chave]) ? 'done' : 'working',
                startedAt: agora
              }
            ]
          }
        }
        return { tabsByWorktree, repos, agentStatusByPaneKey }
      })
      return Object.keys(loja.getState().agentStatusByPaneKey).length
    },
    { titulos, projeto: PROJETO_COMPRIDO, chats, transcrito, papeis }
  )
  dizer(`pior caso montado: ${chats.length} chats, ${resumo} estados de agente`)
}
