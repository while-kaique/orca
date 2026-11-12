// O vigia do criador: dorme no lugar do chat que criou ordens e só o acorda uma vez por pedido
// (itens A, B e G da o-021). Um processo de fundo por chat criador.
import { execFile, execFileSync, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { escreverNoChat, esperar, orcaEmSegundoPlano } from './orca-lancador.mjs'
import { chatsSemVida, mensagemDoPedido, pedidosDoCriador, pedidosParaAvisar } from './regras.mjs'
import { criarSeNaoExiste, lerJson, processoVivo } from './trava.mjs'

/** Chat sem nada na tela por mais que isso, sem pergunta aberta nem filha trabalhando, conta como parado. */
export const PRAZO_SEM_ATIVIDADE_MS = 20 * 60 * 1000
const PASSO_MS = 5000
const VIDA_MS = 30000
const ESPERA_DO_CORREIO_MS = '60000'

function arquivos(base, chatId) {
  const pasta = join(base, 'vigias')
  mkdirSync(pasta, { recursive: true })
  mkdirSync(join(base, 'caixa'), { recursive: true })
  const nome = String(chatId).replace(/[^\w-]/gu, '_')
  return {
    pid: join(pasta, `${nome}.json`),
    log: join(pasta, `${nome}.log`),
    caixa: join(base, 'caixa', `${nome}.jsonl`)
  }
}

/** Liga o vigia do chat, se ainda não há um vivo. Ele sobrevive ao fim do comando que o ligou. */
export function garantirVigia(base, chatId, script, projeto) {
  const atual = lerJson(arquivos(base, chatId).pid)
  if (atual && processoVivo(atual.pid)) {
    return atual.pid
  }
  const filho = spawn(process.execPath, [script, 'vigiar', '--projeto', projeto], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: process.env
  })
  filho.unref()
  return filho.pid
}

/** Marca como parada a ordem cujo chat morreu (B). Devolve as marcadas. */
export function marcarChatsMortos(estado, terminais, anotar) {
  const mortos = chatsSemVida(estado, terminais, Date.now(), PRAZO_SEM_ATIVIDADE_MS)
  for (const morto of mortos) {
    anotar('parou_sem_entregar', { ...morto, automatico: true })
  }
  return mortos
}

function matarArvore(processo) {
  if (!processo?.pid) {
    return
  }
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(processo.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      })
    } else {
      processo.kill()
    }
  } catch {
    // Já tinha saído.
  }
}

/**
 * Enquanto o vigia vive, um `check --wait` fica parado na caixa do criador: com alguém esperando, o
 * Orca não escreve "You have N messages" no chat dele. O que chega fica na caixa do vigia.
 */
function segurarCaixa(caixa, aoChegar, aoErrar) {
  let processo = null
  let parado = false
  const comando = process.env.HIERARQUIA_ORCA ?? 'orca-dev'
  const rodada = () => {
    if (parado) {
      return
    }
    processo = execFile(
      comando,
      [
        'orchestration',
        'check',
        ...caixa,
        '--wait',
        '--timeout-ms',
        ESPERA_DO_CORREIO_MS,
        '--json'
      ],
      {
        encoding: 'utf8',
        shell: process.platform === 'win32',
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024
      },
      (erro, saida) => {
        try {
          const util = String(saida ?? '')
            .split('\n')
            .filter((linha) => !linha.includes('_keepalive'))
            .join('\n')
          const resposta = JSON.parse(util.slice(util.indexOf('{')))
          for (const mensagem of resposta.result?.messages ?? []) {
            aoChegar(mensagem)
          }
        } catch {
          aoErrar(String(erro?.message ?? saida ?? '').slice(0, 300))
        }
        setTimeout(rodada, erro ? 3000 : 0)
      }
    )
  }
  rodada()
  return () => {
    parado = true
    matarArvore(processo)
  }
}

function veioDeFilho(estado, eu, mensagem) {
  const filhas = Object.values(estado.ordens).filter((ordem) => ordem.de === eu)
  return filhas.some(
    (ordem) =>
      mensagem.from === ordem.dispatchId || mensagem.from === estado.chats[ordem.chatId]?.handle
  )
}

/** Avisos que o Orca escreve sozinho quando um chat filho para: o vigia cuida deles (chat morto, aviso por pedido). */
const AVISOS_AUTOMATICOS = [
  'Worker stopped',
  'Worker exited',
  'Worker is waiting on a prompt',
  'Agent exited',
  'Setup '
]

