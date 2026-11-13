// Prova do complemento 2 da o-043: `hierarquia estado` mostra no topo os chats que esperam o Kaique confirmar o
// fechamento. Roda sobre uma COPIA do registro real de agora, com as abas que o Orca em uso guarda (so leitura) e um
// Orca de mentira sem terminal ligado. Depois "fecha" esses chats na copia (chat_encerrado) e mostra a linha sumir.
// --as-14h28: o registro ate 17:30Z e as abas que o `hierarquia estado` real mostrava as 14:28 de 13/11 (PO, o-042 e
// o-043 ligados; o-001, o-014, o-015, o-018, o-035 e o-036 dormindo), numa sessao de mentira (o PO fechou esses chats depois).
// --fechar-herdadas (complemento 3): o PO atual (8474) roda `hierarquia fechar` nas ordens cujo criador nao existe mais
// (o-036/o-037 do planejador da o-034, o-001/o-014/o-015/o-018 de POs antigos), primeiro com o codigo em uso e depois
// com o novo. O Orca de mentira so anota o que fecharia.
// Uso: node tools/orca-de-teste-hierarquia/caso-esperando-fechar.mjs PROJETO_REAL PASTA_DE_SAIDA [--as-14h28] [--fechar-herdadas]
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const [projetoReal, saidaArg] = process.argv.slice(2)
const as14h28 = process.argv.includes('--as-14h28')
const saida = path.resolve(saidaArg ?? 'esperando-fechar')
const HIERARQUIA = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'skills',
  'hierarquia',
  'hierarquia.mjs'
)
const base = path.join(os.tmpdir(), 'hierarquia-caso-esperando-fechar')
rmSync(base, { recursive: true, force: true })
const copia = path.join(base, 'orca-copia')
mkdirSync(path.join(copia, '.hierarquia'), { recursive: true })
mkdirSync(saida, { recursive: true })
for (const nome of ['registro.jsonl', 'config.json']) {
  const texto = readFileSync(path.join(projetoReal, '.hierarquia', nome), 'utf8')
  const corte = (linha) =>
    !as14h28 || nome !== 'registro.jsonl' || JSON.parse(linha).t <= '2026-11-13T17:30:00.000Z'
  writeFileSync(
    path.join(copia, '.hierarquia', nome),
    nome === 'registro.jsonl'
      ? `${texto.split('\n').filter(Boolean).filter(corte).join('\n')}\n`
      : texto
  )
}
const LIGADOS = [
  '8474b34a-d231-4856-a45c-bd8b66287737',
  '312a5550-019c-45a6-ae40-9430ac04cf64',
  '25bbcb8a-b558-4ebc-bd5d-fe316ec51bcc'
]
const DORMINDO = [
  'efa75c4e-3fca-4efe-9be2-c521267ad832',
  'c9675b50-256c-4fa1-9d88-e45c2cf1e21a',
  'b303e930-2d82-49b8-b8fd-7360257f3d3b',
  '7590ab95-1527-4de6-8b6b-697e3bf14a2d',
  '0c98de6c-7ebe-4e1b-af33-b11394b03a86',
  '933fdc5f-a423-4d6f-8f61-798b0e8327e0'
]
const dados = path.join(base, 'orca-dados')
const pastaDaAba = (id) => (LIGADOS.includes(id) ? copia : path.join(base, 'abas', id))
const sessao = (ids) => {
  const tabsByWorktree = {}
  for (const id of ids) {
    mkdirSync(pastaDaAba(id), { recursive: true })
    tabsByWorktree[`repo::${pastaDaAba(id)}`] = [
      ...(tabsByWorktree[`repo::${pastaDaAba(id)}`] ?? []),
      { id, title: id.slice(0, 8) }
    ]
  }
  return JSON.stringify({ tabsByWorktree })
}
if (as14h28) {
  mkdirSync(path.join(dados, 'profiles', 'local-default'), { recursive: true })
  const db = new DatabaseSync(path.join(dados, 'profiles', 'local-default', 'profile-state.db'))
  db.exec('create table profile_state_documents (domain text, payload text)')
  db.prepare('insert into profile_state_documents values (?, ?)').run(
    'workspaceSession',
    sessao([...LIGADOS, ...DORMINDO])
  )
  db.close()
}
const mentira = path.join(base, 'orca.mjs')
writeFileSync(
  mentira,
  `const [g, v] = process.argv.slice(2);\n(await import('node:fs')).appendFileSync(${JSON.stringify(path.join(base, 'chamadas.log'))}, process.argv.slice(2).join(' ') + '\\n')\nconsole.log(JSON.stringify({ ok: true, result: g === 'terminal' && v === 'list' ? { terminals: ${JSON.stringify(as14h28 ? LIGADOS.map((tabId) => ({ tabId, handle: `term_${tabId}`, connected: true })) : [])} } : {} }))\n`
)
const cli = path.join(base, 'orca.cmd')
writeFileSync(cli, `@echo off\r\n"${process.execPath}" "${mentira}" %*\r\n`)
const ambiente = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([n]) => !/^(ORCA_|HIERARQUIA_)/u.test(n))
  ),
  HIERARQUIA_PROJETO: copia,
  HIERARQUIA_ORCA: cli,
  HIERARQUIA_ORCA_DADOS: as14h28 ? dados : path.join(process.env.APPDATA, 'orca-fork'),
  HIERARQUIA_INDICE: path.join(base, 'indice.json'),
  HIERARQUIA_LIBERACAO: path.join(base, 'liberacao.json')
}
const estado = (args) =>
  execFileSync(process.execPath, [HIERARQUIA, 'estado', ...args], {
    env: ambiente,
    cwd: copia,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    stdio: ['ignore', 'pipe', 'ignore']
  })

