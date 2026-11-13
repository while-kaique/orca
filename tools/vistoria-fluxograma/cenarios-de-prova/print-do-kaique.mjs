// Remonta o print do Kaique (13/11): o PO anterior fechou e um PO novo abriu; os executores do PO anterior
// ficam ligados ao projeto e a linha contorna o PO novo; duas setas manuais ligam o PO a dois executores
// (um deles hexagono) e o nome do executor e comprido. Tudo no Orca de teste, sobre a copia do estado.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chavesPorPapel, guardarNoArmazenamento } from './ajudas.mjs'

const NOME_LONGO = 'Fluxogramaticamente Organizacional'

export default async function (page, { lerTela, recarregar, mundo, dizer }) {
  const fatos = await lerTela()
  // O estado real muda: o print era do orca; vale o primeiro projeto (orca antes) com PO e executor.
  const nomes = [...new Set(fatos.cards.map((c) => c.projeto).filter(Boolean))]
  const candidatos = [...nomes.filter((n) => n === 'orca'), ...nomes.filter((n) => n !== 'orca')]
  const papeis = (projeto, papel) =>
    chavesPorPapel(fatos, papel).filter((c) => c.projeto === projeto)
  const PROJETO = candidatos.find(
    (n) =>
      papeis(n, 'po').length > 0 &&
      papeis(n, 'executor').length > 0 &&
      papeis(n, 'executor').length + papeis(n, 'planejador').length >= 2
  )
  if (!PROJETO) {
    throw new Error(
      'a copia do estado precisa de um projeto com PO, um executor e mais um executor ou planejador'
    )
  }
  const doProjeto = (papel) => papeis(PROJETO, papel)
  const poAntigo = doProjeto('po')[0]
  // Com um executor so, a segunda seta vai a um planejador (card fino).
  const executores = doProjeto('executor')
  const pontas = [...executores, ...doProjeto('planejador')].slice(0, 2)
  dizer(`projeto do cenario: ${PROJETO}`)
  await guardarNoArmazenamento(
    page,
    'orca-fork.canvas-executor-names',
    Object.fromEntries(
      executores
        .slice(0, 2)
        .map((e, i, todos) => [
          e.chave,
          i === todos.length - 1 ? NOME_LONGO : 'Executor Implementador'
        ])
    )
  )
  await guardarNoArmazenamento(
    page,
    'orca-fork.canvas-cords',
    pontas.map((p) => ({ a: 'TESTE-po-novo', b: p.chave }))
  )
  await recarregar()

  // Registro do projeto (no mundo de teste): um PO novo, ativo, que nao e criador de ninguem.
  const arquivo = path.join(mundo, 'projetos', PROJETO, '.hierarquia', 'estado.json')
  const estado = JSON.parse(readFileSync(arquivo, 'utf8'))
  estado.chats['TESTE-po-novo'] = {
    id: 'TESTE-po-novo',
    handle: null,
    papel: 'po',
    modelo: 'opus',
    pai: null,
    ordemId: null,
    ativo: true,
    mexidoPeloKaique: false
  }
  writeFileSync(arquivo, JSON.stringify(estado, null, 2))
  // O comando `hierarquia baixa` (chamado quando o PO anterior fecha) refaz o estado a partir do log: o PO novo
  // entra tambem no log, senao o estado refeito o perderia.
  appendFileSync(
    path.join(mundo, 'projetos', PROJETO, '.hierarquia', 'registro.jsonl'),
    `${JSON.stringify({ t: new Date().toISOString(), tipo: 'po_criado', chatId: 'TESTE-po-novo', handle: null })}
`
  )

  // Na tela: o PO anterior fecha e o PO novo abre (aba de teste, sem terminal).
  await page.evaluate(
    ({ antigo, novo }) => {
      window.__store.setState((s) => {
        const tabsByWorktree = {}
        for (const [pasta, abas] of Object.entries(s.tabsByWorktree)) {
          const modelo = abas.find((aba) => aba.id === antigo)
          const semAntigo = abas.filter((aba) => aba.id !== antigo)
          tabsByWorktree[pasta] = modelo
            ? [
                ...semAntigo,
                {
                  ...modelo,
                  id: novo,
                  ptyId: null,
                  title: 'TESTE PO novo',
                  customTitle: 'TESTE PO novo',
                  generatedTitle: null
                }
              ]
            : semAntigo
        }
        return { tabsByWorktree }
      })
    },
    { antigo: poAntigo.chave, novo: 'TESTE-po-novo' }
  )
  dizer(
    `PO antigo ${poAntigo.chave.slice(0, 8)} fechado, PO novo TESTE-po-novo aberto; setas e nome comprido guardados`
  )
}
