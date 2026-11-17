// O Enter que nao envia (o-043, rodada final): num chat Claude (haiku) que voltou da compactacao, e de novo depois
// de o Orca cair e reabrir, compara o jeito antigo do aviso (texto e Enter juntos; depois espaco e Enter) com o
// novo (`escreverNoChat`: texto, Enter sozinho, conferindo tela e rascunho). Um Orca de teste, um chat de teste.
// Uso: node tools/orca-de-teste-hierarquia/roteiro-enter.mjs PASTA_DE_SAIDA
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { escreverNoChat } from '../../skills/hierarquia/orca-lancador.mjs'
import {
  abrirOrca,
  apagarMundo,
  CLI_DO_MUNDO,
  confiarNoMundo,
  contarDoMundo,
  criarProjeto,
  desconfiarDoMundo,
  encerrarMundo,
  esperar,
  montarMundo,
  orcaTeste
} from './orca-de-teste.mjs'

const saida = path.resolve(process.argv[2] ?? 'enter')
mkdirSync(saida, { recursive: true })
const inicio = Date.now()
const relato = []
const dizer = (texto) => {
  const linha = `[${((Date.now() - inicio) / 1000).toFixed(0).padStart(5)} s] ${texto}`
  relato.push(linha)
  console.log(linha)
  writeFileSync(path.join(saida, 'relato.txt'), `${relato.join('\n')}\n`)
}
const guardar = (nome, dados) =>
  writeFileSync(
    path.join(saida, nome),
    typeof dados === 'string' ? dados : JSON.stringify(dados, null, 2)
  )
process.env.HIERARQUIA_ORCA = CLI_DO_MUNDO

const pids = []
let orca = null
let chat = null
const ler = () => orcaTeste(['terminal', 'read', '--terminal', chat.handle]).result?.terminal ?? {}
const tela = () => (ler().tail ?? []).join('\n')

/** Onde a frase esta: respondida (o Claude repetiu a palavra), parada na caixa (rascunho) ou sumida. */
function situacao(palavra) {
  const t = ler()
  const historico = (t.tail ?? []).join('\n')
  const rascunho = String(t.draft ?? '')
  const respostas = (historico.match(new RegExp(`\\b${palavra}\\b`, 'gu')) ?? []).length
  return {
    naCaixa: rascunho.includes(palavra),
    respondida: respostas >= 2,
    vezesNaTela: respostas,
    rascunho: rascunho.slice(0, 200)
  }
}

async function esperarCaixa(prazo = 300_000) {
  const limite = Date.now() + prazo
  while (Date.now() < limite) {
    if ((ler().tail ?? []).some((l) => String(l).trim().startsWith('❯'))) {
      return true
    }
    await esperar(5000)
  }
  return false
}

async function esperarResposta(palavra, prazo = 60_000) {
  const limite = Date.now() + prazo
  let visto = situacao(palavra)
  while (Date.now() < limite && !visto.respondida) {
    await esperar(5000)
    visto = situacao(palavra)
  }
  return visto
}

/** Jeito antigo (ate a o-043): texto e Enter na mesma chamada; 4 s depois, se a tela mostrasse na caixa, espaco e Enter. */
async function jeitoAntigo(palavra, prefixo) {
  const texto = `Responda apenas a palavra ${palavra}`
  const envio = orcaTeste([
    'terminal',
    'send',
    '--terminal',
    chat.handle,
    '--text',
    JSON.stringify(texto),
    '--enter'
  ])
  guardar(`${prefixo}-envio-antigo.json`, envio)
  await esperar(4000)
  const aos4s = situacao(palavra)
  dizer(`${prefixo} antigo, 4 s: ${JSON.stringify(aos4s)}`)
  const visto = await esperarResposta(palavra, 40_000)
  guardar(`${prefixo}-tela-antigo.txt`, `${tela()}\n--- rascunho: ${ler().draft ?? ''}`)
  dizer(`${prefixo} antigo, 44 s: ${JSON.stringify(visto)}`)
  if (visto.naCaixa) {
    // O que fazia o reenvio antigo quando via a frase na caixa.
    orcaTeste(['terminal', 'send', '--terminal', chat.handle, '--text', '" "', '--enter'])
    const depois = await esperarResposta(palavra, 30_000)
    dizer(`${prefixo} antigo, depois do espaco e Enter: ${JSON.stringify(depois)}`)
    if (depois.naCaixa) {
      orcaTeste(['terminal', 'send', '--terminal', chat.handle, '--enter'])
      const soEnter = await esperarResposta(palavra, 40_000)
      dizer(`${prefixo} antigo, depois de um Enter sozinho: ${JSON.stringify(soEnter)}`)
    }
  }
}