const com = estado([])
writeFileSync(path.join(saida, '1-estado-com-chats-esperando.txt'), com)
console.log('== COM chats esperando (topo do estado) ==')
console.log(com.split('\n').slice(0, 12).join('\n'))

if (process.argv.includes('--fechar-herdadas')) {
  const HERDADAS = ['o-036', 'o-037', 'o-001', 'o-014', 'o-015', 'o-018']
  const comoPo = {
    ...ambiente,
    ORCA_TAB_ID: LIGADOS[0],
    ORCA_TERMINAL_HANDLE: `term_${LIGADOS[0]}`
  }
  // Uma ordem por chamada: o comando aceita um --ordem por vez.
  const fechar = (script) =>
    HERDADAS.map((id) => {
      try {
        return execFileSync(process.execPath, [script, 'fechar', '--ordem', id], {
          env: comoPo,
          cwd: copia,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 180_000,
          stdio: ['ignore', 'pipe', 'pipe']
        }).trim()
      } catch (erro) {
        return `${id}: ERRO ${String(erro.stderr ?? erro.message).split('\n')[0]}`
      }
    }).join('\n')
  const velho = fechar(path.join(projetoReal, 'skills', 'hierarquia', 'hierarquia.mjs'))
  writeFileSync(path.join(saida, '3-fechar-herdadas-codigo-em-uso.txt'), velho)
  console.log(`\n== PO atual fecha as 6 herdadas, CODIGO EM USO ==\n${velho.trim()}`)
  const novo = fechar(HIERARQUIA)
  writeFileSync(path.join(saida, '4-fechar-herdadas-codigo-novo.txt'), novo)
  console.log(`\n== PO atual fecha as 6 herdadas, CODIGO NOVO ==\n${novo.trim()}`)
  const anotado = readFileSync(path.join(copia, '.hierarquia', 'registro.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('herdeiro'))
  writeFileSync(
    path.join(saida, '5-registro-chat-encerrado-pelo-herdeiro.jsonl'),
    `${anotado.join('\n')}\n`
  )
  console.log(`\n== registro: ${anotado.length} chat_encerrado pelo PO herdeiro ==`)
}
const json = JSON.parse(estado(['--json']))
const { entregues, orfaos } = json.esperandoFechar
const agora = new Date().toISOString()
for (const ordem of [...entregues, ...orfaos]) {
  appendFileSync(
    path.join(copia, '.hierarquia', 'registro.jsonl'),
    `${JSON.stringify({ t: agora, tipo: 'chat_encerrado', chatId: ordem.chatId, motivo: 'fechado pelo PO depois do OK do Kaique (so na copia)' })}\n`
  )
}
if (as14h28) {
  const fechados = new Set([...entregues, ...orfaos].map((ordem) => ordem.chatId))
  const db = new DatabaseSync(path.join(dados, 'profiles', 'local-default', 'profile-state.db'))
  db.prepare('update profile_state_documents set payload = ? where domain = ?').run(
    sessao([...LIGADOS, ...DORMINDO].filter((id) => !fechados.has(id))),
    'workspaceSession'
  )
  db.close()
}
const sem = estado([])
writeFileSync(path.join(saida, '2-estado-depois-de-fechar-esses-chats.txt'), sem)
console.log(
  `\n== SEM chats esperando (depois de fechar os ${entregues.length + orfaos.length} na copia) ==`
)
console.log(sem.split('\n').slice(0, 5).join('\n'))
