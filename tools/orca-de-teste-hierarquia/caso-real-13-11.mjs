// O caso real de 13/11 (o-043): o reinicio do Orca as 14:04 cortou 4 chats e o `hierarquia estado` continuou
// dizendo "trabalhando". Este roteiro roda o codigo novo sobre uma COPIA do registro real (cortada no momento logo
// depois do reinicio), com um Orca de mentira que responde como o Orca respondia naquela hora. Nunca toca no registro
// em uso nem no Orca de verdade.
// Uso: node tools/orca-de-teste-hierarquia/caso-real-13-11.mjs PROJETO_REAL PASTA_DE_SAIDA [MINUTOS_DO_VIGIA]
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const [projetoReal, saidaArg, minutosArg] = process.argv.slice(2)
const saida = path.resolve(saidaArg ?? 'caso-real')
const minutos = Number(minutosArg ?? 5)
const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const HIERARQUIA = path.join(RAIZ, 'skills', 'hierarquia', 'hierarquia.mjs')
const CORTE = '2026-11-13T17:06:58.650Z'
const PO = '8474b34a-d231-4856-a45c-bd8b66287737'
const PO_HANDLE = 'term_9dfc9a8c-b1be-4bca-86f8-1b1eba48f275'
// Abas que o Orca tinha depois de reabrir: o PO ligado e o planejador da o-041 dormindo; o-034 e o-037 fechadas.
const DORMINDO = ['a30966db-3d76-4036-b7e3-bff72ebd2b1d']

mkdirSync(saida, { recursive: true })
const base = path.join(os.tmpdir(), 'hierarquia-caso-real-13-11')
rmSync(base, { recursive: true, force: true })
const copia = path.join(base, 'orca-copia')
const dados = path.join(base, 'orca-dados')
const mentira = path.join(base, 'orca-de-mentira')
mkdirSync(path.join(copia, '.hierarquia'), { recursive: true })
mkdirSync(mentira, { recursive: true })

