// Provas da o-041 no Orca de teste (com a opcao do fork ligada): a porta, lancar e reabrir nunca juntos, chat de
// TESTE sem vaga, 3 lancamentos com o Enter do Orca, aviso guardado com o Claude fechado e o vigia que troca de codigo.
// Uso: node tools/orca-de-teste-hierarquia/roteiro-porta.mjs PASTA_DE_SAIDA
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  abrirOrca,
  ambienteDoMundo,
  apagarMundo,
  CLI_DO_MUNDO,
  criarProjeto,
  encerrarMundo,
  esperar,
  MUNDO,
  montarMundo,
  orcaTeste,
  PERFIL,
  RAIZ
} from './orca-de-teste.mjs'

const saida = path.resolve(process.argv[2] ?? 'porta')
mkdirSync(saida, { recursive: true })
const inicio = Date.now()
const relato = []
const dizer = (texto) => {
  const linha = `[${((Date.now() - inicio) / 1000).toFixed(0).padStart(5)} s] ${texto}`
  relato.push(linha)
  console.log(linha)
  writeFileSync(path.join(saida, 'relato.txt'), `${relato.join('\n')}\n`)
}
const guardar = (nome, texto) => writeFileSync(path.join(saida, nome), String(texto))
const HIERARQUIA = path.join(RAIZ, 'skills', 'hierarquia', 'hierarquia.mjs')
const LIBERACAO = path.join(MUNDO, 'liberacao.json')
const extraEnv = {
  ORCA_FORK_FECHAR_PARA_CHATS: '1',
  ORCA_FORK_PORTA: HIERARQUIA,
  HIERARQUIA_ORCA: CLI_DO_MUNDO,
  HIERARQUIA_ORCA_DADOS: PERFIL,
  HIERARQUIA_INDICE: ambienteDoMundo().HIERARQUIA_INDICE,
  HIERARQUIA_LIBERACAO: LIBERACAO
}

montarMundo()
const A = criarProjeto('teste-hierarquia')
const B = criarProjeto('teste-hierarquia-2')
const orca = await abrirOrca({ extraEnv, log: dizer })
for (const pasta of [A, B]) {
  orcaTeste(['repo', 'add', '--path', pasta])
}
const shell = (pasta, titulo) => {
  const r = orcaTeste(['terminal', 'create', '--worktree', `path:${pasta}`, '--title', titulo])
  return r.result?.terminal ?? r.result
}
const ler = (handle) => {
  try {
    return orcaTeste(['terminal', 'read', '--terminal', handle]).result?.terminal ?? null
  } catch {
    return null
  }
}
const poA = shell(A, 'TESTE porta: PO de teste A (so o shell)')
const poB = shell(B, 'TESTE porta: PO de teste B (so o shell)')
const ambiente = (po, projeto, extra = {}) =>
  ambienteDoMundo({
    ORCA_TAB_ID: po.tabId,
    ORCA_TERMINAL_HANDLE: po.handle,
    HIERARQUIA_PROJETO: projeto,
    HIERARQUIA_LIBERACAO: LIBERACAO,
    ...extra
  })
