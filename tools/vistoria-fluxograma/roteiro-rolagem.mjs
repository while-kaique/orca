// Fluxograma que rola sozinho (o-047, parte 4): abre o Orca de teste com o fluxograma, abre terminais de teste com
// `orca terminal create` (como o PO fez em 16/11) e le o scrollTop de .cc-board e de todo elemento da pagina.
// Uso: node tools/vistoria-fluxograma/roteiro-rolagem.mjs PASTA_DE_SAIDA [--rotulo antes|depois] [--terminais N] [--foco] [--card-aberto] [--altura-da-janela PX] [--forcar-foco]
//   O roteiro e o mesmo antes e depois do conserto: so o codigo montado muda. Sai 0 com scrollTop 0 e legenda no pe,
//   1 com rolagem diferente de zero ou legenda fora do pe.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  abrirOrca,
  apagarMundo,
  criarProjeto,
  encerrarMundo,
  esperar,
  montarMundo,
  orcaTeste,
  processosDoMundo
} from '../orca-de-teste-hierarquia/orca-de-teste.mjs'

const argumento = (nome, padrao) => {
  const i = process.argv.indexOf(nome)
  return i === -1 ? padrao : process.argv[i + 1]
}
const saida = path.resolve(process.argv[2] ?? 'rolagem')
const rotulo = argumento('--rotulo', 'medida')
const quantos = Number(argumento('--terminais', '6'))
const comFoco = process.argv.includes('--foco')
const abrirCard = process.argv.includes('--card-aberto')
const forcarFoco = process.argv.includes('--forcar-foco')
const alturaDaJanela = Number(argumento('--altura-da-janela', '0'))
mkdirSync(saida, { recursive: true })
const inicio = Date.now()
const relato = []
const dizer = (texto) => {
  const linha = `[${((Date.now() - inicio) / 1000).toFixed(0).padStart(4)} s] ${texto}`
  relato.push(linha)
  console.log(linha)
  writeFileSync(path.join(saida, `relato-${rotulo}.txt`), `${relato.join('\n')}\n`)
}

