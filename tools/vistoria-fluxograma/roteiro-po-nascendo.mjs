// Roteiro avulso: abre um PO de verdade (Claude real) num projeto do mundo de teste e fotografa o fluxograma
// em cada etapa da mascara, abrindo o card pronto e recarregando a tela com o PO pronto.
// Uso: node tools/vistoria-fluxograma/roteiro-po-nascendo.mjs PASTA_DE_SAIDA [--projeto orca]
// Com `--projeto NOME`, abre so o PO desse projeto, depois de fechar o PO anterior dele (os executores do PO
// anterior ficam vivos) e mede cada print com as regras da vistoria.
// Gasta um PO real (alguns minutos de Claude). Nada sai do mundo de teste.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { analisar } from './vistoria-regras.mjs'
import { lerTela } from './vistoria-leitura-da-tela.mjs'
import {
  abrirFluxograma,
  abrirOrcaDeTeste,
  lerFluxograma,
  montarMundo,
  MUNDO_PADRAO
} from './orca-de-teste.mjs'

const argumentos = process.argv.slice(2)
const projetoUnico = argumentos.includes('--projeto')
  ? argumentos[argumentos.indexOf('--projeto') + 1]
  : null
const saida = path.resolve(
  argumentos.find((a) => !a.startsWith('--') && a !== projetoUnico) ?? 'roteiro-po-nascendo'
)
mkdirSync(saida, { recursive: true })
const inicio = Date.now()
const linhas = []
const dizer = (texto) => {
  const linha = `[${((Date.now() - inicio) / 1000).toFixed(1).padStart(6)} s] ${texto}`
  linhas.push(linha)
  console.log(linha)
}

const mundo = montarMundo()
// O Claude pergunta "confia nesta pasta?" em pasta nova: registra so a raiz do mundo de teste e desfaz no fim.
const arquivoClaude = path.join(os.homedir(), '.claude.json')
const raizConfiavel = path.resolve(MUNDO_PADRAO).replaceAll('\\', '/')
const lerClaude = () => JSON.parse(readFileSync(arquivoClaude, 'utf8'))
{
  const config = lerClaude()
  config.projects ??= {}
  config.projects[raizConfiavel] = {
    ...config.projects[raizConfiavel],
    hasTrustDialogAccepted: true
  }
  writeFileSync(arquivoClaude, JSON.stringify(config, null, 2))
}
// Projetos sem PO registrado: o PO novo e o primeiro.
for (const nome of projetoUnico ? [] : ['Astra Designer', 'automacao-cadastros']) {
  rmSync(path.join(mundo, 'projetos', nome, '.hierarquia'), { recursive: true, force: true })
}

const orca = await abrirOrcaDeTeste({ registro: dizer, manter: false })
const { page } = orca
const foto = async (nome) => {
  await page.screenshot({ path: path.join(saida, `${nome}.png`) })
  const { achados } = analisar(await lerTela(page), { depoisDoReorganizar: false })
  const porTipo = {}
  for (const achado of achados) {
    porTipo[achado.tipo] = (porTipo[achado.tipo] ?? 0) + 1
  }
  dizer(`vistoria de ${nome}: ${achados.length} achados ${JSON.stringify(porTipo)}`)
  for (const achado of achados.filter((a) => a.tipo === 'a' || a.tipo === 'b')) {
    dizer(
      `  ACHADO ${achado.tipo} | ${achado.regra} | ${achado.card} | ${achado.coordenada} | ${achado.detalhe}`
    )
  }
}
const cartoes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.cc-board [data-chat-key]')].map((el) => el.dataset.chatKey)
  )