function hierarquia(po, projeto, args, extra = {}) {
  try {
    const texto = execFileSync(process.execPath, [HIERARQUIA, ...args], {
      env: ambiente(po, projeto, extra),
      cwd: projeto,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15 * 60_000,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return { codigo: 0, texto }
  } catch (erro) {
    return { codigo: erro.status, texto: `${erro.stdout ?? ''}${erro.stderr ?? ''}` }
  }
}
const passo = (nome, r) => {
  guardar(`${nome}.txt`, `codigo de saida: ${r.codigo}\n${r.texto}`)
  dizer(`${nome}: codigo ${r.codigo} | ${r.texto.trim().split('\n')[0].slice(0, 150)}`)
  return r
}
dizer(passo('00-criar-po-A', hierarquia(poA, A, ['criar-po', '--projeto', A])).texto.slice(0, 0))
passo('00-criar-po-B', hierarquia(poB, B, ['criar-po', '--projeto', B]))

// Criterio 2 e 9: sem nenhum chat trabalhando, pode.
passo('01-porta-sem-ninguem', hierarquia(poA, A, ['porta']))
passo('01-estado-sem-ninguem', hierarquia(poA, A, ['estado']))

const ordem = (n, titulo) => {
  const arquivo = path.join(A, '.hierarquia', `ordem-teste-${n}.json`)
  writeFileSync(
    arquivo,
    JSON.stringify({
      titulo,
      objetivo:
        'Chat de teste da o-041. Nao leia nada e nao mexa em nada. Rode com a ferramenta Bash em primeiro plano: sleep 240 . Depois responda apenas OK.',
      porque: 'provar o lancamento de chat de teste',
      criterios: ['responder OK depois do sleep'],
      limites: 'nao editar arquivos, nao rodar hierarquia entregar',
      territorio: 'nenhum'
    })
  )
  return arquivo
}

// Criterio 16, 13, 15: tres lancamentos de chat TESTE, um por vez, pelo comando de verdade.
const lancados = []
for (let n = 1; n <= 3; n++) {
  const t0 = Date.now()
  const filho = spawn(
    process.execPath,
    [
      HIERARQUIA,
      'ordem',
      '--teste',
      '--para',
      'executor',
      '--arquivo',
      ordem(n, `TESTE lancamento ${n} da o-041 (Enter do Orca)`)
    ],
    { env: ambiente(poA, A), cwd: A, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let texto = ''
  filho.stdout.on('data', (d) => (texto += d))
  filho.stderr.on('data', (d) => (texto += d))
  if (n === 1) {
    // Criterio 3: com a ordem recem-lancada, a porta nao libera.
    await esperar(15_000)
    passo('02-porta-com-ordem-nascendo', hierarquia(poA, A, ['porta']))
    passo('02-liberar-com-ordem-nascendo', hierarquia(poA, A, ['porta', '--liberar']))
  }
  await new Promise((pronto) => filho.on('exit', pronto))
  guardar(`03-lancamento-${n}.txt`, texto)
  dizer(
    `lancamento ${n}: ${((Date.now() - t0) / 1000).toFixed(0)} s | ${texto.trim().split('\n').pop()}`
  )
  const registro = readFileSync(path.join(A, '.hierarquia', 'registro.jsonl'), 'utf8')
  const id = `o-${String(n).padStart(3, '0')}`
  const iniciou = registro
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .find((e) => e.tipo === 'chat_iniciou' && e.ordemId === id)
  dizer(
    `  ${id} chat_iniciou: ${iniciou ? `enviadaPeloComando=${iniciou.enviadaPeloComando}` : 'NAO'}`
  )
  lancados.push(id)
  if (n === 3) {
    // Criterio 2 (outro projeto) e 7: o PO do projeto B pergunta, com o chat de A trabalhando e um chat livre em B.
    const livre = orcaTeste([
      'terminal',
      'create',
      '--worktree',
      `path:${B}`,
      '--title',
      'TESTE porta: chat livre trabalhando',
      '--command',
      'claude --model haiku --dangerously-skip-permissions'
    ])
    const livreT = livre.result?.terminal ?? livre.result
    await esperar(20_000)
    orcaTeste([
      'terminal',
      'send',
      '--terminal',
      livreT.handle,
      '--text',
      '"Use a ferramenta Bash em primeiro plano e rode: sleep 200"',
      '--enter'
    ])
    await esperar(30_000)
    passo('04-porta-do-projeto-B', hierarquia(poB, B, ['porta']))
    passo('04-estado-do-projeto-B', hierarquia(poB, B, ['estado']))
  }
  // Tela do chat: a ordem chegou e nenhum "You have N messages" escapou.
  const est = JSON.parse(readFileSync(path.join(A, '.hierarquia', 'estado.json'), 'utf8'))
  const chat = est.chats[est.ordens[id]?.chatId]
  const tela = chat ? (ler(chat.handle)?.tail ?? []).join('\n') : ''
  guardar(`03-tela-chat-${n}.txt`, tela)
  const telaPo = (ler(poA.handle)?.tail ?? []).join('\n')
  dizer(
    `  tela do chat ${n}: ordem na tela=${tela.includes(`ORDEM ${id}`)}; "You have" no chat=${/You have \d+/u.test(tela)}; no PO=${/You have \d+/u.test(telaPo)}`
  )
}

// Criterio 12: o PO A e so um shell (Claude fechado): fechar o pedido nao digita nada nele; o aviso fica guardado.
for (const id of lancados) {
  passo(
    `05-baixa-${id}`,
    hierarquia(poA, A, ['baixa', '--ordem', id, '--motivo', 'fim do teste da o-041'])
  )
}
await esperar(90_000)
passo('05-estado-com-aviso-guardado', hierarquia(poA, A, ['estado']))
const telaShell = (ler(poA.handle)?.tail ?? []).join('\n')
guardar('05-tela-do-shell-do-PO.txt', telaShell)
dizer(`shell do PO: "PEDIDO FECHADO" digitado no shell = ${telaShell.includes('PEDIDO FECHADO')}`)

// Criterio 14: o codigo da hierarquia muda (data do arquivo), o vigia ligado troca sozinho em ate 1 min.
const pidAntes = JSON.parse(
  readFileSync(path.join(A, '.hierarquia', 'vigias', `${poA.tabId}.json`), 'utf8')
).pid
const agora = new Date()
utimesSync(path.join(RAIZ, 'skills', 'hierarquia', 'regras.mjs'), agora, agora)
dizer(`codigo "mudado" (data de regras.mjs) com o vigia ${pidAntes} ligado`)
await esperar(70_000)
const vigiaDepois = JSON.parse(
  readFileSync(path.join(A, '.hierarquia', 'vigias', `${poA.tabId}.json`), 'utf8')
)
dizer(`vigia depois de 70 s: ${vigiaDepois.pid} (antes ${pidAntes})`)

// Criterio 12 (fim): abre o Claude no chat do PO; o aviso guardado chega uma vez.
orcaTeste([
  'terminal',
  'send',
  '--terminal',
  poA.handle,
  '--text',
  '"claude --model haiku --dangerously-skip-permissions"',
  '--enter'
])
await esperar(120_000)
const telaClaude = (ler(poA.handle)?.tail ?? []).join('\n')
guardar('06-tela-do-PO-com-Claude.txt', telaClaude)
const vezes = (telaClaude.match(/PEDIDO FECHADO/gu) ?? []).length
dizer(`Claude aberto no chat do PO: "PEDIDO FECHADO" aparece ${vezes} vez(es)`)
passo('06-estado-depois', hierarquia(poA, A, ['estado']))
guardar(
  '07-log-do-vigia.txt',
  readFileSync(path.join(A, '.hierarquia', 'vigias', `${poA.tabId}.log`), 'utf8')
)
guardar('07-registro-A.jsonl', readFileSync(path.join(A, '.hierarquia', 'registro.jsonl'), 'utf8'))

// Criterio 3: sem ninguem trabalhando e com a ordem "velha" (relogio do teste 11 min a frente), libera; depois recusa ordem nova.
for (const id of lancados) {
  hierarquia(poA, A, ['fechar', '--ordem', id])
}
const avancar = { HIERARQUIA_TESTE_AVANCAR_MS: String(11 * 60_000) }
passo('08-liberar-sem-ninguem', hierarquia(poA, A, ['porta', '--liberar'], avancar))
passo(
  '08-ordem-com-liberacao-aberta',
  hierarquia(
    poA,
    A,
    ['ordem', '--teste', '--para', 'executor', '--arquivo', ordem(9, 'TESTE nao deve sair')],
    avancar
  )
)
passo('08-estado-com-liberacao', hierarquia(poA, A, ['estado'], avancar))
passo('08-cancelar', hierarquia(poA, A, ['porta', '--cancelar']))
void existsSync

await orca.browser.close().catch(() => null)
const sobras = await encerrarMundo([orca.pid])
dizer(`fim: sobras do mundo ${sobras.length}`)
if (!process.argv.includes('--manter')) {
  apagarMundo()
}
process.exit(0)
