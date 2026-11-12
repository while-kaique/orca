#!/usr/bin/env node
// Comando único da hierarquia PO > Planejador > Executor (spec 001).
// Aplica as regras de regras.mjs, escreve o registro do projeto e chama o lançador do Orca.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { isAbsolute, join, resolve } from 'node:path'
import {
  decidirConferencia,
  decidirEntrega,
  decidirOrdem,
  decidirPedidoDeOk,
  destinoDaPergunta,
  montarEstado,
  ordensLiberadasDaEspera,
  pedidoDaOrdemNova
} from './regras.mjs'
import {
  abaDoChat,
  branchDoProjeto,
  citar,
  dormir,
  enviarCorrecao,
  escreverNoChat,
  garantirExecucao,
  lancarWorker,
  manterAberto,
  orca
} from './orca-lancador.mjs'
import {
  pedidoDaCorrecao,
  pedidoParaOrca,
  textoDaOrdem,
  tituloDaTarefa,
  trechoDoPedido
} from './pedido-da-ordem.mjs'
import { criarVigia } from './inicio-do-turno.mjs'
import { opcoes } from './opcoes-da-linha.mjs'
import { comandoEstado } from './estado-na-tela.mjs'
import { fecharChats, ordensParaFechar } from './fechar-chats.mjs'
import { foraDoGit } from './pasta-fora-do-git.mjs'
import { decisaoDoKaique } from './decisao-do-kaique.mjs'
import { destravarInicios } from './destravar-inicio.mjs'
import { acharProjeto, anotar, caminhos, lerConfig, lerEventos, sair } from './registro.mjs'
import { pegarTrava } from './trava.mjs'
import { rodarNaVez } from './vez.mjs'
import { garantirVigia, vigiar } from './vigia-do-criador.mjs'

const AQUI = import.meta.dirname
const ESPERA_DO_LANCAMENTO_MS = '180000'

/** O chat é a aba: ela continua a mesma quando o Orca reabre; o terminal ganha outro identificador. */
function quemSou() {
  const chat = process.env.ORCA_TAB_ID
  if (!chat || !process.env.ORCA_TERMINAL_HANDLE) {
    sair('Este comando precisa rodar dentro de um chat do Orca (ORCA_TAB_ID ausente).')
  }
  return chat
}

function meuTerminal() {
  return process.env.ORCA_TERMINAL_HANDLE
}

/** Depois de um reinício do Orca, o chat conhecido anota o terminal novo na primeira vez que roda o comando. */
function reconectar(op) {
  const eu = process.env.ORCA_TAB_ID
  const projeto = eu && meuTerminal() ? acharProjeto(op.projeto) : null
  if (!projeto || !existsSync(caminhos(projeto).registro)) {
    return
  }
  const conhecido = montarEstado(lerEventos(projeto)).chats[eu]
  if (conhecido && conhecido.handle !== meuTerminal()) {
    anotar(projeto, 'chat_reconectado', { chatId: eu, handle: meuTerminal() })
  }
}

