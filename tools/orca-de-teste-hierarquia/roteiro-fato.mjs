// O FATO (o-041 parte 1): o que acontece com chats do Orca de teste quando a janela fecha pelo X e o Orca reabre.
// Uso: node tools/orca-de-teste-hierarquia/roteiro-fato.mjs PASTA_DE_SAIDA [--fork-para-chats]
// Situacoes: parado, no meio de comando longo, com comando em segundo plano, com chat filho aberto (teste com filhos)
// e ordem recem-lancada ainda nascendo. Gasta Claude de verdade (haiku), so dentro do mundo de teste.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  abrirOrca,
  ambienteDoMundo,
  apagarMundo,
  confiarNoMundo,
  desconfiarDoMundo,
  CLI_DO_MUNDO,
  criarProjeto,
  encerrarMundo,
  esperar,
  fecharPeloX,
  montarMundo,
  orcaTeste,
  PERFIL,
  processos,
  processosDoMundo,
  RAIZ
} from './orca-de-teste.mjs'

const saida = path.resolve(process.argv[2] ?? 'fato')
const comFork = process.argv.includes('--fork-para-chats')
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
const extraEnv = comFork
  ? {
      ORCA_FORK_FECHAR_PARA_CHATS: '1',
      ORCA_FORK_PORTA: HIERARQUIA,
      HIERARQUIA_ORCA: CLI_DO_MUNDO,
      HIERARQUIA_ORCA_DADOS: PERFIL,
      HIERARQUIA_INDICE: ambienteDoMundo().HIERARQUIA_INDICE,
      HIERARQUIA_LIBERACAO: path.join(path.dirname(PERFIL), 'liberacao.json'),
      // O teste nunca abre janela na tela: a pergunta do X vai para um arquivo e e respondida "fechar".
      ORCA_FORK_X_TESTE_RESPOSTA: 'fechar',
      ORCA_FORK_X_TESTE_SAIDA: path.join(saida, 'pergunta-do-x.txt')
    }
  : {}

montarMundo()
const A = criarProjeto('teste-hierarquia')
const B = criarProjeto('teste-hierarquia-2')
// O Claude pergunta se confia na pasta nova: so as pastas do mundo entram, e saem no fim.
confiarNoMundo()
process.on('exit', () => desconfiarDoMundo())
let orca = await abrirOrca({ extraEnv, log: dizer })
const foto = async (nome) => {
  await orca.page.setViewportSize({ width: 1500, height: 950 }).catch(() => null)
  await orca.page.screenshot({ path: path.join(saida, `${nome}.png`) }).catch(() => null)
}
orcaTeste(['status'])
for (const pasta of [A, B]) {
  const r = orcaTeste(['repo', 'add', '--path', pasta])
  if (!r.ok) {
    throw new Error(`repo add falhou: ${JSON.stringify(r).slice(0, 300)}`)
  }
}

/** Abre um Claude (haiku) como chat de terminal no projeto e devolve { handle, tabId }. */
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

const ler = (handle) => {
  try {
    return orcaTeste(['terminal', 'read', '--terminal', handle]).result?.terminal ?? null
  } catch {
    return null
  }
}
const enviar = (handle, texto) =>
  orcaTeste(['terminal', 'send', '--terminal', handle, '--text', JSON.stringify(texto), '--enter'])

async function esperarCaixa(chat, prazo = 180_000) {
  const limite = Date.now() + prazo
  while (Date.now() < limite) {
    const tela = ler(chat.handle)?.tail ?? []
    const texto = tela.join('\n')
    if (/Yes, I trust/iu.test(texto)) {
      return false
    } else if (tela.some((l) => String(l).trim().startsWith('❯'))) {
      return true
    }
    await esperar(3000)
  }
  return false
}

const chats = {
  parado: abrirClaude(A, 'TESTE fato: parado'),
  longo: abrirClaude(A, 'TESTE fato: comando longo'),
  fundo: abrirClaude(B, 'TESTE fato: comando em segundo plano'),
  pai: abrirClaude(B, 'TESTE fato: teste que abriu chat filho')
}
dizer(
  `4 chats criados: ${JSON.stringify(Object.fromEntries(Object.entries(chats).map(([k, v]) => [k, v.tabId])))}`
)
for (const [nome, chat] of Object.entries(chats)) {
  dizer(`${nome}: caixa pronta = ${await esperarCaixa(chat)}`)
}
enviar(chats.parado.handle, 'Responda apenas: OK PARADO')
enviar(
  chats.longo.handle,
  'Use a ferramenta Bash em PRIMEIRO plano (nao use run_in_background) e rode exatamente: sleep 900 && echo FIM-LONGO . Depois diga FIM.'
)
enviar(
  chats.fundo.handle,
  'Use a ferramenta Bash com run_in_background true e rode exatamente: sleep 900 && echo FIM-FUNDO . Depois responda apenas: FUNDO LIGADO e encerre o turno.'
)
enviar(
  chats.pai.handle,
  `Use a ferramenta Bash e rode exatamente este comando, que abre um chat filho no Orca de teste: ${CLI_DO_MUNDO.replaceAll('\\', '/')} terminal create --worktree path:${B.replaceAll('\\', '/')} --title TESTE-filho --command claude . Depois rode em primeiro plano: sleep 900 . Nao responda nada antes do sleep terminar.`
)
await esperar(75_000)

