// Remonta o print do Kaique (13/11): o PO anterior fechou e um PO novo abriu; os executores do PO anterior
// ficam ligados ao projeto e a linha contorna o PO novo; duas setas manuais ligam o PO a dois executores
// (um deles hexagono) e o nome do executor e comprido. Tudo no Orca de teste, sobre a copia do estado.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chavesPorPapel, guardarNoArmazenamento } from './ajudas.mjs'

const PROJETO = 'orca'
const NOME_LONGO = 'Fluxogramaticamente Organizacional'

export default async function (page, { lerTela, recarregar, mundo, dizer }) {
  const fatos = await lerTela()
  const doProjeto = (papel) => chavesPorPapel(fatos, papel).filter((c) => c.projeto === PROJETO)
  const poAntigo = doProjeto('po')[0]
  const executores = doProjeto('executor')
  if (!poAntigo || executores.length < 2) {
    throw new Error('o projeto orca da copia do estado precisa de um PO e de dois executores')
  }
  await guardarNoArmazenamento(page, 'orca-fork.canvas-executor-names', {
    [executores[0].chave]: 'Executor Implementador',
    [executores[1].chave]: NOME_LONGO
  })
  await guardarNoArmazenamento(page, 'orca-fork.canvas-cords', [
    { a: 'TESTE-po-novo', b: executores[0].chave },
    { a: 'TESTE-po-novo', b: executores[1].chave }
  ])
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
  // O selo solto do print nao tem causa achada no codigo: aqui ele e solto de proposito (so para esta prova).
  if (fatos.selos.length > 0) {
    await page.addStyleTag({
      content: '.cc-chips { transform: translate(-340px, 170px) !important; }'
    })
    dizer('selo de anexo deslocado de proposito (cenario)')
  }
  dizer(
    `PO antigo ${poAntigo.chave.slice(0, 8)} fechado, PO novo TESTE-po-novo aberto; setas e nome comprido guardados`
  )
}