async function lancar(projeto, estado, ordem, modelo, fechar) {
  const eu = quemSou()
  if (fechar) {
    const antigo = Object.values(estado.ordens).find((item) => item.chatId === fechar)
    if (antigo?.dispatchId) {
      orca(['orchestration', 'worker-release', '--dispatch', antigo.dispatchId])
    }
    anotar(projeto, 'chat_encerrado', { chatId: fechar, motivo: 'deu lugar a outro chat' })
  }
  const souPo = estado.chats[eu].papel === 'po'
  if (souPo) {
    garantirExecucao()
  }
  // 'current' seria a pasta de quem lança; o chat tem que nascer na pasta do projeto.
  // Ordem leve pode nascer na pasta de quem criou: sem cópia nova, sem instalar dependências.
  const pastaFixa =
    ordem.pastaDoCriador ?? (lerConfig(projeto).pastaDosChats === 'projeto' ? projeto : null)
  const pasta = pastaFixa ? citar(`path:${pastaFixa.replaceAll('\\', '/')}`) : 'new-child'
  const pedido = pedidoParaOrca(projeto, ordem.id, ordem.papel, ordem.campos)
  const titulo = tituloDaTarefa(ordem)
  const args = [
    'orchestration',
    'worker-start',
    ...(souPo ? [] : ['--from', meuTerminal()]),
    '--spec',
    citar(pedido),
    '--task-title',
    citar(titulo),
    '--worktree',
    pasta,
    ...(pasta === 'new-child' ? ['--base-branch', citar(branchDoProjeto(projeto))] : []),
    '--agent',
    'claude',
    '--model',
    modelo,
    '--timeout-ms',
    ESPERA_DO_LANCAMENTO_MS
  ]
  const registrar = (chat, situacao) =>
    anotar(projeto, 'chat_lancado', {
      ordemId: ordem.id,
      ...chat,
      pasta: chat.pasta ?? projeto,
      modelo,
      situacaoDoLancamento: situacao
    })
  // O registro nasce junto com a aba: o fluxograma só sabe o papel e o criador depois dele.
  const vigia = criarVigia(trechoDoPedido(pedido))
  let abaVigiada = null
  const anotarInicio = (tipo, dados) =>
    anotar(projeto, tipo, { ordemId: ordem.id, chatId: abaVigiada, ...dados })
  const { resposta, nascido, enganado } = await lancarWorker(args, titulo, {
    aoNascer: (chat) => {
      abaVigiada = chat.chatId
      registrar(chat, 'esperando_o_orca')
      vigia.ligar(chat.dispatchId, chat.handle)
    },
    aoEsperar: () => vigia.vigiar(anotarInicio)
  })
  if (enganado) {
    anotar(projeto, 'chat_encerrado', { chatId: enganado.chatId, motivo: 'aba reconhecida errada' })
  }
  const dados = resposta.result ?? {}
  const handle = dados.terminal
  if (!handle) {
    const motivo = `O Orca não criou o chat. Resposta: ${JSON.stringify(resposta).slice(0, 600)}`
    anotar(projeto, 'lancamento_falhou', { ordemId: ordem.id, chatId: nascido?.chatId, motivo })
    sair(motivo)
  }
  const pastaDoChat = String(dados.workspace ?? '').split('::')[1] ?? projeto
  const chatId = nascido?.chatId ?? (await abaDoChat(dados.dispatchId, handle)) ?? handle
  if (nascido) {
    anotar(projeto, 'lancamento_respondeu', {
      ordemId: ordem.id,
      pasta: pastaDoChat,
      situacaoDoLancamento: dados.state
    })
  } else {
    const { dispatchId, taskId } = dados
    registrar({ chatId, handle, pasta: pastaDoChat, dispatchId, taskId }, dados.state)
  }
  manterAberto(dados.dispatchId)
  if (dados.state !== 'ready') {
    abaVigiada = chatId
    vigia.ligar(dados.dispatchId, handle)
    console.log(await vigia.fechar(anotarInicio))
  }
  return { chatId, dispatchId: dados.dispatchId }
}

