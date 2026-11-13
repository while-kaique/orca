// A porta de reabrir o Orca: olha TODOS os chats da maquina (todos os projetos com hierarquia e os chats livres)
// e diz se fechar ou reabrir o programa corta alguem no meio. Usada por `hierarquia porta`, `hierarquia estado`,
// `hierarquia ordem`, pelo atalho de abrir o Orca e pelo X do Orca do fork.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { abasGuardadas, pastaDeDadosDoOrca } from './abas-do-orca.mjs'
import { orcaEmSegundoPlano } from './orca-lancador.mjs'
import { arquivoDoIndice, lerEventos } from './registro.mjs'
import { processoVivo } from './trava.mjs'
import { montarEstado } from './regras.mjs'
import {
  decidirPorta,
  liberacaoAberta,
  ordemOcupaVaga,
  ordensRecentes
} from './regras-da-porta.mjs'

const lerJson = (arquivo, padrao) => {
  try {
    return JSON.parse(readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

const temRegistro = (pasta) => existsSync(join(pasta, '.hierarquia', 'registro.jsonl'))

/** O projeto (pasta com `.hierarquia/registro.jsonl`) de uma pasta de chat: ela mesma, uma acima, ou a principal do git. */
function projetoDaPasta(pasta) {
  let atual = resolve(pasta)
  for (;;) {
    if (temRegistro(atual)) {
      return atual
    }
    const acima = dirname(atual)
    if (acima === atual) {
      break
    }
    atual = acima
  }
  try {
    const comum = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: pasta,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    return temRegistro(dirname(comum)) ? dirname(comum) : null
  } catch {
    return null
  }
}

/** Todos os projetos com hierarquia: os do indice e os das pastas que o Orca tem abertas. */
export function projetosDaMaquina(pastasDoOrca = []) {
  const achados = new Map()
  for (const pasta of [...lerJson(arquivoDoIndice(), []), ...pastasDoOrca]) {
    if (!pasta || !existsSync(pasta)) {
      continue
    }
    const projeto = projetoDaPasta(pasta)
    if (projeto) {
      achados.set(resolve(projeto).toLowerCase(), resolve(projeto))
    }
  }
  return [...achados.values()]
}

/** A liberacao de reabrir e da maquina: reabrir o Orca atinge todos os projetos. */
export function arquivoDaLiberacao() {
  return process.env.HIERARQUIA_LIBERACAO ?? join(homedir(), '.hierarquia-liberacao.json')
}

/** Quando o Orca em uso abriu (o arquivo que ele grava ao subir); null sem o Orca. */
export function orcaAbertoEm() {
  return lerJson(join(pastaDeDadosDoOrca(), 'orca-runtime.json'), null)?.startedAt ?? null
}

/**
 * Algum processo deste Orca ainda pode estar rodando chat: o programa (pelo arquivo que ele grava ao subir) ou o
 * guarda de terminais (pelo arquivo de pid dele). Fechado pelo X com o fork, os dois somem; numa queda, o guarda fica.
 */
export function orcaOuGuardaVivo(dados = pastaDeDadosDoOrca()) {
  const programa = lerJson(join(dados, 'orca-runtime.json'), null)?.pid
  if (programa && processoVivo(programa)) {
    return true
  }
  let arquivos = []
  try {
    arquivos = readdirSync(join(dados, 'daemon')).filter((nome) => nome.endsWith('.pid'))
  } catch {
    return false
  }
  return arquivos.some((nome) => {
    const pid = lerJson(join(dados, 'daemon', nome), null)?.pid
    return pid && processoVivo(pid)
  })
}

/**
 * Desde quando o guarda de terminais vivo deste Orca roda (o mais antigo): chat com sinal depois disso pode estar
 * vivo. Vale mais que a abertura do Orca porque o chat sobrevive a uma queda e o Orca reaberto se reconecta a ele
 * sem receber sinal novo (o-043: o X depois de uma queda fechava sem perguntar). null sem guarda vivo.
 */
export function guardaVivoDesde(dados = pastaDeDadosDoOrca()) {
  let arquivos = []
  try {
    arquivos = readdirSync(join(dados, 'daemon')).filter((nome) => nome.endsWith('.pid'))
  } catch {
    return null
  }
  const desde = arquivos
    .map((nome) => lerJson(join(dados, 'daemon', nome), null))
    .filter((guarda) => guarda?.pid && guarda.startedAtMs && processoVivo(guarda.pid))
    .map((guarda) => Number(guarda.startedAtMs))
  return desde.length > 0 ? Math.min(...desde) : null
}

/** A liberacao em aberto, ou null (vencida, cancelada, ou o Orca ja reabriu depois dela). */
export function liberacaoEmAberto(agora = Date.now()) {
  const liberacao = lerJson(arquivoDaLiberacao(), null)
  return liberacaoAberta(liberacao, agora, orcaAbertoEm()) ? liberacao : null
}

export function abrirLiberacao(dados) {
  writeFileSync(arquivoDaLiberacao(), JSON.stringify(dados, null, 2), 'utf8')
}

export function cancelarLiberacao() {
  rmSync(arquivoDaLiberacao(), { force: true })
}

const minutos = (ms) => Math.max(0, Math.round(ms / 60000))

/**
 * O estado de cada agente que o próprio Orca grava em disco (`agent-hooks/<app>/last-status.json`, o mesmo que pinta os
 * cards): Map(id da aba -> { trabalhando, segundoPlano, desde, visto }). Ler é instantâneo, sem chamar o Orca.
 */
export function estadosDosAgentes(dados = pastaDeDadosDoOrca()) {
  const porAba = new Map()
  let pastas = []
  try {
    pastas = readdirSync(join(dados, 'agent-hooks'))
  } catch {
    return porAba
  }
  for (const pasta of pastas) {
    const arquivo = lerJson(join(dados, 'agent-hooks', pasta, 'last-status.json'), null)
    for (const item of Object.values(arquivo?.entries ?? {})) {
      if (!item?.tabId) {
        continue
      }
      const atual = porAba.get(item.tabId)
      const trabalhando = item.payload?.state === 'working'
      const visto = item.receivedAt ?? 0
      const novo = {
        trabalhando: trabalhando || Boolean(atual?.trabalhando && atual.visto >= visto),
        segundoPlano: item.claudeRunningNonAgentTask ? 1 : 0,
        desde: trabalhando ? (item.turnStartedAt ?? item.stateStartedAt ?? null) : null,
        visto: Math.max(visto, atual?.visto ?? 0),
        transcript: item.providerSession?.transcriptPath ?? atual?.transcript ?? null
      }
      if (!atual || visto >= atual.visto) {
        porAba.set(item.tabId, novo)
      }
    }
  }
  return porAba
}

/**
 * Olha a maquina inteira. Devolve { pode, resumo, chats, recentes, liberacao, semOrca }.
 * `chats`: cada chat trabalhando, com projeto, papel, ordem, titulo, desde quando e comandos em segundo plano.
 * `rapido` (o X do Orca): não chama o Orca; aba viva = aba guardada que deu sinal depois de o Orca abrir.
 */
// HIERARQUIA_TESTE_AVANCAR_MS só existe para o teste ver a ordem deixar de ser "recém-lançada" sem esperar 10 min.
export async function olharPorta({
  agora = Date.now() + (Number(process.env.HIERARQUIA_TESTE_AVANCAR_MS) || 0),
  rapido = false
} = {}) {
  let terminais = null
  if (!rapido) {
    try {
      terminais = (await orcaEmSegundoPlano(['terminal', 'list'])).result?.terminals ?? []
    } catch {
      terminais = null
    }
  }
  const abas = await abasGuardadas()
  const agentes = estadosDosAgentes()
  const abertoEm = guardaVivoDesde() ?? orcaAbertoEm() ?? 0
  const ligados = (terminais ?? []).filter((t) => t.connected !== false)
  // Sem o Orca e sem o guarda de terminais, nenhum chat dele pode estar rodando.
  const algumVivo = terminais !== null || orcaOuGuardaVivo()
  const viva = (tabId, handle) =>
    terminais
      ? ligados.some((t) => t.tabId === tabId || (handle && t.handle === handle))
      : algumVivo && Boolean(abas?.has(tabId)) && (agentes.get(tabId)?.visto ?? 0) >= abertoEm
  const pastas = [
    ...(terminais ?? []).map((t) => t.worktreePath),
    ...[...(abas?.values() ?? [])].map((aba) => aba.pasta)
  ]
  const projetos = projetosDaMaquina(pastas).map((projeto) => ({
    projeto,
    estado: montarEstado(lerEventos(projeto))
  }))
  const chats = []
  const vistos = new Set()
  for (const { projeto, estado } of projetos) {
    for (const ordem of Object.values(estado.ordens)) {
      const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
      if (!chat?.ativo || !ordemOcupaVaga(ordem) || !viva(chat.id, chat.handle)) {
        continue
      }
      vistos.add(chat.id)
      chats.push({
        projeto,
        chatId: chat.id,
        papel: ordem.teste ? 'teste' : ordem.papel,
        ordemId: ordem.id,
        titulo: ordem.campos.titulo ?? ordem.campos.objetivo.slice(0, 60),
        desde: ordem.iniciouEm ?? ordem.lancadoEm,
        segundoPlano: agentes.get(chat.id)?.segundoPlano ?? 0,
        livre: false
      })
    }
  }
  const papelDoChat = (tabId) => {
    for (const { projeto, estado } of projetos) {
      const chat = estado.chats[tabId]
      if (chat?.ativo) {
        return { projeto, papel: chat.papel }
      }
    }
    return null
  }
  // Fora das ordens: PO, chats livres e de projeto sem hierarquia. Vale o estado que o Orca mostra no card.
  for (const [tabId, agente] of agentes) {
    if (vistos.has(tabId) || (!agente.trabalhando && !agente.segundoPlano) || !viva(tabId)) {
      continue
    }
    const terminal = ligados.find((t) => t.tabId === tabId)
    const dono = papelDoChat(tabId)
    chats.push({
      projeto: dono?.projeto ?? terminal?.worktreePath ?? abas?.get(tabId)?.pasta ?? null,
      chatId: tabId,
      papel: dono?.papel ?? 'livre',
      ordemId: null,
      titulo: terminal?.title ?? abas?.get(tabId)?.titulo ?? tabId,
      desde: agente.desde ? new Date(agente.desde).toISOString() : null,
      segundoPlano: agente.segundoPlano,
      livre: !dono
    })
  }
  const recentes = projetos.flatMap(({ projeto, estado }) =>
    ordensRecentes(estado, agora).map((ordem) => ({
      projeto,
      ordemId: ordem.id,
      titulo: ordem.campos.titulo ?? ordem.id,
      ha: minutos(agora - Date.parse(ordem.lancadoEm ?? ordem.criadaEm))
    }))
  )
  const decisao = decidirPorta({ trabalhando: chats, recentes })
  return {
    ...decisao,
    chats,
    recentes,
    projetos: projetos.map((p) => p.projeto),
    liberacao: liberacaoEmAberto(agora),
    semOrca: !rapido && terminais === null
  }
}

const nomeDoProjeto = (pasta) =>
  String(pasta ?? '')
    .split(/[\\/]/u)
    .findLast(Boolean)

/** O texto da porta em portugues simples: primeira linha pode/nao pode, depois quem, em que e desde quando. */
export function textoDaPorta(porta, agora = Date.now()) {
  const linhas = [`Pode reabrir o Orca: ${porta.resumo}`]
  if (porta.semOrca) {
    linhas.push('(Orca fechado ou sem resposta: so o registro foi lido)')
  }
  for (const chat of porta.chats) {
    const desde = chat.desde
      ? ` desde ${new Date(chat.desde).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${minutos(agora - Date.parse(chat.desde))} min)`
      : ''
    const fundo = chat.segundoPlano ? `, ${chat.segundoPlano} comando(s) em segundo plano` : ''
    const quem = chat.livre ? 'chat livre (fora da hierarquia)' : chat.papel
    linhas.push(
      `- ${nomeDoProjeto(chat.projeto)}: ${quem}${chat.ordemId ? ` da ${chat.ordemId}` : ''} "${String(chat.titulo ?? '').slice(0, 70)}"${desde}${fundo}`
    )
  }
  for (const ordem of porta.recentes) {
    linhas.push(
      `- ${nomeDoProjeto(ordem.projeto)}: ${ordem.ordemId} lancada ha ${ordem.ha} min ("${String(ordem.titulo).slice(0, 60)}"): o chat ainda pode estar nascendo`
    )
  }
  if (porta.liberacao) {
    linhas.push(
      `Liberacao de reabrir em aberto desde ${porta.liberacao.desde} (${porta.liberacao.por})`
    )
  }
  return linhas.join('\n')
}
