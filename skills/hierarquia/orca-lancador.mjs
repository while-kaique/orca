// Conversa com o Orca: lançar chat, manter aberto e avisar. Usado pelo comando `hierarquia`.
import { execFile, execFileSync } from 'node:child_process'
import { acharWorkerNovo } from './regras.mjs'

/** O texto que vai para o Orca precisa ser ASCII puro: acento vira lixo na ordem. */
export function semAcento(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^\x20-\x7e]/gu, ' ')
    .replace(/"/gu, "'")
}

function opcoesDoProcesso() {
  return {
    encoding: 'utf8',
    // No Windows o comando é um .cmd, que só abre pelo shell.
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024
  }
}

function lerResposta(saida) {
  const util = String(saida)
    .split('\n')
    .filter((linha) => !linha.includes('_keepalive'))
    .join('\n')
  return JSON.parse(util.slice(util.indexOf('{')))
}

export function orca(args) {
  const comando = process.env.HIERARQUIA_ORCA ?? 'orca-dev'
  let saida
  try {
    saida = execFileSync(comando, [...args, '--json'], opcoesDoProcesso())
  } catch (erro) {
    // O Orca sai com código 1 também quando só não confirmou o início do turno: a resposta vem igual.
    if (!String(erro.stdout ?? '').includes('{')) {
      throw erro
    }
    saida = String(erro.stdout)
  }
  return lerResposta(saida)
}

export function orcaEmSegundoPlano(args) {
  const comando = process.env.HIERARQUIA_ORCA ?? 'orca-dev'
  return new Promise((resolver, rejeitar) => {
    execFile(comando, [...args, '--json'], opcoesDoProcesso(), (erro, saida) => {
      if (erro && !String(saida ?? '').includes('{')) {
        rejeitar(erro)
        return
      }
      try {
        resolver(lerResposta(saida))
      } catch (falha) {
        rejeitar(falha)
      }
    })
  })
}

export function dormir(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function citar(texto) {
  return process.platform === 'win32' ? `"${texto}"` : texto
}

/** A branch em que o projeto está: é dela que a cópia de um chat novo tem que nascer. */
export function branchDoProjeto(projeto) {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: projeto,
    encoding: 'utf8'
  }).trim()
}

export function garantirExecucao() {
  // O Orca novo devolve runId direto; o antigo devolvia run.id.
  const idDe = (resposta) => resposta.result?.runId ?? resposta.result?.run?.id
  const atual = idDe(orca(['orchestration', 'run-current']))
  if (atual) {
    return atual
  }
  const nova = orca([
    'orchestration',
    'run-create',
    '--objective',
    citar('Hierarquia de chats do projeto')
  ])
  return idDe(nova)
}

/** FR-21: o Orca fecha o terminal de quem já entregou; a retenção é o que o mantém aberto. */
export function manterAberto(dispatchId) {
  try {
    orca(['orchestration', 'worker-retain', '--dispatch', dispatchId])
    return true
  } catch {
    return false
  }
}

/** O PO não fica olhando o registro: a decisão chega a ele como mensagem do Orca. */
export function avisarPo(po, texto) {
  if (!po) {
    return
  }
  try {
    orca([
      'orchestration',
      'send',
      '--to',
      po,
      '--subject',
      citar('Decisao do Kaique'),
      '--body',
      citar(semAcento(texto))
    ])
  } catch {
    // Sem o aviso, o PO ainda vê a decisão no próximo `hierarquia estado`.
  }
}

/** A aba em que o Orca abriu o chat recém-lançado; cada chamada ao Orca demora, então uma só quando basta. */
export async function abaDoChat(dispatchId, handle) {
  try {
    const aba = (await orcaEmSegundoPlano(['terminal', 'show', '--terminal', handle])).result
      ?.terminal?.tabId
    if (aba) {
      return aba
    }
    const visto = (
      await orcaEmSegundoPlano(['orchestration', 'worker-show', '--dispatch', dispatchId])
    ).result
    const painel = visto?.terminal?.recordedPaneKey ?? visto?.dispatch?.assigneePaneKey
    return painel ? String(painel).split(':')[0] : null
  } catch {
    return null
  }
}

