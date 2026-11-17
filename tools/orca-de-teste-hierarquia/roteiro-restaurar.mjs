// Restaurar herda o lugar (o-047, parte 2): no Orca de teste, um PO de teste, um chat TESTE (pai, haiku) com um filho
// TESTE; a palavra-senha vai ao pai; o terminal do pai e morto SO pelo PID anotado; `hierarquia restaurar` o reabre e o
// fluxograma e o registro mostram o pai no mesmo lugar, o filho ligado a ele e a conversa lembrada.
// Uso: node tools/orca-de-teste-hierarquia/roteiro-restaurar.mjs PASTA_DE_SAIDA
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  abrirOrca,
  ambienteDoMundo,
  apagarMundo,
  arvore,
  CLI_DO_MUNDO,
  confiarNoMundo,
  contarDoMundo,
  criarProjeto,
  desconfiarDoMundo,
  encerrarMundo,
  esperar,
  montarMundo,
  MUNDO,
  orcaTeste,
  PERFIL,
  processos,
  processosDoMundo,
  RAIZ
} from './orca-de-teste.mjs'

process.env.ORCA_DE_TESTE_DONO ??= 'executor o-047 (roteiro-restaurar)'
const saida = path.resolve(process.argv[2] ?? 'restaurar')
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
const HIERARQUIA = path.join(RAIZ, 'skills', 'hierarquia', 'hierarquia.mjs')
const SENHA = 'ABACAXI-47'
const pidsDoOrca = []
let orca = null
let projeto = null

