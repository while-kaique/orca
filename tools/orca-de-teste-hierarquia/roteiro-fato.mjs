// O FATO e o X (o-041 partes 1, 3, 4 e 5; versao enxuta da o-043): um Orca de teste com a opcao do fork ligada,
// no maximo 3 chats Claude (haiku) vivos, e o que acontece quando ele cai, fecha pelo X e reabre.
// Uso: node tools/orca-de-teste-hierarquia/roteiro-fato.mjs PASTA_DE_SAIDA --cena 1|2
//   cena 1: parado (livre), comando longo (ordem TESTE da hierarquia), comando em segundo plano (livre).
//           Queda (so o programa morre) + atalho com chat vivo; reabre; X; atalho sem chat; reabre; a volta.
//   cena 2: chat que abriu um chat filho (teste com filhos) + ordem recem-lancada ainda nascendo; X; reabre.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  abrirOrca,
  ambienteDoMundo,
  apagarMundo,
  CLI_DO_MUNDO,
  confiarNoMundo,
  contarDoMundo,
  criarProjeto,
  desconfiarDoMundo,
  encerrarMundo,
  esperar,
  fecharPeloX,
  montarMundo,
  MUNDO,
  orcaTeste,
  PERFIL,
  processos,
  processosDoMundo,
  RAIZ,
  vigiarTeto
} from './orca-de-teste.mjs'

const saida = path.resolve(process.argv[2] ?? 'fato')
const cena = process.argv[process.argv.indexOf('--cena') + 1] === '2' ? 2 : 1
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
const LIBERACAO = path.join(MUNDO, 'liberacao.json')
const extraEnv = {
  ORCA_FORK_FECHAR_PARA_CHATS: '1',
  ORCA_FORK_PORTA: HIERARQUIA,
  HIERARQUIA_ORCA: CLI_DO_MUNDO,
  HIERARQUIA_ORCA_DADOS: PERFIL,
  HIERARQUIA_INDICE: ambienteDoMundo().HIERARQUIA_INDICE,
  HIERARQUIA_LIBERACAO: LIBERACAO,
  // O teste nunca abre janela na tela: a pergunta do X vai para um arquivo e e respondida "fechar".
  ORCA_FORK_X_TESTE_RESPOSTA: 'fechar',
  ORCA_FORK_X_TESTE_SAIDA: path.join(saida, 'pergunta-do-x.txt')
}

const pidsDoOrca = []
let orca = null
const teto = vigiarTeto(() => pidsDoOrca, dizer)
const contar = (quando) => {
  const c = contarDoMundo(pidsDoOrca)
  dizer(
    `contagem ${quando}: ${c.orcas} Orca de teste, ${c.claudes} Claude, ${c.processos} processos do mundo`
  )
  return c
}
const linhasDosProcessos = (lista) =>
  lista.map((p) => `${p.pid}\t${p.pai}\t${p.nome}\t${p.comando.slice(0, 220)}`).join('\n')