const comandos = {
  'criar-po'(op) {
    const projeto = resolve(op.projeto ?? process.cwd())
    const eu = quemSou()
    const ondeJaEsta = acharProjeto()
    if (!op.teste && ondeJaEsta && resolve(ondeJaEsta) !== projeto) {
      const papel = montarEstado(lerEventos(ondeJaEsta)).chats[eu]
      if (papel?.ativo) {
        sair(
          `Este chat já é ${papel.papel} em ${ondeJaEsta}. Virar PO de outro registro só para teste, com --teste: os chats criados lá aparecem como "Livre" no fluxograma.`
        )
      }
    }
    const { base, ordens, registro } = caminhos(projeto)
    mkdirSync(ordens, { recursive: true })
    foraDoGit(projeto)
    const estado = montarEstado(lerEventos(projeto))
    if (estado.po && estado.po !== eu) {
      sair(`Já há um PO aberto neste projeto (${String(estado.po)}); feche a aba dele antes.`)
    }
    for (const [nome, inicial] of [
      [
        'PRODUTO.md',
        '# Produto\n\n(vazio: o PO entrevista o Kaique antes de criar qualquer chat)\n'
      ],
      ['DECISOES.md', '# Decisões\n']
    ]) {
      if (!existsSync(join(base, nome))) {
        writeFileSync(join(base, nome), inicial, 'utf8')
      }
    }
    if (!existsSync(registro)) {
      writeFileSync(registro, '', 'utf8')
    }
    anotar(projeto, 'po_criado', { chatId: eu, handle: meuTerminal() })
    console.log(
      `PO registrado em ${base}. Leia o seu papel em ${join(AQUI, 'papeis', 'po.md')}, depois PRODUTO.md e DECISOES.md, antes de responder.`
    )
  },

  async ordem(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    if (!op.para || !op.arquivo) {
      sair(
        'Uso: hierarquia ordem --para planejador|executor --arquivo ordem.json [--pedido NOME] [--na-frente]'
      )
    }
    const campos = JSON.parse(readFileSync(resolve(op.arquivo), 'utf8'))
    const eu = quemSou()
    // Dois lançamentos juntos: o número da ordem e a vaga do teto se decidem um de cada vez.
    const soltar = pegarTrava(join(caminhos(projeto).base, 'trava-ordem'))
    let ordemId
    let decisao
    try {
      const estado = montarEstado(lerEventos(projeto))
      decisao = decidirOrdem(estado, { de: eu, para: op.para, campos })
      if (decisao.acao === 'recusar') {
        sair(`Ordem recusada: ${decisao.motivo}`)
      }
      ordemId = `o-${String(Object.keys(estado.ordens).length + 1).padStart(3, '0')}`
      writeFileSync(
        join(caminhos(projeto).ordens, `${ordemId}.md`),
        textoDaOrdem(ordemId, op.para, campos),
        'utf8'
      )
      anotar(projeto, 'ordem_criada', {
        ordemId,
        de: eu,
        para: op.para,
        campos,
        pedido: pedidoDaOrdemNova(estado, eu, op.pedido ?? campos.pedido) ?? ordemId,
        prioridade: Boolean(op['na-frente']),
        ...(op['na-pasta-do-criador'] ? { pastaDoCriador: pastaDoGit(process.cwd()) } : {}),
        emEspera: decisao.acao === 'esperar'
      })
    } finally {
      soltar()
    }
    garantirVigia(caminhos(projeto).base, eu, import.meta.filename, projeto)
    if (decisao.acao === 'esperar') {
      console.log(
        `Ordem ${ordemId} em espera: o teto está cheio. Ela sai sozinha quando abrir vaga${op['na-frente'] ? ', na frente das outras' : ''}.`
      )
      return
    }
    const novo = montarEstado(lerEventos(projeto))
    const { chatId, dispatchId } = await lancar(
      projeto,
      novo,
      novo.ordens[ordemId],
      decisao.modelo,
      decisao.fechar
    )
    console.log(
      `Ordem ${ordemId} lançada: ${op.para} (${decisao.modelo}), chat ${chatId}, dispatch ${dispatchId}.`
    )
  },

  async 'lancar-espera'(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const saidas = await lancarDaEspera(projeto, quemSou(), console.log)
    if (saidas === 0) {
      console.log('Nenhuma ordem sua em espera cabe no teto agora.')
    }
  },

  /** Processo de fundo ligado por `ordem`: segura o correio do criador e o acorda uma vez por pedido. */
  async vigiar(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const eu = quemSou()
    await vigiar({
      base: caminhos(projeto).base,
      eu,
      lerEstado: () => montarEstado(lerEventos(projeto)),
      anotar: (tipo, dados) => anotar(projeto, tipo, dados),
      lancarDaEspera: (log) => lancarDaEspera(projeto, eu, log),
      destravar: (log) => destravarInicios(projeto, eu, log)
    })
  },

  baixa(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const estado = montarEstado(lerEventos(projeto))
    const eu = quemSou()
    const ordem = estado.ordens[op.ordem]
    if (!ordem || ordem.de !== eu) {
      sair('Só quem criou a ordem dá baixa nela. Uso: hierarquia baixa --ordem ID --motivo "..."')
    }
    if (!['trabalhando', 'em_prova', 'devolvido', 'em_espera'].includes(ordem.situacao)) {
      sair(`A ordem ${op.ordem} já terminou (${ordem.situacao}).`)
    }
    if (String(op.motivo ?? '').trim() === '') {
      sair('Baixa exige o motivo: --motivo "..."')
    }
    anotar(projeto, 'parou_sem_entregar', { ordemId: op.ordem, por: eu, motivo: op.motivo })
    console.log(`Ordem ${op.ordem} parada. A vaga dela está livre.`)
  },

  async responder(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const estado = montarEstado(lerEventos(projeto))
    const eu = quemSou()
    const pergunta = estado.perguntas[op.pergunta]
    if (!pergunta || pergunta.para !== eu) {
      sair(
        'Só quem recebeu a pergunta responde. Uso: hierarquia responder --pergunta p-NNN --texto "..."'
      )
    }
    if (String(op.texto ?? '').trim() === '') {
      sair('Falta a resposta: --texto "..."')
    }
    anotar(projeto, 'resposta', { perguntaId: op.pergunta, por: eu, texto: op.texto })
    const chegou = await escreverNoChat(
      estado.chats[pergunta.de]?.handle,
      `RESPOSTA ${op.pergunta} de quem criou voce: ${op.texto}`
    )
    console.log(
      chegou
        ? `Resposta ${op.pergunta} escrita no chat que perguntou.`
        : `Resposta ${op.pergunta} registrada, mas o chat que perguntou não recebeu: ele está fechado?`
    )
  },

  entregar(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const eu = quemSou()
    const estado = esperarMeuRegistro(projeto, eu)
    const provas = op.prova.map((caminho) => {
      const completo = isAbsolute(caminho) ? caminho : resolve(caminho)
      return { caminho: completo, existe: existsSync(completo) }
    })
    const decisao = decidirEntrega(estado, { ordemId: op.ordem, por: eu, provas })
    if (decisao.acao === 'recusar') {
      if (decisao.semProva) {
        anotar(projeto, 'entrega_recusada', { ordemId: op.ordem, motivo: decisao.motivo })
      }
      sair(`Entrega recusada: ${decisao.motivo}`)
    }
    anotar(projeto, 'entrega', {
      ordemId: op.ordem,
      portao: decisao.portao,
      provas: provas.map((prova) => prova.caminho),
      resumo: op.resumo ?? ''
    })
    console.log(
      `Entrega registrada no portão do ${decisao.portao}. Agora envie o worker_done do seu preâmbulo e espere.`
    )
  },

  async conferir(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const estado = montarEstado(lerEventos(projeto))
    const eu = quemSou()
    if (!op.aprovar && !op.reprovar) {
      sair('Uso: hierarquia conferir --ordem ID (--aprovar | --reprovar --motivo "...")')
    }
    const decisao = decidirConferencia(estado, {
      ordemId: op.ordem,
      por: eu,
      aprovar: Boolean(op.aprovar),
      motivo: op.motivo
    })
    if (decisao.acao === 'recusar') {
      sair(`Conferência recusada: ${decisao.motivo}`)
    }
    const ordem = estado.ordens[op.ordem]
    if (decisao.acao === 'aprovar') {
      anotar(projeto, 'conferencia', { ordemId: op.ordem, por: eu, aprovada: true })
      manterAberto(ordem.dispatchId)
      console.log(`Ordem ${op.ordem} aprovada. O chat ${ordem.chatId} continua aberto.`)
      return
    }
    anotar(projeto, 'conferencia', {
      ordemId: op.ordem,
      por: eu,
      aprovada: false,
      motivo: op.motivo,
      ...(decisao.acao === 'subir' ? { subiuPara: decisao.para } : {})
    })
    if (decisao.acao === 'subir') {
      console.log(
        `Segunda reprovação: o caso subiu para ${decisao.para}. Não mande tentar de novo; quem recebeu decide.`
      )
      return
    }
    garantirVigia(caminhos(projeto).base, eu, import.meta.filename, projeto)
    appendFileSync(
      join(caminhos(projeto).ordens, `${op.ordem}.md`),
      `
## Correção pedida (reprovação ${ordem.reprovacoes + 1})
${op.motivo}
`,
      'utf8'
    )
    const pasta = citar(`path:${(ordem.pasta || projeto).replaceAll('\\', '/')}`)
    const pedido = pedidoDaCorrecao(op.ordem, op.motivo)
    const handleDoChat = estado.chats[ordem.chatId].handle
    let devolvida
    try {
      devolvida = enviarCorrecao({
        de: estado.chats[eu].papel === 'po' ? null : meuTerminal(),
        handle: handleDoChat,
        pasta,
        ordemId: op.ordem,
        pedido,
        timeoutMs: ESPERA_DO_LANCAMENTO_MS
      })
      anotar(projeto, 'chat_lancado', {
        ordemId: op.ordem,
        chatId: ordem.chatId,
        handle: handleDoChat,
        pasta: ordem.pasta,
        modelo: estado.chats[ordem.chatId].modelo,
        dispatchId: devolvida.dispatchId,
        situacaoDoLancamento: devolvida.state
      })
      manterAberto(devolvida.dispatchId)
    } catch (erro) {
      // O chat antigo não aceitou: a correção vai para um chat novo, com o motivo no arquivo da ordem.
      console.error(
        `Não consegui devolver ao mesmo chat: ${String(erro.stdout || erro.message).slice(0, 400)}`
      )
      const atual = montarEstado(lerEventos(projeto))
      const { chatId } = await lancar(
        projeto,
        atual,
        atual.ordens[op.ordem],
        estado.chats[ordem.chatId].modelo,
        null
      )
      console.log(`A correção foi para o chat novo ${chatId}; o antigo continua aberto.`)
      return
    }
    console.log(`Ordem ${op.ordem} devolvida ao chat ${ordem.chatId} com o motivo.`)
    if (devolvida.state !== 'ready') {
      const vigia = criarVigia(trechoDoPedido(pedido))
      vigia.ligar(devolvida.dispatchId, handleDoChat)
      console.log(
        await vigia.fechar((tipo, dados) =>
          anotar(projeto, tipo, { ordemId: op.ordem, chatId: ordem.chatId, ...dados })
        )
      )
    }
  },

  async perguntar(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const eu = quemSou()
    const soltar = pegarTrava(join(caminhos(projeto).base, 'trava-ordem'))
    let estado
    let para
    let perguntaId
    esperarMeuRegistro(projeto, eu)
    try {
      estado = montarEstado(lerEventos(projeto))
      para = destinoDaPergunta(estado, eu) ?? sair('Este chat está fora da hierarquia do projeto.')
      perguntaId = `p-${String(Object.keys(estado.perguntas).length + 1).padStart(3, '0')}`
      anotar(projeto, 'pergunta', { perguntaId, de: eu, para, texto: op.texto })
    } finally {
      soltar()
    }
    if (para === 'kaique') {
      console.log(
        `Pergunta ${perguntaId} está na Fila do Kaique. Siga com as outras frentes enquanto ele não responde.`
      )
      return
    }
    const ordemId = estado.chats[eu]?.ordemId
    const chegou = await escreverNoChat(
      estado.chats[para]?.handle,
      `PERGUNTA ${perguntaId} da ordem ${ordemId}: ${op.texto} -- Responda com: hierarquia responder --pergunta ${perguntaId} --texto "..."`
    )
    console.log(
      chegou
        ? `Pergunta ${perguntaId} escrita no chat de quem criou você. Não use o "ask" do preâmbulo: termine o turno e espere, a resposta chega escrita aqui.`
        : `Pergunta ${perguntaId} registrada, mas o chat de quem criou você não recebeu. Envie-a com o "ask" do seu preâmbulo.`
    )
  },

  /** `hierarquia vez -- <comando>`: um comando pesado por vez na máquina inteira. */
  async vez(op) {
    if (op.comando.trim() === '') {
      sair('Uso: hierarquia vez -- <comando pesado>')
    }
    process.exitCode = await rodarNaVez(op.comando)
  },

  'pedir-ok'(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const estado = montarEstado(lerEventos(projeto))
    const decisao = decidirPedidoDeOk(estado, { ordemId: op.ordem, por: quemSou() })
    if (decisao.acao === 'recusar') {
      sair(`Pedido recusado: ${decisao.motivo}`)
    }
    anotar(projeto, 'pedido_ok', { ordemId: op.ordem, resumo: op.resumo ?? '' })
    console.log(
      `Ordem ${op.ordem} está na Fila do Kaique. Nada é juntado nem publicado antes do OK dele.`
    )
  },

  /** Decisão do Kaique. Chat da hierarquia não pode dar OK no próprio trabalho. */
  ok(op) {
    decisaoDoKaique(op, 'ok')
  },
  devolver(op) {
    decisaoDoKaique(op, 'devolvido_pelo_kaique')
  },

  /** O Orca roda isto quando a aba do chat fecha: PO fechado deixa o projeto sem PO. */
  encerrar(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const estado = montarEstado(lerEventos(projeto))
    const autor = process.env.ORCA_TAB_ID
    if (autor && estado.chats[autor]) {
      sair(
        'Um chat da hierarquia não encerra chat por aqui: quem encerra é o Orca, ao fechar a aba.'
      )
    }
    if (!estado.chats[op.chat]?.ativo) {
      sair(`O chat ${op.chat ?? '(faltou --chat)'} não está aberto na hierarquia deste projeto.`, 0)
    }
    anotar(projeto, 'chat_encerrado', { chatId: op.chat, motivo: op.motivo ?? 'aba fechada' })
    console.log(`Chat ${op.chat} encerrado.`)
  },

  async estado(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    await comandoEstado(projeto, op)
  },

  /** Quem criou fecha o chat de uma ordem sua (ligado ou dormindo), ou todos os seus que terminaram. */
  async fechar(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    if (!op.ordem && !op.terminados && !op.pedido) {
      sair('Uso: hierarquia fechar --ordem ID | --terminados | --pedido NOME')
    }
    const estado = montarEstado(lerEventos(projeto))
    const eu = quemSou()
    const ids = ordensParaFechar(estado, eu, op)
    const linhas = await fecharChats({
      projeto,
      estado,
      eu,
      ids,
      anotar: (tipo, dados) => anotar(projeto, tipo, dados)
    })
    console.log(linhas.length > 0 ? linhas.join('\n') : 'Nenhum chat seu para fechar.')
  }
}