/** Abre o seletor de projeto do fluxograma e escolhe a pasta pelo mesmo caminho do produto (modo Hierarquico). */
async function abrirPo(nomeDoProjeto) {
  await page.getByRole('button', { name: 'Novo chat ou projeto' }).click()
  await page.getByRole('radio', { name: /Hierárquico/u }).click()
  await page.waitForTimeout(800)
  await page.evaluate((nome) => {
    const entrada = document.querySelector('input[placeholder="Nome do projeto"]')
    const chave = Object.keys(entrada).find((k) => k.startsWith('__reactFiber'))
    let fibra = entrada[chave]
    while (fibra && !fibra.memoizedProps?.onPick) {
      fibra = fibra.return
    }
    const repo = window.__store.getState().repos.find((r) => r.displayName === nome)
    // A lista do seletor vem da pasta de verdade; aqui a linha escolhida e a do projeto de teste.
    fibra.memoizedProps.onPick({
      key: repo.id,
      name: repo.displayName,
      path: repo.path,
      repo,
      isGit: true,
      isOpen: true,
      modifiedAt: 0,
      matchIndexes: []
    })
  }, nomeDoProjeto)
}

async function olhar(idDoPo, nomeDoProjeto) {
  return page.evaluate(
    ([id, nome]) => {
      const el = document.querySelector(`[data-chat-key="${id}"]`)
      const bloco = [...document.querySelectorAll('.cc-board .cc-world > div')].find((b) =>
        b.querySelector('.cc-project-name')?.textContent?.includes(nome)
      )
      if (!el || !bloco) {
        return null
      }
      const c = el.getBoundingClientRect()
      const p = bloco.querySelector('.cc-project').getBoundingClientRect()
      const passos = [...el.querySelectorAll('.cc-launch-steps li')].map((li) => li.dataset.state)
      return {
        mascara: el.dataset.launch ?? 'off',
        etapa: el.querySelector('.cc-launch-problem')
          ? 'PROBLEMA'
          : passos.indexOf('now') + 1 || null,
        lado: c.bottom <= p.top ? 'EM CIMA' : c.top >= p.bottom ? 'embaixo' : 'ao lado',
        papel: el.querySelector('.cc-role')?.dataset.role ?? null
      }
    },
    [idDoPo, nomeDoProjeto]
  )
}

async function acompanhar(nomeDoProjeto, prefixo, antes, ateEtapa3 = true) {
  let id = null
  let ultima = ''
  const limite = Date.now() + 240_000
  while (Date.now() < limite) {
    id ??= (await cartoes()).find((chave) => !antes.includes(chave)) ?? null
    const fatos = id ? await olhar(id, nomeDoProjeto) : null
    if (fatos) {
      const assinatura = `${fatos.mascara}/${fatos.etapa}/${fatos.lado}/${fatos.papel}`
      if (assinatura !== ultima) {
        ultima = assinatura
        dizer(
          `${prefixo}: mascara=${fatos.mascara} etapa=${fatos.etapa} lado=${fatos.lado} papel=${fatos.papel}`
        )
        await foto(
          `${prefixo}-etapa-${fatos.etapa ?? 'nenhuma'}-${fatos.mascara}-${fatos.lado.replace(' ', '-')}`
        )
      }
      if (ateEtapa3 && fatos.etapa === 3) {
        return id
      }
      if (fatos.etapa === 'PROBLEMA') {
        throw new Error(`${prefixo}: a mascara foi para a tela de problema`)
      }
    }
    await page.waitForTimeout(500)
  }
  throw new Error(`${prefixo}: nao chegou a etapa 3 em 4 minutos`)
}

/** O PO anterior do projeto fecha (a aba some) e um PO novo abre: os executores do anterior ficam vivos. */
async function poNovoComExecutoresAntigos(nomeDoProjeto) {
  const poAnterior = await page.evaluate((nome) => {
    const bloco = [...document.querySelectorAll('.cc-board .cc-world > div')].find((b) =>
      b.querySelector('.cc-project-name')?.textContent?.includes(nome)
    )
    return (
      bloco?.querySelector('.cc-role[data-role="po"]')?.closest('[data-chat-key]')?.dataset
        .chatKey ?? null
    )
  }, nomeDoProjeto)
  if (!poAnterior) {
    throw new Error(`o projeto ${nomeDoProjeto} nao tem PO aberto na copia do estado`)
  }
  await foto('0-antes-com-po-anterior')
  await page.evaluate((fechado) => {
    window.__store.setState((s) => ({
      tabsByWorktree: Object.fromEntries(
        Object.entries(s.tabsByWorktree).map(([pasta, abas]) => [
          pasta,
          abas.filter((aba) => aba.id !== fechado)
        ])
      )
    }))
  }, poAnterior)
  await page.waitForTimeout(3500)
  dizer(
    `PO anterior ${poAnterior.slice(0, 8)} fechado (a aba sumiu); executores dele continuam abertos`
  )
  await foto('1-po-anterior-fechado')
  const antes = await cartoes()
  await abrirPo(nomeDoProjeto)
  const po = await acompanhar(nomeDoProjeto, '2-po-novo', antes)
  await page.waitForTimeout(4000)
  await foto('3-po-novo-etapa3-pronto')
  dizer(`pronto: ${JSON.stringify(await olhar(po, nomeDoProjeto))}`)
  await page.locator('.cc-tidy').click()
  await page.waitForTimeout(3000)
  await foto('4-depois-do-reorganizar')
  writeFileSync(
    path.join(saida, 'fatos-po-novo.json'),
    JSON.stringify(await lerFluxograma(page), null, 2)
  )
}