async function abrir() {
  orca = await abrirOrca({ extraEnv, log: dizer })
  pidsDoOrca.push(orca.pid)
  return orca
}
const foto = async (nome) => {
  await orca.page.setViewportSize({ width: 1500, height: 950 }).catch(() => null)
  await orca.page.screenshot({ path: path.join(saida, `${nome}.png`) }).catch(() => null)
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

function abrirClaude(pasta, titulo) {
  const r = orcaTeste([
    'terminal',
    'create',
    '--worktree',
    `path:${pasta}`,
    '--title',
    titulo,
    '--command',
    'claude --model haiku --dangerously-skip-permissions'
  ])
  const t = r.result?.terminal
  if (!t) {
    throw new Error(`terminal create falhou: ${JSON.stringify(r).slice(0, 300)}`)
  }
  return { handle: t.handle, tabId: t.tabId, titulo }
}
async function esperarCaixa(chat, prazo = 300_000) {
  const limite = Date.now() + prazo
  while (Date.now() < limite) {
    const tela = ler(chat.handle)?.tail ?? []
    if (tela.some((l) => String(l).trim().startsWith('❯'))) {
      return true
    }
    await esperar(5000)
  }
  return false
}

let poT = null
let ambientePo = null
const hierarquia = (args, { tempo = 240_000, extra = {} } = {}) => {
  try {
    return execFileSync(process.execPath, [HIERARQUIA, ...args], {
      env: { ...ambientePo, ...extra },
      cwd: ambientePo.HIERARQUIA_PROJETO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: tempo,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (erro) {
    return `codigo ${erro.status}\n${erro.stdout ?? ''}${erro.stderr ?? ''}`
  }
}
function ordemTeste(projeto, nome, titulo, objetivo) {
  const arquivo = path.join(projeto, '.hierarquia', `${nome}.json`)
  writeFileSync(
    arquivo,
    JSON.stringify({
      titulo,
      objetivo,
      porque: 'prova da o-043 no Orca de teste',
      criterios: ['fazer so o que o objetivo diz'],
      limites: 'nao editar arquivos, nao rodar hierarquia entregar',
      territorio: 'nenhum'
    })
  )
  return spawn(
    process.execPath,
    [HIERARQUIA, 'ordem', '--teste', '--para', 'executor', '--arquivo', arquivo],
    {
      env: ambientePo,
      cwd: projeto,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
}
/** O chat que a ordem abriu, pelo registro (chat_lancado). */
function chatDaOrdem(projeto, ordemId, titulo) {
  const lancado = readFileSync(path.join(projeto, '.hierarquia', 'registro.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .findLast((e) => e.tipo === 'chat_lancado' && e.ordemId === ordemId)
  return lancado ? { tabId: lancado.chatId, handle: lancado.handle, titulo } : null
}
const juntarSaida = (filho) => {
  const coletor = { texto: '' }
  filho.stdout.on('data', (d) => (coletor.texto += d))
  filho.stderr.on('data', (d) => (coletor.texto += d))
  return coletor
}
const fimDe = (filho) =>
  filho.exitCode !== null ? Promise.resolve() : new Promise((pronto) => filho.on('exit', pronto))

/** Antes do X: telas, terminais, porta e processos (os do mundo e os Claude fora dele, que nao podem ser tocados). */
async function retratoAntes(chats, prefixo = 'antes') {
  guardar(`${prefixo}-terminais.json`, orcaTeste(['terminal', 'list']).result?.terminals ?? [])
  for (const [nome, chat] of Object.entries(chats)) {
    guardar(`antes-tela-${nome}.txt`, (ler(chat.handle)?.tail ?? []).join('\n'))
  }
  guardar('antes-porta.txt', hierarquia(['porta']))
  await foto('antes')
  const doMundo = processosDoMundo(pidsDoOrca)
  guardar('antes-processos-do-mundo.txt', linhasDosProcessos(doMundo))
  const fora = processos().filter(
    (p) => /^(claude|electron|orca)/iu.test(p.nome) && !doMundo.some((q) => q.pid === p.pid)
  )
  guardar(`${prefixo}-fora-do-mundo.txt`, linhasDosProcessos(fora))
  dizer(
    `${prefixo}: ${doMundo.length} processos do mundo (${doMundo.filter((p) => /^claude/iu.test(p.nome)).length} Claude); ${fora.length} processos Claude/Orca fora do mundo`
  )
  return fora
}

/** O X: fecha a janela, conta em 15 s e confere que nada fora do mundo foi tocado. */
async function fecharEContar(fora) {
  const tX = Date.now()
  const fechou = await fecharPeloX(orca, { prazoMs: 90_000 })
  dizer(`X: programa saiu = ${fechou} em ${((Date.now() - tX) / 1000).toFixed(1)} s`)
  await esperar(Math.max(0, 15_000 - (Date.now() - tX)))
  const vivos = processosDoMundo(pidsDoOrca)
  guardar('depois-x-15s-processos-do-mundo.txt', linhasDosProcessos(vivos))
  const agora = new Set(processos().map((p) => `${p.pid}\t${p.criado}`))
  const intactos = fora.filter((p) => agora.has(`${p.pid}\t${p.criado}`))
  guardar('depois-x-fora-do-mundo-intactos.txt', linhasDosProcessos(intactos))
  dizer(
    `15 s depois do X: ${vivos.length} processos do mundo vivos (${vivos.map((p) => p.nome).join(', ') || 'nenhum'}); fora do mundo intactos: ${intactos.length} de ${fora.length}`
  )
  if (existsSync(path.join(saida, 'pergunta-do-x.txt'))) {
    dizer(`pergunta do X:\n${readFileSync(path.join(saida, 'pergunta-do-x.txt'), 'utf8')}`)
  }
  return vivos
}

async function atalho(nome, marca) {
  const { janelaAberta, printDaJanela, responder } = await import('./janela-do-atalho.mjs')
  const t0 = Date.now()
  spawn(
    'wscript.exe',
    [
      path.join(RAIZ, 'abrir-orca-fork.vbs'),
      `/dados:${PERFIL}`,
      `/pasta:${RAIZ}`,
      `/abrir:cmd /c echo aberto > "${marca}"`
    ],
    { detached: true, stdio: 'ignore' }
  )
  let perguntou = false
  while (Date.now() - t0 < 60_000 && !existsSync(marca) && !perguntou) {
    perguntou = janelaAberta('Abrir o Orca')
    await esperar(1000)
  }
  if (perguntou) {
    await esperar(1500)
    dizer(
      `${nome}: pergunta na tela; print ${printDaJanela('Abrir o Orca', path.join(saida, `${nome}.png`))}`
    )
    dizer(`${nome}: resposta Nao -> ${responder('Abrir o Orca', 'n')}`)
    await esperar(4000)
  }
  dizer(
    `${nome}: perguntou=${perguntou}; abriu o Orca=${existsSync(marca)}; ${((Date.now() - t0) / 1000).toFixed(1)} s`
  )
}

/** Depois de reabrir: abas, sessoes guardadas para retomar, estado e registro. */
async function retratoReaberto(chats, projeto) {
  const terminais = orcaTeste(['terminal', 'list']).result?.terminals ?? []
  guardar('reaberto-terminais.json', terminais)
  for (const [nome, chat] of Object.entries(chats)) {
    const t = terminais.find((x) => x.tabId === chat.tabId)
    dizer(`reaberto ${nome}: aba ${t ? 'existe' : 'NAO existe'}, ligado=${t?.connected ?? '-'}`)
  }
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(
      path.join(PERFIL, 'profiles', 'local-default', 'profile-state.db'),
      {
        readOnly: true
      }
    )
    const sessao = JSON.parse(
      db
        .prepare(`select payload from profile_state_documents where domain='workspaceSession'`)
        .get().payload
    )
    db.close()
    const dormindo = Object.values(sessao.sleepingAgentSessionsByPaneKey ?? {})
    guardar('reaberto-sessoes-dormindo.json', dormindo)
    for (const [nome, chat] of Object.entries(chats)) {
      const r = dormindo.find((x) => x.tabId === chat.tabId)
      dizer(
        `reaberto ${nome}: conversa guardada para retomar = ${r ? `${r.providerSession?.id ?? '?'} (${r.state})` : 'nenhuma'}`
      )
    }
  } catch (erro) {
    dizer(`nao li as sessoes guardadas: ${String(erro).slice(0, 120)}`)
  }
  guardar('reaberto-estado.txt', hierarquia(['estado']))
  guardar(
    'reaberto-registro.jsonl',
    readFileSync(path.join(projeto, '.hierarquia', 'registro.jsonl'), 'utf8')
  )
  await foto('reaberto')
}

/** Acorda a aba dormindo (como o Kaique clicando no card): o Orca retoma a conversa do Claude nela. */
async function acordar(chat) {
  const r = orcaTeste(['terminal', 'switch', '--terminal', chat.handle])
  dizer(
    `acordar ${chat.titulo}: terminal switch -> ${r.ok === false ? JSON.stringify(r.error).slice(0, 160) : 'ok'}`
  )
  if (r.ok === false) {
    const clicou = await orca.page
      .getByText(chat.titulo, { exact: false })
      .first()
      .click({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
    dizer(`acordar ${chat.titulo}: clique na aba = ${clicou}`)
  }
}

let projetoA = null
try {
  montarMundo()
  projetoA = criarProjeto('teste-hierarquia')
  const B = criarProjeto('teste-hierarquia-2')
  confiarNoMundo()
  process.on('exit', () => desconfiarDoMundo())
  contar('antes de abrir o Orca de teste')
  await abrir()
  for (const pasta of [projetoA, B]) {
    const r = orcaTeste(['repo', 'add', '--path', pasta])
    if (!r.ok) {
      throw new Error(`repo add falhou: ${JSON.stringify(r).slice(0, 300)}`)
    }
  }
  const po = orcaTeste([
    'terminal',
    'create',
    '--worktree',
    `path:${projetoA}`,
    '--title',
    'TESTE fato: PO de teste (so o shell)'
  ])
  poT = po.result?.terminal ?? po.result
  ambientePo = ambienteDoMundo({
    ORCA_TAB_ID: poT.tabId,
    ORCA_TERMINAL_HANDLE: poT.handle,
    HIERARQUIA_PROJETO: projetoA,
    HIERARQUIA_LIBERACAO: LIBERACAO
  })
  dizer(hierarquia(['criar-po', '--projeto', projetoA]).trim().split('\n')[0])

  if (cena === 1) {
    const chats = {
      parado: abrirClaude(projetoA, 'TESTE fato: parado'),
      fundo: abrirClaude(B, 'TESTE fato: comando em segundo plano')
    }
    for (const [nome, chat] of Object.entries(chats)) {
      dizer(`${nome}: caixa do Claude pronta = ${await esperarCaixa(chat)}`)
    }
    enviar(chats.parado.handle, 'Responda apenas: OK PARADO')
    enviar(
      chats.fundo.handle,
      'Use a ferramenta Bash com run_in_background true e rode exatamente: sleep 1500 && echo FIM-FUNDO . Depois responda apenas: FUNDO LIGADO e encerre o turno.'
    )
    const lanc = ordemTeste(
      projetoA,
      'ordem-longo',
      'TESTE fato: comando longo cortado pelo X',
      'Nao leia nada e nao mexa em nada. Use a ferramenta Bash em PRIMEIRO plano (sem run_in_background, timeout 600000) e rode exatamente: sleep 590 . Quando terminar, rode de novo o mesmo sleep 590 . So responda FIM depois do segundo.'
    )
    const saidaLanc = juntarSaida(lanc)
    await fimDe(lanc)
    guardar('lancamento-longo.txt', saidaLanc.texto)
    dizer(`lancamento do longo: ${saidaLanc.texto.trim().split('\n').pop()}`)
    chats.longo = chatDaOrdem(projetoA, 'o-001', 'TESTE fato: comando longo cortado pelo X')
    if (!chats.longo) {
      throw new Error('a ordem do longo nao abriu chat')
    }
    await esperar(60_000)
    contar('com os 3 chats trabalhando')

    // A QUEDA: so o programa morre (sem X). Os chats seguem vivos no guarda de terminais; o atalho pergunta.
    await retratoAntes(chats, 'antes-da-queda')
    execFileSync('taskkill', ['/F', '/PID', String(orca.pid)], { stdio: 'ignore' })
    await orca.browser.close().catch(() => null)
    await esperar(10_000)
    const vivosQueda = processosDoMundo(pidsDoOrca)
    guardar('queda-processos-do-mundo.txt', linhasDosProcessos(vivosQueda))
    dizer(
      `queda (so o programa morreu): ${vivosQueda.filter((p) => /^claude/iu.test(p.nome)).length} Claude seguem vivos (${vivosQueda.length} processos do mundo)`
    )
    await atalho('atalho-com-chat-vivo', path.join(saida, 'atalho-abriu-1.txt'))

    // Reabre: o Orca se reconecta aos chats vivos.
    await abrir()
    await esperar(30_000)
    guardar(
      'depois-da-queda-terminais.json',
      orcaTeste(['terminal', 'list']).result?.terminals ?? []
    )
    for (const [nome, chat] of Object.entries(chats)) {
      const t = (orcaTeste(['terminal', 'list']).result?.terminals ?? []).find(
        (x) => x.tabId === chat.tabId
      )
      dizer(`depois da queda ${nome}: ligado=${t?.connected ?? 'sem aba'}`)
      if (t?.handle) {
        chat.handle = t.handle
      }
    }
    contar('depois de reabrir da queda')

    // O X.
    const fora = await retratoAntes(chats)
    await fecharEContar(fora)
    contar('depois do X')
    guardar(
      'depois-x-registro.jsonl',
      readFileSync(path.join(projetoA, '.hierarquia', 'registro.jsonl'), 'utf8')
    )
    await atalho('atalho-sem-chat', path.join(saida, 'atalho-abriu-2.txt'))

    // Reabre: os chats voltam dormindo; 45 s depois a volta (hierarquia retomar) liga o vigia do PO.
    await abrir()
    await esperar(200_000)
    await retratoReaberto(chats, projetoA)
    contar('reaberto, chats dormindo')
    // Acorda o longo: o Claude dele volta e a volta entrega o aviso uma vez.
    const lista = orcaTeste(['terminal', 'list']).result?.terminals ?? []
    chats.longo.handle =
      lista.find((t) => t.tabId === chats.longo.tabId)?.handle ?? chats.longo.handle
    await acordar(chats.longo)
    await esperar(150_000)
    const telaLongo = (ler(chats.longo.handle)?.tail ?? []).join('\n')
    guardar('acordado-tela-longo.txt', telaLongo)
    dizer(
      `longo acordado: aviso da volta na tela ${(telaLongo.match(/ORCA FOI FECHADO/gu) ?? []).length} vez(es)`
    )
    guardar('acordado-estado.txt', hierarquia(['estado']))
    guardar(
      'acordado-registro.jsonl',
      readFileSync(path.join(projetoA, '.hierarquia', 'registro.jsonl'), 'utf8')
    )
    await foto('acordado')
    contar('com o longo acordado')
  } else {
    const B2 = B.replaceAll('\\', '/')
    const chats = { pai: abrirClaude(B, 'TESTE fato: chat que abriu chat filho') }
    dizer(`pai: caixa do Claude pronta = ${await esperarCaixa(chats.pai)}`)
    enviar(
      chats.pai.handle,
      `Use a ferramenta Bash e rode exatamente: ${CLI_DO_MUNDO.replaceAll('\\', '/')} terminal create --worktree path:${B2} --title "TESTE fato: chat filho" --command "claude --model haiku --dangerously-skip-permissions" . Depois rode em PRIMEIRO plano (timeout 600000): sleep 590 . Nao responda nada antes do sleep terminar.`
    )
    await esperar(90_000)
    const filho = (orcaTeste(['terminal', 'list']).result?.terminals ?? []).find((t) =>
      /chat filho/u.test(t.title ?? '')
    )
    if (filho) {
      chats.filho = { handle: filho.handle, tabId: filho.tabId, titulo: 'TESTE fato: chat filho' }
    }
    dizer(`filho aberto pelo pai: ${Boolean(filho)}`)
    const lanc = ordemTeste(
      projetoA,
      'ordem-nascendo',
      'TESTE fato: ordem recem-lancada cortada pelo X',
      'Nao leia nada e nao mexa em nada. Responda apenas OK.'
    )
    const saidaLanc = juntarSaida(lanc)
    await esperar(25_000)
    contar('com o pai, o filho e a ordem nascendo')
    const nascendo = chatDaOrdem(
      projetoA,
      'o-001',
      'TESTE fato: ordem recem-lancada cortada pelo X'
    )
    if (nascendo) {
      chats.nascendo = nascendo
    }
    dizer(`ordem nascendo ja tem chat: ${Boolean(nascendo)}`)
    const fora = await retratoAntes(chats)
    await fecharEContar(fora)
    contar('depois do X')
    await fimDe(lanc)
    guardar('lancamento-nascendo.txt', saidaLanc.texto)
    dizer(
      `o lancamento cortado disse: ${saidaLanc.texto.trim().split('\n').slice(-2).join(' | ').slice(0, 400)}`
    )
    await abrir()
    await esperar(200_000)
    await retratoReaberto(chats, projetoA)
    contar('reaberto')
  }
} catch (erro) {
  dizer(`ERRO no roteiro: ${String(erro?.stack ?? erro).slice(0, 800)}`)
} finally {
  await orca?.browser.close().catch(() => null)
  const sobras = await encerrarMundo(pidsDoOrca)
  const maximo = teto.parar()
  dizer(
    `teto do roteiro: no maximo ${maximo.orcas} Orca de teste e ${maximo.claudes} Claude vivos ao mesmo tempo`
  )
  contar('no fim, depois de fechar tudo')
  dizer(`fim: sobras do mundo ${sobras.length}`)
  if (!process.argv.includes('--manter')) {
    apagarMundo()
  }
  dizer('roteiro terminou')
  process.exit(0)
}