async function jeitoNovo(palavra, prefixo) {
  const enviou = await escreverNoChat(chat.handle, `Responda apenas a palavra ${palavra}`)
  const visto = await esperarResposta(palavra, 60_000)
  guardar(`${prefixo}-tela-novo.txt`, `${tela()}\n--- rascunho: ${ler().draft ?? ''}`)
  dizer(`${prefixo} novo (escreverNoChat devolveu ${enviou}): ${JSON.stringify(visto)}`)
}

try {
  montarMundo()
  const projeto = criarProjeto('teste-enter')
  confiarNoMundo()
  process.on('exit', () => desconfiarDoMundo())
  orca = await abrirOrca({ log: dizer })
  pids.push(orca.pid)
  orcaTeste(['repo', 'add', '--path', projeto])
  const r = orcaTeste([
    'terminal',
    'create',
    '--worktree',
    `path:${projeto}`,
    '--title',
    '"TESTE enter: chat compactado"',
    '--command',
    '"claude --model haiku --dangerously-skip-permissions"'
  ])
  chat = r.result?.terminal
  if (!chat) {
    throw new Error(`terminal create falhou: ${JSON.stringify(r).slice(0, 300)}`)
  }
  dizer(`chat de teste aberto (${chat.handle}); caixa pronta = ${await esperarCaixa()}`)
  await jeitoNovo('PRIMEIRO', '0-antes-de-compactar')

  // Compacta: o chat volta parado depois da compactacao.
  orcaTeste(['terminal', 'send', '--terminal', chat.handle, '--text', '/compact'])
  await esperar(1500)
  orcaTeste(['terminal', 'send', '--terminal', chat.handle, '--enter'])
  const limite = Date.now() + 240_000
  while (Date.now() < limite && !/compact/iu.test(tela().split('\n').slice(-30).join('\n'))) {
    await esperar(5000)
  }
  await esperar(20_000)
  guardar('1-tela-compactado.txt', tela())
  dizer(`compactado: caixa pronta = ${await esperarCaixa(120_000)}`)
  await jeitoAntigo('VELHOUM', '1-compactado')
  await jeitoNovo('NOVOUM', '1-compactado')

  // Queda e reabertura: o chat volta pelo guarda de terminais, parado.
  execFileSync('taskkill', ['/F', '/PID', String(orca.pid)], { stdio: 'ignore' })
  await orca.browser.close().catch(() => null)
  await esperar(10_000)
  dizer(`queda: ${contarDoMundo(pids).claudes} Claude vivo(s)`)
  orca = await abrirOrca({ log: dizer })
  pids.push(orca.pid)
  await esperar(40_000)
  const aba = (orcaTeste(['terminal', 'list']).result?.terminals ?? []).find(
    (t) => t.tabId === chat.tabId
  )
  dizer(`reaberto: aba do chat ${aba ? `ligada=${aba.connected}` : 'sumiu'}`)
  if (aba?.handle) {
    chat.handle = aba.handle
    await jeitoAntigo('VELHODOIS', '2-reaberto')
    await jeitoNovo('NOVODOIS', '2-reaberto')
  }
} catch (erro) {
  dizer(`ERRO no roteiro: ${String(erro?.stack ?? erro).slice(0, 800)}`)
} finally {
  await orca?.browser.close().catch(() => null)
  const sobras = await encerrarMundo(pids)
  dizer(`fim: sobras do mundo ${sobras.length}; ${JSON.stringify(contarDoMundo(pids))}`)
  apagarMundo()
  process.exit(0)
}