export const esperar = (ms) => new Promise((pronto) => setTimeout(pronto, ms))

async function workersRecentes() {
  const lista = await orcaEmSegundoPlano(['orchestration', 'worker-list', '--limit', '10'])
  return lista.result?.workers ?? []
}

/**
 * O worker novo é o que não existia antes e cuja tarefa tem o título dado ao worker-start.
 * As três consultas saem juntas: cada chamada ao Orca demora, então a aba já vem na mesma rodada.
 */
async function workerDaOrdem(antes, titulo) {
  const [workers, tarefas, terminais] = await Promise.all([
    workersRecentes(),
    orcaEmSegundoPlano(['orchestration', 'task-list', '--brief']),
    orcaEmSegundoPlano(['terminal', 'list']).catch(() => null)
  ])
  const worker = acharWorkerNovo(workers, tarefas.result?.tasks ?? [], antes, titulo)
  if (!worker) {
    return null
  }
  const doTerminal = (terminais?.result?.terminals ?? []).find((t) => t.handle === worker.terminal)
  const chatId = doTerminal?.tabId ?? (await abaDoChat(worker.dispatchId, worker.terminal))
  return chatId ? { ...worker, chatId } : null
}

/**
 * Roda o worker-start (que espera até 3 min o turno começar) e, enquanto ele espera, chama
 * `aoNascer` assim que o chat existe, para o registro nascer junto com a aba. Depois disso chama
 * `aoEsperar` a cada poucos segundos até ele devolver true (ou o Orca responder).
 */
export async function lancarWorker(args, tituloDaTarefa, { aoNascer, aoEsperar }) {
  let antes = null
  try {
    antes = new Set((await workersRecentes()).map((w) => w.dispatchId))
  } catch {
    // Sem a lista não dá para reconhecer o chat cedo: o registro sai quando o Orca responder.
  }
  let respondeu = false
  const lancamento = orcaEmSegundoPlano(args)
  lancamento.then(
    () => (respondeu = true),
    () => (respondeu = true)
  )
  let nascido = null
  let parou = false
  while (antes && !respondeu && !parou) {
    try {
      if (!nascido) {
        const worker = await workerDaOrdem(antes, tituloDaTarefa)
        if (worker && !respondeu) {
          nascido = {
            chatId: worker.chatId,
            handle: worker.terminal,
            dispatchId: worker.dispatchId,
            taskId: worker.taskId,
            pasta: String(worker.workspace ?? '').split('::')[1] ?? null
          }
          aoNascer(nascido)
        }
      } else {
        parou = await aoEsperar()
      }
    } catch {
      // Tenta de novo no próximo ciclo; se nunca achar, o registro sai quando o Orca responder.
    }
    await esperar(nascido ? 2500 : 300)
  }
  const resposta = await lancamento.catch((erro) => ({
    erro: String(erro.message ?? erro).slice(0, 300)
  }))
  return { resposta, nascido }
}

/** Devolve a correção ao chat que já existe (`--terminal`); o Orca recusa enquanto ele ainda fecha o turno anterior. */
export function enviarCorrecao({ de, handle, pasta, ordemId, pedido, timeoutMs }) {
  const reenviar = () =>
    orca([
      'orchestration',
      'worker-start',
      ...(de ? ['--from', de] : []),
      '--spec',
      citar(pedido),
      '--task-title',
      citar(`correcao ${ordemId}`),
      '--terminal',
      handle,
      '--worktree',
      pasta,
      '--timeout-ms',
      timeoutMs
    ])
  let resposta = reenviar()
  for (let i = 0; i < 6 && resposta.error?.code === 'agent_unconfigured'; i++) {
    dormir(15000)
    resposta = reenviar()
  }
  if (!resposta.ok || !resposta.result?.dispatchId) {
    throw new Error(JSON.stringify(resposta.error ?? resposta).slice(0, 400))
  }
  return resposta.result
}
