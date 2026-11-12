// Conversa com o Orca: lançar chat, manter aberto e avisar. Usado pelo comando `hierarquia`.
import { execFile, execFileSync } from 'node:child_process'
import { acharTarefaNova, acharTerminalNovo, ondeEstaOTexto } from './regras.mjs'

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
    // O vigia roda solto, sem console: sem isto cada chamada abre uma janela de cmd na tela.
    windowsHide: true,
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
    encoding: 'utf8',
    windowsHide: true
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

/** A aba nasce como "worker-task_...": com o título da ordem, quem olha o fluxograma sabe o que ela é. */
export function renomearAba(handle, titulo) {
  return orcaEmSegundoPlano([
    'terminal',
    'rename',
    '--terminal',
    handle,
    '--title',
    citar(semAcento(titulo))
  ]).catch(() => null)
}

/**
 * Escreve uma linha no chat como se alguém digitasse e enviasse; se ela ficar parada na caixa de
 * texto, envia de novo uma vez. `%` sai porque o shell do Windows o trocaria.
 */
export async function escreverNoChat(handle, texto) {
  const linha = semAcento(texto).replace(/%/gu, ' por cento')
  const enviar = (conteudo) =>
    orcaEmSegundoPlano([
      'terminal',
      'send',
      '--terminal',
      handle,
      '--text',
      citar(conteudo),
      '--enter'
    ])
  const resposta = await enviar(linha)
  if (!resposta.ok) {
    return false
  }
  await esperar(4000)
  const tela = (
    await orcaEmSegundoPlano(['terminal', 'read', '--terminal', handle]).catch(() => null)
  )?.result?.terminal?.tail
  if (tela && ondeEstaOTexto(tela, linha.slice(0, 40)) === 'na_caixa') {
    await enviar(' ')
  }
  return true
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

const tarefasDoOrca = async () =>
  (await orcaEmSegundoPlano(['orchestration', 'task-list', '--brief'])).result?.tasks ?? []
const terminaisDoOrca = async () =>
  (await orcaEmSegundoPlano(['terminal', 'list'])).result?.terminals ?? []

/**
 * O chat novo existe no Orca antes de o worker ter terminal: a tarefa (com o título dado ao
 * worker-start) e o terminal de agente aparecem juntos. Uma chamada por rodada até achar a tarefa;
 * o terminal só é pedido depois dela. `visto` guarda a tarefa já achada entre as rodadas.
 */
async function chatDaOrdem(antes, titulo, visto) {
  // Com a tarefa já achada e o terminal ainda duvidoso, relê a tarefa só de vez em quando: o `assignee` resolve a dúvida.
  if (!visto.tarefa || (!visto.tarefa.assignee && visto.semTerminal % 2 === 0)) {
    const achada = acharTarefaNova(await tarefasDoOrca(), antes.tarefas, titulo)
    visto.tarefa = achada ?? visto.tarefa
  }
  if (!visto.tarefa) {
    return null
  }
  const terminal = acharTerminalNovo(
    await terminaisDoOrca(),
    antes.terminais,
    visto.tarefa.assignee
  )
  visto.semTerminal += terminal ? 0 : 1
  return terminal ? { terminal, tarefa: visto.tarefa } : null
}

/**
 * Roda o worker-start (que espera até 3 min o turno começar) e, enquanto ele espera, chama
 * `aoNascer` assim que a aba existe, para o registro nascer junto com ela. Depois disso chama
 * `aoEsperar` a cada poucos segundos até ele devolver true (ou o Orca responder).
 */
export async function lancarWorker(args, tituloDaTarefa, { aoNascer, aoEsperar }) {
  let antes = null
  try {
    const [tarefas, terminais] = await Promise.all([tarefasDoOrca(), terminaisDoOrca()])
    antes = {
      tarefas: new Set(tarefas.map((t) => t.id)),
      terminais: new Set(terminais.map((t) => t.handle))
    }
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
  const visto = { tarefa: null, semTerminal: 0 }
  while (antes && !respondeu && !parou) {
    try {
      if (!nascido) {
        const achado = await chatDaOrdem(antes, tituloDaTarefa, visto)
        if (achado && !respondeu) {
          const { terminal, tarefa } = achado
          nascido = {
            chatId: terminal.tabId,
            handle: terminal.handle,
            dispatchId: tarefa.dispatchId,
            taskId: tarefa.id,
            pasta: terminal.worktreePath ?? null
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
  const terminalReal = resposta.result?.terminal
  const certo = !nascido || !terminalReal || terminalReal === nascido.handle
  return { resposta, nascido: certo ? nascido : null, enganado: certo ? null : nascido }
}

/** O Orca desistiu de criar a pasta de trabalho porque o git passou do limite dele (máquina lenta). */
export function pastaDemorouDemais(resposta) {
  const dados = resposta.result ?? {}
  return (
    dados.failedStage === 'worktree_create' ||
    /Creating the worktree took longer/u.test(String(dados.lastError ?? resposta.error ?? ''))
  )
}

/** Solta no Orca o que um lançamento sem chat deixou pendente: o despacho vira abandonado e a tarefa, cancelada. */
export async function soltarLancamentoSemChat(resposta, de) {
  const { dispatchId, taskId } = resposta.result ?? {}
  const quem = de ? ['--from', de] : []
  if (dispatchId) {
    await orcaEmSegundoPlano(['orchestration', 'worker-abandon', '--dispatch', dispatchId]).catch(
      () => null
    )
  }
  if (taskId) {
    await orcaEmSegundoPlano([
      'orchestration',
      'task-update',
      '--id',
      taskId,
      '--status',
      'failed',
      '--result',
      'cancelled',
      ...quem
    ]).catch(() => null)
  }
  return (resposta.result?.residualResources ?? []).length
}

/**
 * Lança; se o Orca desistiu da pasta de trabalho, solta o que ficou pendente e lança mais uma vez
 * com mais tempo. Nada é gravado no registro entre as duas: quem chama grava só o resultado final.
 */
export async function lancarComNovaTentativa(lancarUmaVez, [primeiraMs, segundaMs], de) {
  const semChat = (saida) => !saida.nascido && !saida.resposta.result?.terminal
  let lancamento = await lancarUmaVez(primeiraMs)
  if (semChat(lancamento) && pastaDemorouDemais(lancamento.resposta)) {
    console.log(
      'A pasta de trabalho demorou mais de 3 min para nascer (maquina ocupada). Tentando de novo uma vez, com o dobro do tempo.'
    )
    await soltarLancamentoSemChat(lancamento.resposta, de)
    lancamento = await lancarUmaVez(segundaMs)
  }
  return lancamento
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
