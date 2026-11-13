// O vigia do criador: dorme no lugar do chat que criou ordens e só o acorda uma vez por pedido
// (itens A, B e G da o-021). Um processo de fundo por chat criador.
import { execFile, execFileSync, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { avisarChat, entregarGuardados, guardadosDoChat } from './avisos-guardados.mjs'
import { esperar, orcaEmSegundoPlano } from './orca-lancador.mjs'
import { abasGuardadas } from './abas-do-orca.mjs'
import { retomarUmCortado } from './volta-dos-cortados.mjs'
import { ordensComComandoPreso, TEXTO_DO_COMANDO_PRESO } from './comando-preso.mjs'
import { estadosDosAgentes } from './porta-do-orca.mjs'
import {
  chatsSemVida,
  criadorSemAba,
  mensagemDoPedido,
  pedidosDoCriador,
  pedidosParaAvisar,
  vidaDoChat
} from './regras.mjs'
import { criarSeNaoExiste, lerJson, processoVivo } from './trava.mjs'

const PASSO_MS = 5000
const SEM_ORCA_MAX_MS = 2 * 60 * 60 * 1000
const SOBRA_DEPOIS_DO_ULTIMO_MS = 3 * 60 * 1000
const VIDA_MS = 30000
const ESPERA_DO_CORREIO_MS = '120000'

function arquivos(base, chatId) {
  const pasta = join(base, 'vigias')
  mkdirSync(pasta, { recursive: true })
  mkdirSync(join(base, 'caixa'), { recursive: true })
  const nome = String(chatId).replace(/[^\w-]/gu, '_')
  return {
    pid: join(pasta, `${nome}.json`),
    heranca: join(pasta, `${nome}.heranca.json`),
    log: join(pasta, `${nome}.log`),
    caixa: join(base, 'caixa', `${nome}.jsonl`)
  }
}

/** O retrato do código da hierarquia: muda quando qualquer .mjs da pasta muda (depois de uma junção). */
export function assinaturaDoCodigo(pasta) {
  try {
    return readdirSync(pasta)
      .filter((nome) => nome.endsWith('.mjs'))
      .sort()
      .map((nome) => {
        const info = statSync(join(pasta, nome))
        return `${nome}:${info.size}:${Math.round(info.mtimeMs)}`
      })
      .join('|')
  } catch {
    return null
  }
}

/** Liga o vigia do chat, se ainda não há um vivo. Ele sobrevive ao fim do comando que o ligou. */
export function garantirVigia(base, chatId, script, projeto, handle) {
  const atual = lerJson(arquivos(base, chatId).pid)
  if (atual && processoVivo(atual.pid)) {
    return atual.pid
  }
  return ligarVigia(script, projeto, chatId, handle)
}

/** O vigia sabe de quem e pelo `--chat`: ele tambem nasce do Orca (a volta depois de reabrir), fora de um chat. */
function ligarVigia(script, projeto, chatId, handle) {
  const env = { ...process.env, ORCA_TAB_ID: chatId }
  if (handle) {
    env.ORCA_TERMINAL_HANDLE = handle
  }
  const filho = spawn(
    process.execPath,
    [script, 'vigiar', '--projeto', projeto, '--chat', chatId],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env
    }
  )
  filho.unref()
  return filho.pid
}

/** Desde quando cada ordem aparece sem vida: vale por processo, então só o vigia (que vive) chega a marcar. */
let semVidaDesde = new Map()

/**
 * Chat sem terminal ha mais de 2 min (B): se a aba dele ainda existe (voltou dormindo depois de o Orca fechar ou
 * cair), ele foi CORTADO e a volta cuida dele; se a aba sumiu, a ordem parou. `abas` null: sem a sessao do Orca,
 * vale o comportamento antigo (parada). Devolve as ordens marcadas.
 */
export function marcarChatsMortos(estado, terminais, anotar, abas = null) {
  const visto = chatsSemVida(estado, terminais, Date.now(), semVidaDesde)
  semVidaDesde = visto.semVidaDesde
  const marcados = []
  for (const morto of visto.mortos) {
    const chat = estado.chats[estado.ordens[morto.ordemId]?.chatId]
    if (abas?.has(chat?.id)) {
      if (!chat.cortadoEm || chat.retomadoEm) {
        anotar('chat_cortado', {
          ordemId: morto.ordemId,
          chatId: chat.id,
          motivo:
            'o chat ficou sem terminal com a ordem trabalhando (Orca fechado, reaberto ou caiu)'
        })
        marcados.push({ ...morto, cortado: true })
      }
      continue
    }
    anotar('parou_sem_entregar', { ...morto, automatico: true })
    marcados.push(morto)
  }
  return marcados
}