/** O chat pode começar a trabalhar antes de o lançador anotar quem ele é: espera a anotação, até 2 min. */
function esperarMeuRegistro(projeto, eu) {
  let estado = montarEstado(lerEventos(projeto))
  for (let i = 0; i < 60 && !estado.chats[eu]; i++) {
    dormir(2000)
    estado = montarEstado(lerEventos(projeto))
  }
  return estado
}

function pastaDoGit(pasta) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: pasta,
    encoding: 'utf8',
    windowsHide: true
  }).trim()
}

/** Ordens do chat que estão em espera e já cabem no teto. Marca a saída antes de lançar, para dois vigias não pegarem a mesma vaga. */
async function lancarDaEspera(projeto, eu, log) {
  let saidas = 0
  for (;;) {
    const soltar = pegarTrava(join(caminhos(projeto).base, 'trava-ordem'))
    let ordem
    let decisao
    try {
      const estado = montarEstado(lerEventos(projeto))
      const proxima = ordensLiberadasDaEspera(estado)[0]
      ordem = proxima && estado.ordens[proxima].de === eu ? estado.ordens[proxima] : null
      decisao = ordem && decidirOrdem(estado, { de: eu, para: ordem.papel, campos: ordem.campos })
      if (decisao?.acao === 'criar') {
        anotar(projeto, 'saiu_da_espera', { ordemId: ordem.id })
      }
    } finally {
      soltar()
    }
    if (decisao?.acao !== 'criar') {
      return saidas
    }
    const atual = montarEstado(lerEventos(projeto))
    const { chatId } = await lancar(
      projeto,
      atual,
      atual.ordens[ordem.id],
      decisao.modelo,
      decisao.fechar
    )
    log(`Ordem ${ordem.id} saiu da espera: chat ${chatId}.`)
    saidas += 1
  }
}

const [nome, ...argumentos] = process.argv.slice(2)
if (!comandos[nome]) {
  sair(`Uso: hierarquia <${Object.keys(comandos).join(' | ')}> [opções]`)
}
const separador = argumentos.indexOf('--')
const resto = separador === -1 ? argumentos : argumentos.slice(0, separador)
const op = opcoes(resto)
// O comando volta a ser uma linha de shell: argumento com espaço ou símbolo vai entre aspas.
op.comando =
  separador === -1
    ? ''
    : argumentos
        .slice(separador + 1)
        .map((arg) => (/[\s"&|<>^()]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg))
        .join(' ')
if (nome !== 'criar-po' && nome !== 'vez') {
  reconectar(op)
}
await comandos[nome](op)