/** Fica com o vigia: entrega, sinal de vida e aviso automático de um filho. O resto acorda o criador. */
function precisaDoCriador(estado, eu, mensagem) {
  if (!veioDeFilho(estado, eu, mensagem)) {
    return mensagem.type !== 'heartbeat'
  }
  if (['worker_done', 'heartbeat', 'status'].includes(mensagem.type)) {
    return false
  }
  return !AVISOS_AUTOMATICOS.some((inicio) => String(mensagem.subject ?? '').startsWith(inicio))
}

/**
 * O laço do vigia. `deps`: lerEstado(), anotar(tipo, dados), lancarDaEspera() e o chat dono (`eu`).
 * Termina quando todo pedido do criador fechou e virou mensagem, ou quando a aba dele some.
 */
export async function vigiar({ base, eu, lerEstado, anotar, lancarDaEspera, destravar }) {
  const meus = arquivos(base, eu)
  const dados = { pid: process.pid, chatId: eu, desde: new Date().toISOString() }
  for (;;) {
    if (criarSeNaoExiste(meus.pid, dados)) {
      break
    }
    const outro = lerJson(meus.pid)
    if (outro && processoVivo(outro.pid)) {
      return
    }
    rmSync(meus.pid, { force: true })
  }
  const log = (texto) => appendFileSync(meus.log, `${new Date().toISOString()} ${texto}\n`, 'utf8')
  const handle = () => lerEstado().chats[eu]?.handle ?? process.env.ORCA_TERMINAL_HANDLE
  const vistas = new Set()
  const aoChegar = (mensagem) => {
    if (vistas.has(mensagem.id)) {
      return
    }
    vistas.add(mensagem.id)
    appendFileSync(
      meus.caixa,
      `${JSON.stringify(mensagem)}
`,
      'utf8'
    )
    if (precisaDoCriador(lerEstado(), eu, mensagem)) {
      log(`repassa ${mensagem.id} de ${mensagem.from}`)
      void escreverNoChat(
        handle(),
        `Mensagem de ${mensagem.from} (${mensagem.type}): ${mensagem.subject}. ${mensagem.body ?? ''}`.slice(
          0,
          700
        )
      )
    }
  }
  // Duas caixas: a do chat (o que o criador dele manda) e a da Run que ele coordena (o que os filhos mandam).
  const run = (await orcaEmSegundoPlano(['orchestration', 'run-current']).catch(() => null))?.result
    ?.runId
  const soltadores = [[], ...(run ? [['--run', run]] : [])].map((caixa) =>
    segurarCaixa(caixa, aoChegar, (erro) => log(`caixa ${caixa.join(' ')}: ${erro}`))
  )
  const soltar = () => soltadores.forEach((soltarUma) => soltarUma())
  const jaFechados = new Map(
    pedidosDoCriador(lerEstado(), eu)
      .filter((grupo) => grupo.terminado)
      .map((grupo) => [grupo.pedido, grupo.assinatura])
  )
  log(`vigia ligado (caixas: chat${run ? ` e ${run}` : ''})`)
  let conferidoEm = 0
  try {
    for (;;) {
      if (Date.now() - conferidoEm > VIDA_MS) {
        conferidoEm = Date.now()
        const terminais = (await orcaEmSegundoPlano(['terminal', 'list'])).result?.terminals ?? []
        if (terminais.length > 0 && !terminais.some((t) => t.tabId === eu)) {
          log('a aba do criador sumiu: vigia desligado')
          return
        }
        for (const morto of marcarChatsMortos(lerEstado(), terminais, anotar)) {
          log(`parada automatica ${morto.ordemId}: ${morto.motivo}`)
        }
      }
      await lancarDaEspera(log)
      await destravar(log)
      const estado = lerEstado()
      for (const grupo of pedidosParaAvisar(estado, eu)) {
        if (jaFechados.get(grupo.pedido) === grupo.assinatura) {
          continue
        }
        await escreverNoChat(handle(), mensagemDoPedido(grupo))
        anotar('pedido_fechado', {
          chatId: eu,
          pedido: grupo.pedido,
          assinatura: grupo.assinatura,
          ordens: grupo.diretas.map((ordem) => ({ id: ordem.id, situacao: ordem.situacao }))
        })
        log(`pedido fechado: ${grupo.pedido}`)
      }
      if (pedidosDoCriador(lerEstado(), eu).every((grupo) => grupo.terminado)) {
        log('todos os pedidos fecharam: vigia desligado')
        return
      }
      await esperar(PASSO_MS)
    }
  } catch (erro) {
    log(`erro: ${String(erro?.stack ?? erro).slice(0, 600)}`)
  } finally {
    soltar()
    if (lerJson(meus.pid)?.pid === process.pid) {
      rmSync(meus.pid, { force: true })
    }
  }
}