/** A tela de cada chat na conferencia anterior, sem digitos (o relogio do Claude muda sozinho). */
let telaAnterior = new Map()

/**
 * Comando preso (complemento da o-043): chat das ordens de `eu` com um comando de shell aberto ha 15 min, nada novo
 * no transcript e a tela igual a da conferencia anterior. Avisa `eu` uma vez por comando; nao mexe na ordem nem no chat.
 */
async function avisarComandosPresos(
  projeto,
  eu,
  estado,
  terminais,
  abas,
  anotar,
  handleDoCriador,
  log
) {
  const minhas = Object.values(estado.ordens).filter((o) => o.de === eu && estado.chats[o.chatId])
  const vidas = new Map(
    minhas.map((o) => [o.chatId, vidaDoChat(estado.chats[o.chatId], terminais, abas)])
  )
  const presos = ordensComComandoPreso(
    { ordens: Object.fromEntries(minhas.map((o) => [o.id, o])) },
    vidas,
    estadosDosAgentes()
  )
  const telas = new Map()
  for (const [ordemId, preso] of presos) {
    const ordem = estado.ordens[ordemId]
    if (ordem.comandoPreso?.ferramentaId === preso.ferramentaId) {
      continue
    }
    const handle =
      terminais.find((t) => t.tabId === ordem.chatId && t.connected !== false)?.handle ??
      estado.chats[ordem.chatId].handle
    const tela = await orcaEmSegundoPlano(['terminal', 'read', '--terminal', handle])
      .then((r) => (r.result?.terminal?.tail ?? []).join('\n').replace(/\d+/gu, '#'))
      .catch(() => null)
    telas.set(ordem.chatId, tela)
    if (tela === null || telaAnterior.get(ordem.chatId) !== tela) {
      continue
    }
    anotar('comando_preso', {
      ordemId,
      chatId: ordem.chatId,
      ferramentaId: preso.ferramentaId,
      desde: preso.desde,
      comando: preso.comando
    })
    const chegou = await avisarChat(
      projeto,
      eu,
      handleDoCriador,
      TEXTO_DO_COMANDO_PRESO(ordemId, preso)
    )
    log(`comando preso ${ordemId}: ${preso.minutos} min sem nada novo (${chegou})`)
  }
  telaAnterior = telas
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
 * Orca não escreve "You have N messages" no chat dele. São duas esperas defasadas (pistas): cada
 * `check` leva até dezenas de segundos para nascer nesta máquina, e com uma só a caixa ficava sem
 * ninguém nesse intervalo, e o aviso do Orca escapava para o chat (sobra da o-021). O que chega fica
 * na caixa do vigia; mensagem repetida entre as pistas é descartada por quem recebe.
 */
function segurarCaixa(caixa, aoChegar, aoErrar) {
  const processos = [null, null]
  let parado = false
  const comando = process.env.HIERARQUIA_ORCA ?? 'orca-dev'
  const rodada = (pista) => {
    if (parado) {
      return
    }
    processos[pista] = execFile(
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
        setTimeout(() => rodada(pista), erro ? 3000 : 0)
      }
    )
  }
  rodada(0)
  const segunda = setTimeout(() => rodada(1), Number(ESPERA_DO_CORREIO_MS) / 2)
  return () => {
    parado = true
    clearTimeout(segunda)
    processos.forEach(matarArvore)
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
export async function vigiar({
  base,
  projeto,
  script,
  eu,
  lerEstado,
  anotar,
  lancarDaEspera,
  destravar
}) {
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
  // O vigia anterior (código velho) passou o que já tinha visto: nada se perde nem chega duas vezes.
  const herdado = lerJson(meus.heranca)
  rmSync(meus.heranca, { force: true })
  const vistas = new Set(herdado?.vistas ?? [])
  const codigo = assinaturaDoCodigo(dirname(script ?? ''))
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
      void avisarChat(
        projeto,
        eu,
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
    herdado?.jaFechados ??
      pedidosDoCriador(lerEstado(), eu)
        .filter((grupo) => grupo.terminado)
        .map((grupo) => [grupo.pedido, grupo.assinatura])
  )
  log(
    `vigia ligado (caixas: chat${run ? ` e ${run}` : ''})${herdado ? `, herdou ${vistas.size} mensagens vistas do vigia ${herdado.pid}` : ''}`
  )
  let trocado = false
  let semOrcaDesde = null
  let conferidoEm = 0
  let tudoFechadoEm = null
  try {
    for (;;) {
      if (Date.now() - conferidoEm > VIDA_MS) {
        conferidoEm = Date.now()
        const lista = await orcaEmSegundoPlano(['terminal', 'list']).catch(() => null)
        if (!lista?.result) {
          // Orca fechado ou reabrindo: o vigia espera por ele (ate 2 h) em vez de morrer e perder avisos.
          semOrcaDesde ??= Date.now()
          if (Date.now() - semOrcaDesde > SEM_ORCA_MAX_MS) {
            log('o Orca ficou fechado por 2 h: vigia desligado')
            return
          }
          await esperar(PASSO_MS)
          continue
        }
        if (semOrcaDesde) {
          log(`o Orca voltou depois de ${Math.round((Date.now() - semOrcaDesde) / 1000)} s`)
          semOrcaDesde = null
        }
        const terminais = lista.result.terminals ?? []
        const abas = await abasGuardadas()
        // Aba dormindo (Orca reaberto) ainda e o criador: so sai quando a aba some de verdade.
        if (
          criadorSemAba(terminais, eu, [handle(), process.env.ORCA_TERMINAL_HANDLE]) &&
          !abas?.has(eu)
        ) {
          log('a aba do criador sumiu: vigia desligado')
          return
        }
        for (const morto of marcarChatsMortos(lerEstado(), terminais, anotar, abas)) {
          log(
            `${morto.cortado ? 'chat cortado' : 'parada automatica'} ${morto.ordemId}: ${morto.motivo}`
          )
        }
        await avisarComandosPresos(projeto, eu, lerEstado(), terminais, abas, anotar, handle(), log)
        await retomarUmCortado(projeto, eu, log)
        const filhos = Object.values(lerEstado().ordens)
          .filter((ordem) => ordem.de === eu && ordem.chatId)
          .map((ordem) => ordem.chatId)
        await entregarGuardados(projeto, [eu, ...filhos], log)
        // Código da hierarquia mudou (junção): passa o que já viu a um vigia novo e sai.
        if (script && codigo && assinaturaDoCodigo(dirname(script)) !== codigo) {
          writeFileSync(
            meus.heranca,
            JSON.stringify({ pid: process.pid, vistas: [...vistas], jaFechados: [...jaFechados] }),
            'utf8'
          )
          soltar()
          rmSync(meus.pid, { force: true })
          trocado = true
          const novo = ligarVigia(script, projeto, eu, handle())
          log(`o codigo da hierarquia mudou: vigia novo ${novo} no lugar deste`)
          return
        }
      }
      await lancarDaEspera(log)
      await destravar(log)
      const estado = lerEstado()
      for (const grupo of pedidosParaAvisar(estado, eu)) {
        if (jaFechados.get(grupo.pedido) === grupo.assinatura) {
          continue
        }
        anotar('pedido_fechado', {
          chatId: eu,
          pedido: grupo.pedido,
          assinatura: grupo.assinatura,
          ordens: grupo.diretas.map((ordem) => ({ id: ordem.id, situacao: ordem.situacao }))
        })
        const chegou = await avisarChat(projeto, eu, handle(), mensagemDoPedido(grupo))
        log(`pedido fechado: ${grupo.pedido} (${chegou})`)
      }
      // O worker_done do último filho chega depois da entrega: a caixa fica segura mais um pouco.
      const comGuardado = guardadosDoChat(lerEstado(), eu).length > 0
      if (!comGuardado && pedidosDoCriador(lerEstado(), eu).every((grupo) => grupo.terminado)) {
        tudoFechadoEm ??= Date.now()
        if (Date.now() - tudoFechadoEm > SOBRA_DEPOIS_DO_ULTIMO_MS) {
          log('todos os pedidos fecharam: vigia desligado')
          return
        }
      } else {
        tudoFechadoEm = null
      }
      await esperar(PASSO_MS)
    }
  } catch (erro) {
    log(`erro: ${String(erro?.stack ?? erro).slice(0, 600)}`)
  } finally {
    if (!trocado) {
      soltar()
    }
    if (lerJson(meus.pid)?.pid === process.pid) {
      rmSync(meus.pid, { force: true })
    }
  }
}