/** scrollTop/scrollLeft de .cc-board, de cada ancestral e de qualquer elemento da pagina que esteja rolado. */
const medir = (page) =>
  page.evaluate(() => {
    const quadro = document.querySelector('.cc-board')
    const caixa = (el) => {
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height)
      }
    }
    const nome = (el) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
        typeof el.className === 'string' && el.className.trim()
          ? `.${el.className.trim().split(/\s+/u).slice(0, 3).join('.')}`
          : ''
      }`
    const cadeia = []
    for (let el = quadro; el; el = el.parentElement) {
      cadeia.push({
        elemento: nome(el),
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflow: getComputedStyle(el).overflow
      })
    }
    const roladosNaPagina = [...document.querySelectorAll('*')]
      .filter((el) => el.scrollTop !== 0 || el.scrollLeft !== 0)
      .map((el) => ({ elemento: nome(el), scrollTop: el.scrollTop, scrollLeft: el.scrollLeft }))
    const legenda = document.querySelector('.cc-legend')
    const quadroCaixa = quadro ? caixa(quadro) : null
    const legendaCaixa = legenda ? caixa(legenda) : null
    return {
      quadro: quadroCaixa,
      legenda: legendaCaixa,
      legendaDistanciaDoPe:
        quadroCaixa && legendaCaixa
          ? quadroCaixa.y + quadroCaixa.h - (legendaCaixa.y + legendaCaixa.h)
          : null,
      foco: document.activeElement ? nome(document.activeElement) : null,
      cadeia,
      roladosNaPagina
    }
  })

const foto = (page, nomeDoPrint) =>
  page.screenshot({ path: path.join(saida, `${rotulo}-${nomeDoPrint}.png`) }).catch(() => null)

const pidsDoOrca = []
let orca = null
let codigo = 0
const medidas = []
try {
  montarMundo()
  const projeto = criarProjeto('teste-rolagem')
  orca = await abrirOrca({ log: dizer })
  pidsDoOrca.push(orca.pid)
  const { page } = orca
  const adicionado = orcaTeste(['repo', 'add', '--path', projeto])
  if (!adicionado.ok) {
    throw new Error(`repo add falhou: ${JSON.stringify(adicionado).slice(0, 300)}`)
  }
  await page.setViewportSize({ width: 1500, height: 950 })
  await page.evaluate(() => window.__store.getState().openCanvasPage())
  await page.waitForSelector('.cc-board [data-chat-key]', { timeout: 90_000 })
  await esperar(5000)
  const registrar = async (passo) => {
    const m = await medir(page)
    medidas.push({ passo, ...m })
    const rolados = m.roladosNaPagina.map(
      (r) => `${r.elemento} top=${r.scrollTop} left=${r.scrollLeft}`
    )
    dizer(
      `${passo}: legenda a ${m.legendaDistanciaDoPe} px do pe do quadro; rolados: ${rolados.join(' | ') || 'nenhum'}; foco em ${m.foco}`
    )
    return m
  }
  await registrar('fluxograma aberto')
  await foto(page, '0-aberto')
  if (forcarFoco) {
    // Mecanismo: foco e scrollIntoView num elemento de dentro do quadro que esta fora da parte visivel (como o xterm de um card).
    await page.evaluate(() => {
      const entrada = document.createElement('input')
      entrada.id = 'teste-foco-fora'
      entrada.style.cssText = 'position:absolute;left:60px;top:6000px;width:40px;height:20px'
      document.querySelector('.cc-world').appendChild(entrada)
      entrada.focus()
      // O foco sozinho nao rolou o quadro numa janela escondida; a chamada direta mostra o que o overflow permite.
      entrada.scrollIntoView({ block: 'end' })
    })
    await esperar(1000)
    await registrar('foco forcado em elemento do quadro fora da tela (top 6000 px)')
    await foto(page, '0b-foco-forcado')
  }
  const terminais = []
  for (let n = 1; n <= quantos; n++) {
    const criado = orcaTeste([
      'terminal',
      'create',
      '--worktree',
      `path:${projeto}`,
      '--title',
      `TESTE rolagem ${n}`,
      '--command',
      'ping -n 900 127.0.0.1',
      ...(comFoco ? ['--focus'] : [])
    ])
    const handle = criado.result?.terminal?.handle
    if (handle) {
      terminais.push(handle)
    }
    await esperar(2500)
    if (n === 1 && abrirCard) {
      const card = page.locator('.cc-chat', { hasText: 'TESTE rolagem 1' }).first()
      await card.click({ timeout: 30_000 })
      await page.waitForSelector('.cc-open', { timeout: 30_000 })
      await esperar(2500)
      dizer('card do terminal 1 aberto no fluxograma (.cc-open com o terminal vivo dentro)')
      if (alturaDaJanela) {
        await page.setViewportSize({ width: 1500, height: alturaDaJanela })
        await esperar(2500)
        dizer(`janela baixada para ${alturaDaJanela} px de altura com o card aberto`)
      }
    }
    await registrar(`depois do terminal ${n} (${handle ?? 'sem handle'})`)
  }
  await esperar(4000)
  const ultima = await registrar('depois de todos os terminais, 4 s parado')
  await foto(page, '1-depois-dos-terminais')
  const naCadeia = ultima.cadeia.filter((c) => c.scrollTop !== 0 || c.scrollLeft !== 0)
  const rolou = naCadeia.length > 0 || Math.abs(ultima.legendaDistanciaDoPe - 12) > 2
  dizer(
    rolou
      ? `RESULTADO (${rotulo}): ROLOU. Elementos rolados: ${naCadeia.map((r) => `${r.elemento} scrollTop=${r.scrollTop}`).join(' | ') || 'nenhum'}; legenda a ${ultima.legendaDistanciaDoPe} px do pe (esperado 12).`
      : `RESULTADO (${rotulo}): scrollTop 0 em toda a pagina e legenda a ${ultima.legendaDistanciaDoPe} px do pe (esperado 12).`
  )
  codigo = rolou ? 1 : 0
  for (const handle of terminais) {
    orcaTeste(['terminal', 'close', '--terminal', handle, '--tab'])
  }
} catch (erro) {
  dizer(`ERRO: ${String(erro?.stack ?? erro).slice(0, 600)}`)
  codigo = 2
} finally {
  writeFileSync(path.join(saida, `medidas-${rotulo}.json`), JSON.stringify(medidas, null, 2))
  await orca?.browser?.close().catch(() => null)
  const sobras = await encerrarMundo(pidsDoOrca)
  dizer(
    `processos de teste vivos logo depois de encerrar: ${sobras.length}${sobras.map((p) => ` [${p.pid} ${p.nome}]`).join('')}`
  )
  await esperar(5000)
  dizer(`processos de teste vivos 5 s depois: ${processosDoMundo(pidsDoOrca).length}`)
  apagarMundo()
}
process.exit(codigo)
