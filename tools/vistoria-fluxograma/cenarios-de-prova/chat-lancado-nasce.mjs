// Criterio 7: um chat lancado pela hierarquia nasce. A aba abre primeiro; o registro (chat_lancado) e gravado
// logo depois (aqui 300 ms, o ritmo com que o comando acha a aba). Mede, a cada 100 ms, o papel e o lado do card
// novo: ele nunca pode aparecer como "Livre" (em cima do projeto).
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chavesPorPapel } from './ajudas.mjs'

export default async function (page, { lerTela, mundo, dizer, saida }) {
  const fatos = await lerTela()
  const po = chavesPorPapel(fatos, 'po')[0]
  if (!po) {
    throw new Error('o cenario precisa de um PO aberto')
  }
  const arquivo = path.join(mundo, 'projetos', po.projeto, '.hierarquia', 'estado.json')
  const estado = JSON.parse(readFileSync(arquivo, 'utf8'))
  const novo = 'TESTE-executor-lancado'
  const modelo = chavesPorPapel(fatos, 'executor').find((c) => c.projeto === po.projeto) ?? po
  // O chat lancado fica numa pasta de trabalho filha da pasta do PO (a linhagem que o Orca guarda ao criar a pasta).
  const nasce = async () => {
    await page.evaluate(
      ({ modelo, id, po }) => {
        window.__store.setState((s) => {
          const tabsByWorktree = { ...s.tabsByWorktree }
          let pastaDoModelo = null
          let pastaDoPo = null
          for (const [pasta, abas] of Object.entries(tabsByWorktree)) {
            pastaDoModelo = abas.some((aba) => aba.id === modelo) ? pasta : pastaDoModelo
            pastaDoPo = abas.some((aba) => aba.id === po) ? pasta : pastaDoPo
          }
          const base = tabsByWorktree[pastaDoModelo].find((aba) => aba.id === modelo)
          tabsByWorktree[pastaDoModelo] = [
            ...tabsByWorktree[pastaDoModelo],
            {
              ...base,
              id,
              ptyId: null,
              title: 'TESTE chat lancado',
              customTitle: 'TESTE chat lancado',
              generatedTitle: null
            }
          ]
          const filha = pastaDoModelo !== pastaDoPo
          return {
            tabsByWorktree,
            worktreeLineageById: filha
              ? {
                  ...s.worktreeLineageById,
                  [pastaDoModelo]: {
                    worktreeId: pastaDoModelo,
                    parentWorktreeId: pastaDoPo,
                    origin: 'orchestration'
                  }
                }
              : s.worktreeLineageById
          }
        })
      },
      { modelo: modelo.chave, id: novo, po: po.chave }
    )
  }
  // Sonda dentro da pagina (relogio da pagina, 25 ms): o papel e o lado do card novo, a cada mudanca.
  await page.evaluate((id) => {
    window.__linhaDoTempo = []
    window.__t0 = performance.now()
    let ultimo = ''
    const marcar = (texto) =>
      window.__linhaDoTempo.push(`${Math.round(performance.now() - window.__t0)} ms: ${texto}`)
    window.__marcar = marcar
    setInterval(() => {
      const el = document.querySelector(`[data-chat-key="${id}"]`)
      let texto = 'card ainda nao desenhado'
      if (el) {
        const projeto = [...document.querySelectorAll('.cc-project')].find((p) =>
          p.parentElement.contains(el)
        )
        const c = el.getBoundingClientRect()
        const p = projeto.getBoundingClientRect()
        const lado =
          c.bottom <= p.top
            ? 'EM CIMA do projeto'
            : c.top >= p.bottom
              ? 'embaixo do projeto'
              : 'ao lado'
        texto = `${el.querySelector('.cc-role')?.dataset.role ?? 'sem-etiqueta'} / ${lado}`
      }
      if (texto !== ultimo) {
        ultimo = texto
        marcar(texto)
      }
    }, 25)
  }, novo)
  await nasce()
  await page.evaluate(() => window.__marcar('aba do chat lancado aberta (sem registro ainda)'))
  await page.waitForFunction((id) => document.querySelector(`[data-chat-key="${id}"]`), novo, {
    timeout: 30_000
  })
  // O print do instante em que nasce: o registro so e gravado depois dele (a foto pode demorar na maquina carregada).
  await page.screenshot({ path: path.join(saida, 'lancado-1-instante-em-que-nasce.png') })
  const estadoNaTela = await page.evaluate(() => window.__linhaDoTempo.at(-1))
  estado.chats[novo] = {
    id: novo,
    handle: null,
    papel: 'executor',
    modelo: 'sonnet',
    pai: po.chave,
    ordemId: null,
    ativo: true,
    mexidoPeloKaique: false
  }
  writeFileSync(arquivo, JSON.stringify(estado, null, 2))
  await page.evaluate(() => window.__marcar('registro chat_lancado gravado no arquivo'))
  await page.waitForFunction(
    (id) => document.querySelector(`[data-chat-key="${id}"] .cc-role`)?.dataset.role === 'executor',
    novo,
    { timeout: 30_000 }
  )
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(saida, 'lancado-2-com-o-registro-lido.png') })
  const linha = await page.evaluate(() => window.__linhaDoTempo)
  for (const l of linha) {
    dizer(`linha do tempo (relogio da pagina): ${l}`)
  }
  const vistoLivre = linha.some((l) => l.includes(': free /'))
  const tempo = (texto) => Number(linha.find((l) => l.includes(texto))?.split(' ms')[0])
  const gravadoEm = tempo('registro chat_lancado gravado')
  const executorEm = tempo('executor /')
  dizer(`no instante em que nasceu o card estava: ${estadoNaTela}`)
  dizer(
    `RESULTADO DO CHAT LANCADO: ${vistoLivre ? 'APARECEU COMO LIVRE (defeito)' : 'nunca apareceu como Livre'}; o registro foi lido ${executorEm - gravadoEm} ms depois de gravado`
  )
}