// Ordem recem-lancada: um "PO" de teste (um shell do mundo) lanca uma ordem e o X vem enquanto o chat nasce.
const po = orcaTeste([
  'terminal',
  'create',
  '--worktree',
  `path:${A}`,
  '--title',
  'TESTE fato: PO de teste (shell)'
])
const poT = po.result?.terminal ?? po.result
const ambientePo = ambienteDoMundo({
  ORCA_TAB_ID: poT.tabId,
  ORCA_TERMINAL_HANDLE: poT.handle,
  HIERARQUIA_PROJETO: A,
  HIERARQUIA_LIBERACAO: path.join(path.dirname(PERFIL), 'liberacao.json')
})
const hierarquia = (args, opcoes = {}) =>
  execFileSync(process.execPath, [HIERARQUIA, ...args], {
    env: ambientePo,
    cwd: A,
    encoding: 'utf8',
    windowsHide: true,
    timeout: opcoes.tempo ?? 120_000
  })
dizer(hierarquia(['criar-po', '--projeto', A]).trim())
writeFileSync(
  path.join(A, '.hierarquia', 'ordem-nascendo.json'),
  JSON.stringify({
    titulo: 'TESTE fato: ordem recem-lancada',
    objetivo: 'Responder OK e esperar.',
    porque: 'teste do fato da o-041',
    criterios: ['responder OK'],
    limites: 'nao mexer em nada',
    territorio: 'nenhum'
  })
)
const { spawn } = await import('node:child_process')
const lancamento = spawn(
  process.execPath,
  [
    HIERARQUIA,
    'ordem',
    '--para',
    'executor',
    '--arquivo',
    path.join(A, '.hierarquia', 'ordem-nascendo.json')
  ],
  { env: ambientePo, cwd: A, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
)
let saidaLanc = ''
lancamento.stdout.on('data', (d) => (saidaLanc += d))
lancamento.stderr.on('data', (d) => (saidaLanc += d))
await esperar(40_000)

// ANTES: telas, terminais, processos.
const terminaisAntes = orcaTeste(['terminal', 'list']).result.terminals
guardar('antes-terminais.json', terminaisAntes)
for (const [nome, chat] of Object.entries(chats)) {
  guardar(`antes-tela-${nome}.txt`, (ler(chat.handle)?.tail ?? []).join('\n'))
}
await foto('antes')
const procAntes = processosDoMundo([orca.pid])
guardar(
  'antes-processos.txt',
  procAntes.map((p) => `${p.pid}\t${p.pai}\t${p.nome}\t${p.comando.slice(0, 200)}`).join('\n')
)
const foraAntes = processos().filter(
  (p) => /^claude/iu.test(p.nome) && !procAntes.some((q) => q.pid === p.pid)
)
guardar('antes-claudes-fora-do-mundo.txt', foraAntes.map((p) => `${p.pid}\t${p.nome}`).join('\n'))
dizer(
  `antes: ${procAntes.length} processos do mundo (${procAntes.filter((p) => /claude/iu.test(p.nome)).length} claude); ${foraAntes.length} claude fora do mundo`
)

// X.
const pidDoOrca = orca.pid
const tX = Date.now()
const fechou = await fecharPeloX(orca, { prazoMs: 90_000 })
dizer(`X: janela fechada, programa saiu = ${fechou} em ${((Date.now() - tX) / 1000).toFixed(1)} s`)
await esperar(Math.max(0, 15_000 - (Date.now() - tX)))
const procDepois = processosDoMundo([pidDoOrca])
guardar(
  'depois-x-15s-processos.txt',
  procDepois.map((p) => `${p.pid}\t${p.pai}\t${p.nome}\t${p.comando.slice(0, 200)}`).join('\n')
)
const foraDepois = processos().filter((p) => /^claude/iu.test(p.nome))
guardar('depois-x-claudes-da-maquina.txt', foraDepois.map((p) => `${p.pid}\t${p.nome}`).join('\n'))
const intactos = foraAntes.filter((p) => foraDepois.some((q) => q.pid === p.pid)).length
dizer(
  `15 s depois do X: ${procDepois.length} processos do mundo vivos (${procDepois.map((p) => p.nome).join(', ')}); claude fora do mundo intactos: ${intactos} de ${foraAntes.length}`
)
dizer(`lancamento da ordem (saida ate aqui): ${saidaLanc.replace(/\s+/gu, ' ').slice(0, 400)}`)
lancamento.kill()

// O ATALHO (criterio 4), so sem a opcao do fork: com o Orca fechado e os chats ainda vivos, ele pergunta.
if (!comFork && process.argv.includes('--atalho')) {
  const { janelaAberta, printDaJanela, responder } = await import('./janela-do-atalho.mjs')
  const marca = path.join(saida, 'atalho-abriu.txt')
  const rodarAtalho = () =>
    spawn(
      'wscript.exe',
      [
        path.join(RAIZ, 'abrir-orca-fork.vbs'),
        `/dados:${PERFIL}`,
        `/pasta:${RAIZ}`,
        `/abrir:cmd /c echo aberto > "${marca}"`
      ],
      { windowsHide: false, detached: true, stdio: 'ignore' }
    )
  rodarAtalho()
  let viu = false
  for (let i = 0; i < 40 && !viu; i++) {
    await esperar(1000)
    viu = janelaAberta('Abrir o Orca')
  }
  dizer(`atalho com chats vivos: pergunta na tela = ${viu}`)
  if (viu) {
    dizer(
      `print da pergunta: ${printDaJanela('Abrir o Orca', path.join(saida, 'atalho-pergunta.png'))}`
    )
    dizer(`resposta Nao: ${responder('Abrir o Orca', 'n')}`)
    await esperar(3000)
  }
  const { existsSync } = await import('node:fs')
  dizer(`depois do Nao, o atalho abriu o Orca? ${existsSync(marca)}`)
}

// Reabrir.
orca = await abrirOrca({ extraEnv, log: dizer })
// Com o fork, a volta comeca 45 s depois de abrir (hierarquia retomar) e o vigia confere a cada 30 s.
await esperar(comFork ? 180_000 : 45_000)
const terminaisDepois = orcaTeste(['terminal', 'list']).result.terminals
guardar('reaberto-terminais.json', terminaisDepois)
for (const [nome, chat] of Object.entries(chats)) {
  const t = terminaisDepois.find((x) => x.tabId === chat.tabId)
  dizer(`reaberto ${nome}: aba ${t ? 'existe' : 'NAO existe'}, ligado=${t?.connected ?? '-'}`)
  if (t?.connected) {
    guardar(`reaberto-tela-${nome}.txt`, (ler(t.handle)?.tail ?? []).join('\n'))
  }
}
await foto('reaberto')
guardar(
  'reaberto-registro.jsonl',
  execFileSync('cat', [path.join(A, '.hierarquia', 'registro.jsonl')], { encoding: 'utf8' })
)
try {
  // O que o Orca guardou para retomar cada chat (a conversa do Claude volta por esta sessao gravada).
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(path.join(PERFIL, 'profiles', 'local-default', 'profile-state.db'), {
    readOnly: true
  })
  const sessao = JSON.parse(
    db.prepare(`select payload from profile_state_documents where domain='workspaceSession'`).get()
      .payload
  )
  db.close()
  const dormindo = Object.values(sessao.sleepingAgentSessionsByPaneKey ?? {})
  for (const [nome, chat] of Object.entries(chats)) {
    const r = dormindo.find((x) => x.tabId === chat.tabId)
    dizer(
      `reaberto ${nome}: sessao guardada para retomar = ${r ? `${r.providerSession?.id} (estado ${r.state})` : 'nenhuma'}`
    )
  }
  guardar('reaberto-sessoes-dormindo.json', JSON.stringify(dormindo, null, 2))
} catch (erro) {
  dizer(`nao li as sessoes guardadas: ${String(erro).slice(0, 120)}`)
}
guardar(
  'reaberto-foto-estado.json',
  execFileSync('cat', [path.join(A, '.hierarquia', 'estado.json')], { encoding: 'utf8' })
)
try {
  guardar('reaberto-estado.txt', hierarquia(['estado'], { tempo: 240_000 }))
} catch (erro) {
  guardar('reaberto-estado.txt', String(erro.stdout ?? '') + String(erro.stderr ?? ''))
}
const procReaberto = processosDoMundo([orca.pid])
dizer(
  `reaberto: ${procReaberto.length} processos do mundo (${procReaberto.filter((p) => /claude/iu.test(p.nome)).length} claude)`
)

if (!process.argv.includes('--manter')) {
  await orca.browser.close().catch(() => null)
  const sobras = await encerrarMundo([orca.pid, pidDoOrca])
  dizer(`fim: sobras do mundo ${sobras.length}`)
  if (!comFork && process.argv.includes('--atalho')) {
    // Sem nenhum chat vivo: o atalho abre direto, sem pergunta e sem janela de cmd.
    const { janelaAberta } = await import('./janela-do-atalho.mjs')
    const { existsSync } = await import('node:fs')
    const marca2 = path.join(saida, 'atalho-abriu-direto.txt')
    const t0 = Date.now()
    spawn(
      'wscript.exe',
      [
        path.join(RAIZ, 'abrir-orca-fork.vbs'),
        `/dados:${PERFIL}`,
        `/pasta:${RAIZ}`,
        `/abrir:cmd /c echo aberto > "${marca2}"`
      ],
      { detached: true, stdio: 'ignore' }
    )
    let perguntou = false
    while (Date.now() - t0 < 20_000 && !existsSync(marca2)) {
      perguntou ||= janelaAberta('Abrir o Orca')
      await esperar(500)
    }
    dizer(
      `atalho sem chat vivo: abriu direto = ${existsSync(marca2)} em ${((Date.now() - t0) / 1000).toFixed(1)} s; pergunta apareceu = ${perguntou}`
    )
  }
  apagarMundo()
}
dizer('roteiro terminou')
process.exit(0)