// 1. A copia do registro, so ate o instante logo depois do reinicio (antes de o PO dar baixa na mao).
const linhas = readFileSync(path.join(projetoReal, '.hierarquia', 'registro.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
const ate = linhas.filter((linha) => JSON.parse(linha).t <= CORTE)
writeFileSync(path.join(copia, '.hierarquia', 'registro.jsonl'), `${ate.join('\n')}\n`)
writeFileSync(
  path.join(copia, '.hierarquia', 'config.json'),
  readFileSync(path.join(projetoReal, '.hierarquia', 'config.json'))
)

// 2. A sessao que o Orca guarda em disco (de onde a hierarquia le as abas): PO e o-041 com aba, o resto sem.
mkdirSync(path.join(dados, 'profiles', 'local-default'), { recursive: true })
const db = new DatabaseSync(path.join(dados, 'profiles', 'local-default', 'profile-state.db'))
db.exec('create table profile_state_documents (domain text, payload text)')
const abas = [PO, ...DORMINDO].map((id) => ({ id, title: id.slice(0, 8) }))
db.prepare('insert into profile_state_documents values (?, ?)').run(
  'workspaceSession',
  JSON.stringify({ tabsByWorktree: { [`repo::${copia}`]: abas } })
)
db.close()

// 3. O Orca de mentira: so o terminal do PO esta ligado, com o Claude aberto; tudo o que seria digitado vai para um log.
const LINHA = '─'.repeat(100)
writeFileSync(
  path.join(mentira, 'orca.mjs'),
  `import { appendFileSync } from 'node:fs'
const argv = process.argv.slice(2).filter((a) => a !== '--json')
const log = (t) => appendFileSync(${JSON.stringify(path.join(mentira, 'chamadas.log'))}, new Date().toISOString() + ' ' + t + '\\n')
const ok = (result) => console.log(JSON.stringify({ ok: true, result }))
const [g, v] = argv
if (g === 'terminal' && v === 'list') {
  ok({ terminals: [{ handle: ${JSON.stringify(PO_HANDLE)}, tabId: ${JSON.stringify(PO)}, connected: true, agentIdentity: 'claude' }] })
} else if (g === 'terminal' && v === 'read') {
  ok({ terminal: { tail: ['resposta anterior do PO', ${JSON.stringify(LINHA)}, '❯ ', ${JSON.stringify(LINHA)}, '  ⏵⏵ bypass permissions on'] } })
} else if (g === 'terminal' && v === 'send') {
  log('DIGITADO em ' + argv[argv.indexOf('--terminal') + 1] + ': ' + argv[argv.indexOf('--text') + 1])
  ok({})
} else if (g === 'orchestration' && v === 'check') {
  await new Promise((r) => setTimeout(r, 60000))
  ok({ messages: [] })
} else {
  log('outro: ' + argv.join(' '))
  ok({})
}
`
)
const cli = path.join(mentira, 'orca.cmd')
writeFileSync(cli, `@echo off\r\n"${process.execPath}" "${path.join(mentira, 'orca.mjs')}" %*\r\n`)

const ambiente = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([nome]) => !/^(ORCA_|HIERARQUIA_)/u.test(nome))
  ),
  HIERARQUIA_PROJETO: copia,
  HIERARQUIA_ORCA: cli,
  HIERARQUIA_ORCA_DADOS: dados,
  HIERARQUIA_INDICE: path.join(base, 'indice.json'),
  HIERARQUIA_LIBERACAO: path.join(base, 'liberacao.json'),
  HIERARQUIA_VEZ: path.join(base, 'vez')
}
const estado = (script, nome) => {
  let texto
  try {
    texto = execFileSync(process.execPath, [script, 'estado'], {
      env: ambiente,
      cwd: copia,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (erro) {
    texto = `${erro.stdout ?? ''}${erro.stderr ?? ''}`
  }
  writeFileSync(path.join(saida, nome), texto)
  return texto
}
const resumo = (texto) =>
  texto
    .split('\n')
    .filter((l) => /o-034 |o-037 |o-041 |pode reabrir/u.test(l))
    .map((l) => l.slice(0, 220))
    .join('\n')

console.log(`copia: ${ate.length} de ${linhas.length} linhas do registro (ate ${CORTE})`)
const velho = path.join(projetoReal, 'skills', 'hierarquia', 'hierarquia.mjs')
if (existsSync(velho)) {
  console.log('\n== codigo em uso (feat/pc-como-mesa), logo depois do reinicio ==')
  console.log(resumo(estado(velho, '1-estado-codigo-em-uso.txt')))
}
console.log('\n== codigo novo, logo depois do reinicio (antes de o vigia passar) ==')
console.log(resumo(estado(HIERARQUIA, '2-estado-codigo-novo-antes-do-vigia.txt')))

// 4. O vigia do PO (como o Orca do fork liga 45 s depois de abrir, pelo `hierarquia retomar`), por alguns minutos.
const vigia = spawn(process.execPath, [HIERARQUIA, 'vigiar', '--projeto', copia, '--chat', PO], {
  env: { ...ambiente, ORCA_TAB_ID: PO, ORCA_TERMINAL_HANDLE: PO_HANDLE },
  windowsHide: true,
  stdio: 'ignore'
})
console.log(`\nvigia do PO ligado (pid ${vigia.pid}); esperando ${minutos} min...`)
await new Promise((pronto) => setTimeout(pronto, minutos * 60_000))
try {
  execFileSync('taskkill', ['/F', '/T', '/PID', String(vigia.pid)], { stdio: 'ignore' })
} catch {
  // ja saiu
}

console.log(`\n== codigo novo, ${minutos} min depois de o Orca reabrir ==`)
console.log(resumo(estado(HIERARQUIA, '3-estado-codigo-novo-depois-do-vigia.txt')))
const digitado = existsSync(path.join(mentira, 'chamadas.log'))
  ? readFileSync(path.join(mentira, 'chamadas.log'), 'utf8')
  : ''
writeFileSync(path.join(saida, '4-o-que-o-orca-recebeu.txt'), digitado)
const avisos = digitado.split('\n').filter((l) => l.includes('DIGITADO'))
console.log(`\n== avisos digitados no chat do PO: ${avisos.length} ==`)
console.log(avisos.map((l) => l.slice(0, 300)).join('\n'))
const novos = readFileSync(path.join(copia, '.hierarquia', 'registro.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .slice(ate.length)
writeFileSync(path.join(saida, '5-registro-novo-do-vigia.jsonl'), `${novos.join('\n')}\n`)
console.log(`\n== o que o vigia anotou (${novos.length} linhas) ==`)
console.log(novos.map((l) => l.slice(0, 260)).join('\n'))
const vigiaLog = path.join(copia, '.hierarquia', 'vigias', `${PO}.log`)
if (existsSync(vigiaLog)) {
  writeFileSync(path.join(saida, '6-log-do-vigia.txt'), readFileSync(vigiaLog))
}
process.exit(0)