const hierarquia = (args, ambiente, { tempo = 240_000 } = {}) => {
  try {
    return execFileSync(process.execPath, [HIERARQUIA, ...args], {
      env: ambiente,
      cwd: projeto,
      encoding: 'utf8',
      windowsHide: true,
      timeout: tempo,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (erro) {
    return `codigo ${erro.status}\n${erro.stdout ?? ''}${erro.stderr ?? ''}`
  }
}
const ler = (handle) => {
  try {
    return orcaTeste(['terminal', 'read', '--terminal', handle]).result?.terminal ?? null
  } catch {
    return null
  }
}
const enviar = (handle, texto) =>
  orcaTeste(['terminal', 'send', '--terminal', handle, '--text', JSON.stringify(texto), '--enter'])
const registro = () =>
  readFileSync(path.join(projeto, '.hierarquia', 'registro.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((linha) => JSON.parse(linha))

const foto = async (nome) => {
  await orca.page.setViewportSize({ width: 1500, height: 950 }).catch(() => null)
  await orca.page.screenshot({ path: path.join(saida, `${nome}.png`) }).catch(() => null)
}

/** O fluxograma lido da tela: cada card do projeto de teste com o titulo, a caixa e a ligacao com o pai. */
async function fluxograma(nome, ambientePo) {
  hierarquia(['estado'], ambientePo)
  await orca.page.evaluate(() => window.__store.getState().openCanvasPage())
  await orca.page.waitForSelector('.cc-board [data-chat-key]', { timeout: 90_000 })
  await esperar(7000)
  const dados = await orca.page.evaluate(() => {
    const caixa = (el) => {
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height)
      }
    }
    return [...document.querySelectorAll('.cc-board [data-chat-key]')]
      .map((el) => ({
        chave: el.dataset.chatKey,
        titulo: el.querySelector('.cc-chat-head')?.textContent?.trim().slice(0, 60) ?? null,
        papel: el.querySelector('.cc-role')?.dataset.role ?? null,
        status: el.dataset.status ?? null,
        caixa: caixa(el)
      }))
      .filter((card) => /TESTE restaurar|PO de teste/u.test(card.titulo ?? ''))
  })
  guardar(`${nome}-cards.json`, dados)
  await foto(nome)
  return dados
}

async function esperarCaixa(handle, prazo = 240_000) {
  const limite = Date.now() + prazo
  while (Date.now() < limite) {
    const tela = ler(handle)?.tail ?? []
    if (tela.some((l) => String(l).trim().startsWith('❯'))) {
      return true
    }
    await esperar(5000)
  }
  return false
}
async function esperarTexto(handle, trecho, prazo = 180_000) {
  const limite = Date.now() + prazo
  while (Date.now() < limite) {
    const tela = (ler(handle)?.tail ?? []).join('\n')
    if (tela.includes(trecho)) {
      return tela
    }
    await esperar(5000)
  }
  return (ler(handle)?.tail ?? []).join('\n')
}

function ordemTeste(nome, titulo, objetivo, ambiente) {
  const arquivo = path.join(projeto, '.hierarquia', `${nome}.json`)
  writeFileSync(
    arquivo,
    JSON.stringify({
      titulo,
      objetivo,
      porque: 'prova da o-047 no Orca de teste',
      criterios: ['fazer so o que o objetivo diz'],
      limites: 'nao editar arquivos, nao rodar hierarquia entregar',
      territorio: 'nenhum'
    })
  )
  return spawn(
    process.execPath,
    [HIERARQUIA, 'ordem', '--teste', '--para', 'executor', '--arquivo', arquivo],
    { env: ambiente, cwd: projeto, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
}
const juntarSaida = (filho) => {
  const coletor = { texto: '' }
  filho.stdout.on('data', (d) => (coletor.texto += d))
  filho.stderr.on('data', (d) => (coletor.texto += d))
  return coletor
}
const fimDe = (filho) =>
  filho.exitCode !== null ? Promise.resolve() : new Promise((pronto) => filho.on('exit', pronto))
const chatDaOrdem = (ordemId) => {
  const lancado = registro().findLast((e) => e.tipo === 'chat_lancado' && e.ordemId === ordemId)
  return lancado ? { tabId: lancado.chatId, handle: lancado.handle } : null
}

try {
  montarMundo()
  projeto = criarProjeto('teste-restaurar')
  confiarNoMundo()
  process.on('exit', () => desconfiarDoMundo())
  orca = await abrirOrca({
    log: dizer,
    extraEnv: {
      HIERARQUIA_ORCA: CLI_DO_MUNDO,
      HIERARQUIA_ORCA_DADOS: PERFIL,
      HIERARQUIA_INDICE: ambienteDoMundo().HIERARQUIA_INDICE
    }
  })
  pidsDoOrca.push(orca.pid)
  const adicionado = orcaTeste(['repo', 'add', '--path', projeto])
  if (!adicionado.ok) {
    throw new Error(`repo add falhou: ${JSON.stringify(adicionado).slice(0, 300)}`)
  }
  // O `hierarquia` fala com o Orca de teste por um comando que anota cada chamada (linha do worker-start).
  const logDasChamadas = path.join(saida, 'chamadas-do-orca.log')
  writeFileSync(logDasChamadas, '')
  const comandoRegistrado = path.join(MUNDO, 'orca-registrado.cmd')
  writeFileSync(
    comandoRegistrado,
    `@echo off\r\n"${process.execPath}" "${path.join(RAIZ, 'tools', 'orca-de-teste-hierarquia', 'orca-registrado.mjs')}" %*\r\n`
  )
  const ambienteRegistrado = {
    HIERARQUIA_ORCA: comandoRegistrado,
    ORCA_REGISTRADO_ALVO: CLI_DO_MUNDO,
    ORCA_REGISTRADO_LOG: logDasChamadas
  }
  const po = orcaTeste([
    'terminal',
    'create',
    '--worktree',
    `path:${projeto}`,
    '--title',
    'TESTE restaurar: PO de teste (so o shell)'
  ]).result?.terminal
  const ambientePo = ambienteDoMundo({
    ...ambienteRegistrado,
    ORCA_TAB_ID: po.tabId,
    ORCA_TERMINAL_HANDLE: po.handle,
    HIERARQUIA_PROJETO: projeto
  })
  dizer(hierarquia(['criar-po', '--projeto', projeto], ambientePo).trim().split('\n')[0])

  // O pai (haiku) e o filho dele: o filho nasce com o ambiente do pai, como se o pai tivesse rodado o comando.
  const lancPai = ordemTeste(
    'ordem-pai',
    'TESTE restaurar: pai',
    'Nao leia nada e nao mexa em nada. Responda apenas OK e espere a proxima mensagem.',
    ambientePo
  )
  const saidaPai = juntarSaida(lancPai)
  await fimDe(lancPai)
  guardar('lancamento-pai.txt', saidaPai.texto)
  const pai = chatDaOrdem('o-001')
  if (!pai) {
    throw new Error('a ordem do pai nao abriu chat')
  }
  dizer(
    `pai: aba ${pai.tabId}, terminal ${pai.handle}; caixa pronta = ${await esperarCaixa(pai.handle)}`
  )
  // Antes de o filho nascer, o unico Claude do mundo e o do pai: o PID dele e o do shell que o abriu sao anotados agora.
  const mundoComSoOPai = processosDoMundo(pidsDoOrca)
  const claudeDoPai = mundoComSoOPai.find((p) => /^claude/iu.test(p.nome))
  const shellDoPai = claudeDoPai ? mundoComSoOPai.find((p) => p.pid === claudeDoPai.pai) : null
  dizer(
    `PID anotado: claude do pai ${claudeDoPai?.pid ?? '(nao achei)'}, shell do terminal ${shellDoPai?.pid ?? '(nao achei)'} (${shellDoPai?.nome ?? '-'})`
  )
  const ambientePai = ambienteDoMundo({
    ...ambienteRegistrado,
    ORCA_TAB_ID: pai.tabId,
    ORCA_TERMINAL_HANDLE: pai.handle,
    HIERARQUIA_PROJETO: projeto
  })
  const lancFilho = ordemTeste(
    'ordem-filho',
    'TESTE restaurar: filho',
    'Nao leia nada e nao mexa em nada. Responda apenas OK e espere.',
    ambientePai
  )
  const saidaFilho = juntarSaida(lancFilho)
  await fimDe(lancFilho)
  guardar('lancamento-filho.txt', saidaFilho.texto)
  const filho = chatDaOrdem('o-002')
  if (!filho) {
    throw new Error('a ordem do filho nao abriu chat')
  }
  dizer(`filho: aba ${filho.tabId}; caixa pronta = ${await esperarCaixa(filho.handle)}`)

  // A palavra-senha so existe na conversa do pai.
  enviar(
    pai.handle,
    `A palavra-senha desta conversa e ${SENHA}. Responda apenas: ANOTADO ${SENHA}. Depois espere.`
  )
  const telaSenha = await esperarTexto(pai.handle, `ANOTADO ${SENHA}`)
  dizer(`pai respondeu a palavra-senha: ${telaSenha.includes(`ANOTADO ${SENHA}`)}`)

  // O filho entrega e o pai aprova: a ordem aprovada tem que continuar aprovada depois de restaurar.
  const prova = path.join(saida, 'prova-do-filho.txt')
  writeFileSync(prova, 'prova de teste do filho\n')
  guardar(
    'entrega-do-filho.txt',
    hierarquia(
      ['entregar', '--ordem', 'o-002', '--prova', prova],
      ambienteDoMundo({
        ORCA_TAB_ID: filho.tabId,
        ORCA_TERMINAL_HANDLE: filho.handle,
        HIERARQUIA_PROJETO: projeto
      })
    )
  )
  guardar(
    'conferencia-do-pai.txt',
    hierarquia(['conferir', '--ordem', 'o-002', '--aprovar'], ambientePai)
  )

  if (existsSync(logDasChamadas)) {
    const linhas = readFileSync(logDasChamadas, 'utf8')
      .split('\n')
      .filter((l) => l.includes('worker-start'))
    guardar(
      'linha-do-worker-start.txt',
      linhas
        .map((l) => l.replace(/--spec ".*?" --task-title/u, '--spec "<pedido>" --task-title'))
        .join('\n')
    )
    dizer(
      `worker-start de teste: ${linhas.map((l) => (l.match(/--model \S+( --effort \S+)?/u) ?? ['sem --model'])[0]).join(' | ')}`
    )
  }
  guardar('antes-estado.txt', hierarquia(['estado'], ambientePo))
  guardar(
    'antes-registro.jsonl',
    registro()
      .map((e) => JSON.stringify(e))
      .join('\n')
  )
  const antes = await fluxograma('antes', ambientePo)

  // O PID do terminal do pai: o `processId` que o Orca informa dele (anotado antes de matar) e a arvore que nasce dele.
  if (!claudeDoPai) {
    throw new Error('nao achei o processo claude do pai antes de criar o filho')
  }
  const pidDoTerminal =
    shellDoPai && /^(powershell|pwsh|cmd|bash)/iu.test(shellDoPai.nome)
      ? shellDoPai.pid
      : claudeDoPai.pid
  const arvoreDoPai = arvore(processos(), [pidDoTerminal])
  const linhasDaArvore = arvoreDoPai
    .map((p) => `${p.pid} ${p.pai} ${p.nome} ${p.comando.slice(0, 160)}`)
    .join('\n')
  guardar('pids-do-pai.txt', `PID do terminal do pai: ${pidDoTerminal}\n${linhasDaArvore}\n`)
  dizer(
    `PID anotado do terminal do pai: ${pidDoTerminal}; arvore dele: ${arvoreDoPai.map((p) => `${p.pid} ${p.nome}`).join(', ')}`
  )
  try {
    execFileSync('taskkill', ['/F', '/T', '/PID', String(pidDoTerminal)], {
      stdio: 'ignore',
      windowsHide: true
    })
  } catch {
    // Parte da arvore ja tinha saido (comandos curtos do chat): o taskkill sai com erro mas mata o resto.
  }
  dizer(`terminal do pai morto pelo PID ${pidDoTerminal} (so a arvore dele)`)
  await esperar(8000)
  const vivosDepois = arvore(processos(), [pidDoTerminal])
  const terminais = orcaTeste(['terminal', 'list']).result?.terminals ?? []
  guardar('depois-da-morte-terminais.json', terminais)
  dizer(
    `depois da morte: processos da arvore do pai vivos = ${vivosDepois.length}; terminal do pai na lista = ${JSON.stringify(terminais.find((t) => t.tabId === pai.tabId) ?? 'sumiu')}`
  )
  await foto('morto')

  // Restaurar: o PO de teste roda o comando.
  const saidaRestaurar = hierarquia(['restaurar', '--chat', pai.tabId], ambientePo, {
    tempo: 300_000
  })
  guardar('restaurar-saida.txt', saidaRestaurar)
  dizer(`restaurar: ${saidaRestaurar.trim().split('\n').join(' | ').slice(0, 500)}`)
  const evento = registro().findLast((e) => e.tipo === 'chat_restaurado')
  if (!evento) {
    throw new Error('o restaurar nao gravou chat_restaurado')
  }
  const novo = { tabId: evento.chatId, handle: evento.handle }
  dizer(
    `pai novo: aba ${novo.tabId}, terminal ${novo.handle}, conversa ${evento.conversa}; caixa pronta = ${await esperarCaixa(novo.handle)}`
  )
  enviar(novo.handle, 'Qual era a palavra-senha desta conversa? Responda apenas com ela.')
  const telaDepois = await esperarTexto(novo.handle, SENHA, 120_000)
  const lembrou = telaDepois.split('\n').filter((l) => l.includes(SENHA)).length >= 2
  guardar('depois-tela-do-pai-novo.txt', telaDepois)
  dizer(`pai novo lembra a palavra-senha ${SENHA}: ${lembrou}`)

  guardar('depois-estado.txt', hierarquia(['estado'], ambientePo))
  guardar(
    'depois-registro.jsonl',
    registro()
      .map((e) => JSON.stringify(e))
      .join('\n')
  )
  const depois = await fluxograma('depois', ambientePo)
  const cardPai = (lista2) =>
    lista2.find((c) => /TESTE restaurar: pai|restaurado/u.test(c.titulo ?? ''))
  dizer(
    `card do pai antes ${JSON.stringify(cardPai(antes)?.caixa)} depois ${JSON.stringify(cardPai(depois)?.caixa)}`
  )
  const hierarquiaDepois = JSON.parse(
    readFileSync(path.join(projeto, '.hierarquia', 'estado.json'), 'utf8')
  )
  dizer(
    `estado gravado: o-001 ${hierarquiaDepois.ordens['o-001']?.situacao} chat ${hierarquiaDepois.ordens['o-001']?.chatId}; o-002 ${hierarquiaDepois.ordens['o-002']?.situacao} de ${hierarquiaDepois.ordens['o-002']?.de}`
  )
} catch (erro) {
  dizer(`ERRO no roteiro: ${String(erro?.stack ?? erro).slice(0, 800)}`)
} finally {
  await orca?.browser?.close().catch(() => null)
  const sobras = await encerrarMundo(pidsDoOrca)
  const c = contarDoMundo(pidsDoOrca)
  dizer(
    `fim: sobras do mundo ${sobras.length}; contagem ${c.orcas} Orca, ${c.claudes} Claude, ${c.processos} processos`
  )
  if (!process.argv.includes('--manter')) {
    apagarMundo()
  }
  dizer('roteiro terminou')
  process.exit(0)
}