try {
  await abrirFluxograma(page)
  if (projetoUnico) {
    await poNovoComExecutoresAntigos(projetoUnico)
    throw new Error('FIM')
  }
  await foto('00-antes')
  // ---- PO 1: abrir o card pronto tira a mascara ----
  const antes1 = await cartoes()
  dizer('abrindo o PO do Astra Designer (que ja tem chats livres)')
  await abrirPo('Astra Designer')
  const po1 = await acompanhar('Astra Designer', '1-astra', antes1)
  await page.waitForTimeout(4000)
  await foto('1-astra-etapa3-pronto-mascara-ainda-la')
  dizer('clicando no card do PO pronto (etapa 3) para abrir')
  await page.locator(`[data-chat-key="${po1}"]`).click({ position: { x: 40, y: 20 } })
  await page.waitForTimeout(2500)
  dizer(`aberto: ${JSON.stringify(await olhar(po1, 'Astra Designer'))}`)
  await foto('1-astra-aberto')
  await page.keyboard.press('Escape')
  await page.mouse.click(1300, 150)
  await page.waitForTimeout(2500)
  const fechado = await olhar(po1, 'Astra Designer')
  dizer(`fechado de novo: ${JSON.stringify(fechado)}`)
  await foto('1-astra-fechado-sem-mascara')
  writeFileSync(
    path.join(saida, 'fatos-1-astra.json'),
    JSON.stringify(await lerFluxograma(page), null, 2)
  )
  // ---- PO 2: recarregar a tela (como reabrir o Orca) com o PO pronto ----
  const antes2 = await cartoes()
  dizer('abrindo o PO do automacao-cadastros')
  await abrirPo('automacao-cadastros')
  const po2 = await acompanhar('automacao-cadastros', '2-cadastros', antes2)
  await page.waitForTimeout(3000)
  await foto('2-cadastros-etapa3-antes-de-recarregar')
  dizer('recarregando a tela com o PO pronto na etapa 3 (como reabrir o Orca)')
  await page.reload()
  await page.waitForFunction(() => window.__store?.getState().repos.length > 0, null, {
    timeout: 120_000
  })
  await abrirFluxograma(page)
  const depoisDeRecarregar = await olhar(po2, 'automacao-cadastros')
  dizer(`depois de recarregar: ${JSON.stringify(depoisDeRecarregar)}`)
  await foto('2-cadastros-depois-de-recarregar')
  writeFileSync(
    path.join(saida, 'fatos-2-cadastros.json'),
    JSON.stringify(await lerFluxograma(page), null, 2)
  )
} catch (falha) {
  if (falha.message !== 'FIM') {
    dizer(`ERRO: ${falha.message}`)
    await foto('erro').catch(() => undefined)
  }
} finally {
  const sobras = await orca.fechar()
  const config = lerClaude()
  delete config.projects?.[raizConfiavel]
  writeFileSync(arquivoClaude, JSON.stringify(config, null, 2))
  dizer(`fechado; processos que sobraram: ${sobras.length}; confianca do Claude desfeita`)
  writeFileSync(path.join(saida, 'roteiro.txt'), linhas.join('\n'))
}
