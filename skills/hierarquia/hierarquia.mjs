#!/usr/bin/env node
// Comando único da hierarquia PO > Planejador > Executor (spec 001).
// Aplica as regras de regras.mjs, escreve o registro do projeto e chama o lançador do Orca.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import {
  decidirConferencia,
  decidirEntrega,
  decidirOrdem,
  decidirPedidoDeOk,
  destinoDaPergunta,
  filaDoKaique,
  montarEstado,
  ordensLiberadasDaEspera
} from './regras.mjs'
import {
  avisarPo,
  citar,
  dormir,
  garantirExecucao,
  manterAberto,
  orca,
  semAcento
} from './orca-lancador.mjs'

const AQUI = import.meta.dirname
const ESPERA_DO_LANCAMENTO_MS = '180000'

function sair(mensagem, codigo = 1) {
  console.error(mensagem)
  process.exit(codigo)
}

function opcoes(argv) {
  const saida = { _: [], prova: [] }
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i]
    if (!item.startsWith('--')) {
      saida._.push(item)
    } else if (item === '--aprovar' || item === '--reprovar') {
      saida[item.slice(2)] = true
    } else if (item === '--prova') {
      saida.prova.push(argv[++i])
    } else {
      saida[item.slice(2)] = argv[++i]
    }
  }
  return saida
}

/** A pasta do projeto é a que tem `.hierarquia/`; cópias de trabalho do git apontam para a principal. */
function acharProjeto(explicito) {
  if (explicito) {
    return resolve(explicito)
  }
  if (process.env.HIERARQUIA_PROJETO) {
    return resolve(process.env.HIERARQUIA_PROJETO)
  }
  let pasta = process.cwd()
  for (;;) {
    if (existsSync(join(pasta, '.hierarquia'))) {
      return pasta
    }
    const acima = dirname(pasta)
    if (acima === pasta) {
      break
    }
    pasta = acima
  }
  try {
    const comum = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8'
    }).trim()
    const principal = dirname(comum)
    if (existsSync(join(principal, '.hierarquia'))) {
      return principal
    }
  } catch {
    // Pasta sem git: segue para o erro abaixo.
  }
  return null
}

function caminhos(projeto) {
  const base = join(projeto, '.hierarquia')
  return {
    base,
    registro: join(base, 'registro.jsonl'),
    ordens: join(base, 'ordens'),
    config: join(base, 'config.json')
  }
}

function lerEventos(projeto) {
  const { registro } = caminhos(projeto)
  if (!existsSync(registro)) {
    return []
  }
  return readFileSync(registro, 'utf8')
    .split('\n')
    .filter((linha) => linha.trim() !== '')
    .map((linha) => JSON.parse(linha))
}

function anotar(projeto, tipo, dados) {
  const evento = { t: new Date().toISOString(), tipo, ...dados }
  appendFileSync(caminhos(projeto).registro, `${JSON.stringify(evento)}\n`, 'utf8')
  gravarFoto(projeto)
  return evento
}

/** `estado.json`: a foto do momento que o fluxograma lê, sempre derivada do registro. */
function gravarFoto(projeto) {
  const estado = montarEstado(lerEventos(projeto))
  const ordens = Object.fromEntries(
    Object.values(estado.ordens).map((ordem) => [
      ordem.id,
      {
        id: ordem.id,
        de: ordem.de,
        papel: ordem.papel,
        chatId: ordem.chatId,
        situacao: ordem.situacao,
        reprovacoes: ordem.reprovacoes,
        titulo: ordem.campos.titulo ?? ordem.campos.objetivo
      }
    ])
  )
  const foto = {
    atualizadoEm: new Date().toISOString(),
    po: estado.po,
    chats: estado.chats,
    ordens,
    fila: filaDoKaique(estado)
  }
  writeFileSync(join(caminhos(projeto).base, 'estado.json'), JSON.stringify(foto, null, 2), 'utf8')
}

function lerConfig(projeto) {
  const { config } = caminhos(projeto)
  return existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')) : {}
}

function quemSou() {
  const chat = process.env.ORCA_TERMINAL_HANDLE
  if (!chat) {
    sair('Este comando precisa rodar dentro de um chat do Orca (ORCA_TERMINAL_HANDLE ausente).')
  }
  return chat
}

function textoDaOrdem(ordemId, papel, campos) {
  const criterios = campos.criterios.map((item, i) => `${i + 1}. ${item}`).join('\n')
  return [
    `# Ordem ${ordemId} (para ${papel})`,
    '',
    campos.titulo ? `**Título:** ${campos.titulo}\n` : '',
    `## Objetivo\n${campos.objetivo}\n`,
    `## Por quê\n${campos.porque}\n`,
    `## Critérios de aceite\n${criterios}\n`,
    `## Limites\n${campos.limites}\n`,
    `## Território\n${campos.territorio}\n`
  ].join('\n')
}

function pedidoParaOrca(projeto, ordemId, papel, campos) {
  const papelArquivo = join(AQUI, 'papeis', `${papel}.md`)
  const ordemArquivo = join(caminhos(projeto).ordens, `${ordemId}.md`)
  return semAcento(
    [
      `PAPEL: ${papel} na hierarquia de chats do projeto ${projeto}.`,
      `Antes de qualquer coisa leia o seu papel em ${papelArquivo} e a sua ordem em ${ordemArquivo}.`,
      `Target: ${campos.territorio}.`,
      'Change: cumprir o objetivo descrito no arquivo da ordem.',
      'Constraints: os limites escritos na ordem e as proibicoes do seu papel.',
      'Ownership: somente o territorio escrito na ordem.',
      `Observable acceptance: produza a prova pedida nos criterios, rode: hierarquia entregar --ordem ${ordemId} --prova CAMINHO_DA_PROVA (uma opcao --prova por arquivo), e so depois envie worker_done como manda o seu preambulo.`
    ].join(' ')
  )
}

function lancar(projeto, estado, ordem, modelo, fechar) {
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
  const pasta =
    lerConfig(projeto).pastaDosChats === 'projeto'
      ? citar(`path:${projeto.replaceAll('\\', '/')}`)
      : 'new-child'
  const resposta = orca([
    'orchestration',
    'worker-start',
    ...(souPo ? [] : ['--from', eu]),
    '--spec',
    citar(pedidoParaOrca(projeto, ordem.id, ordem.papel, ordem.campos)),
    '--task-title',
    citar(semAcento(`${ordem.papel}: ${ordem.campos.titulo ?? ordem.id}`).slice(0, 70)),
    '--worktree',
    pasta,
    '--agent',
    'claude',
    '--model',
    modelo,
    '--timeout-ms',
    ESPERA_DO_LANCAMENTO_MS
  ])
  const dados = resposta.result ?? {}
  const terminal = (dados.effects ?? []).find(
    (efeito) => efeito.kind === 'terminal' && efeito.role === 'agent'
  )
  if (!terminal) {
    sair(`O Orca não criou o chat. Resposta: ${JSON.stringify(resposta).slice(0, 600)}`)
  }
  const copia = (dados.effects ?? []).find((efeito) => efeito.kind === 'worktree')
  anotar(projeto, 'chat_lancado', {
    ordemId: ordem.id,
    chatId: terminal.id,
    pasta: String(copia?.id ?? '').split('::')[1] ?? projeto,
    modelo,
    dispatchId: dados.dispatchId,
    taskId: dados.taskId,
    situacaoDoLancamento: dados.state
  })
  manterAberto(dados.dispatchId)
  if (dados.state !== 'ready') {
    console.log(
      `ATENÇÃO: o Orca não confirmou que o chat recebeu a ordem (${dados.state}). ` +
        `Leia a tela dele antes de relançar: orca-dev orchestration worker-read --dispatch ${dados.dispatchId} --source terminal --json`
    )
  }
  return { chatId: terminal.id, dispatchId: dados.dispatchId }
}

const comandos = {
  'criar-po'(op) {
    const projeto = resolve(op.projeto ?? process.cwd())
    const { base, ordens, registro } = caminhos(projeto)
    mkdirSync(ordens, { recursive: true })
    const estado = montarEstado(lerEventos(projeto))
    const eu = quemSou()
    if (estado.po && estado.chats[estado.po].ativo && estado.po !== eu) {
      sair(`Este projeto já tem um PO (${estado.po}). Só existe um PO por projeto.`)
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
    anotar(projeto, 'po_criado', { chatId: eu })
    console.log(`PO registrado em ${base}. Leia PRODUTO.md e DECISOES.md antes de responder.`)
  },

  ordem(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    if (!op.para || !op.arquivo) {
      sair('Uso: hierarquia ordem --para planejador|executor --arquivo ordem.json')
    }
    const campos = JSON.parse(readFileSync(resolve(op.arquivo), 'utf8'))
    const eventos = lerEventos(projeto)
    const estado = montarEstado(eventos)
    const eu = quemSou()
    const decisao = decidirOrdem(estado, { de: eu, para: op.para, campos })
    if (decisao.acao === 'recusar') {
      sair(`Ordem recusada: ${decisao.motivo}`)
    }
    const ordemId = `o-${String(Object.keys(estado.ordens).length + 1).padStart(3, '0')}`
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
      emEspera: decisao.acao === 'esperar'
    })
    if (decisao.acao === 'esperar') {
      console.log(
        `Ordem ${ordemId} em espera: o teto de chats está cheio. Ela sai quando abrir vaga.`
      )
      return
    }
    const novo = montarEstado(lerEventos(projeto))
    const { chatId, dispatchId } = lancar(
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

  'lancar-espera'(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const eu = quemSou()
    let estado = montarEstado(lerEventos(projeto))
    const minhas = ordensLiberadasDaEspera(estado).filter((id) => estado.ordens[id].de === eu)
    for (const ordemId of minhas) {
      estado = montarEstado(lerEventos(projeto))
      const ordem = estado.ordens[ordemId]
      const decisao = decidirOrdem(estado, { de: eu, para: ordem.papel, campos: ordem.campos })
      if (decisao.acao !== 'criar') {
        continue
      }
      const { chatId } = lancar(projeto, estado, ordem, decisao.modelo, decisao.fechar)
      console.log(`Ordem ${ordemId} saiu da espera: chat ${chatId}.`)
    }
    if (minhas.length === 0) {
      console.log('Nenhuma ordem sua em espera cabe no teto agora.')
    }
  },

  entregar(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const eu = quemSou()
    // O chat pode terminar antes de o lançador anotar quem ele é: espera a anotação chegar.
    let estado = montarEstado(lerEventos(projeto))
    for (
      let i = 0;
      i < 60 && estado.ordens[op.ordem] && estado.ordens[op.ordem].chatId !== eu;
      i++
    ) {
      dormir(2000)
      estado = montarEstado(lerEventos(projeto))
    }
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

  conferir(op) {
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
    appendFileSync(
      join(caminhos(projeto).ordens, `${op.ordem}.md`),
      `
## Correção pedida (reprovação ${ordem.reprovacoes + 1})
${op.motivo}
`,
      'utf8'
    )
    const pasta = citar(`path:${(ordem.pasta || projeto).replaceAll('\\', '/')}`)
    try {
      const reenviar = () =>
        orca([
          'orchestration',
          'worker-start',
          ...(estado.chats[eu].papel === 'po' ? [] : ['--from', eu]),
          '--spec',
          citar(
            semAcento(
              `Sua entrega da ordem ${op.ordem} foi REPROVADA. Motivo: ${op.motivo}. Corrija so o que o motivo aponta, produza prova nova, rode hierarquia entregar --ordem ${op.ordem} --prova CAMINHO e depois envie worker_done.`
            )
          ),
          '--task-title',
          citar(`correcao ${op.ordem}`),
          '--terminal',
          ordem.chatId,
          '--worktree',
          pasta,
          '--timeout-ms',
          ESPERA_DO_LANCAMENTO_MS
        ])
      let resposta = reenviar()
      // Logo depois de entregar o chat ainda está fechando o turno e o Orca não o aceita: espera e repete.
      for (let i = 0; i < 6 && resposta.error?.code === 'agent_unconfigured'; i++) {
        dormir(15000)
        resposta = reenviar()
      }
      const dispatchId = resposta.result?.dispatchId
      if (!resposta.ok || !dispatchId) {
        throw new Error(JSON.stringify(resposta.error ?? resposta).slice(0, 400))
      }
      if (resposta.result.state !== 'ready') {
        console.log(
          `ATENÇÃO: o Orca não confirmou que o chat ${ordem.chatId} recebeu a correção (${resposta.result.state}). Leia a tela dele antes de reenviar.`
        )
      }
      anotar(projeto, 'chat_lancado', {
        ordemId: op.ordem,
        chatId: ordem.chatId,
        pasta: ordem.pasta,
        modelo: estado.chats[ordem.chatId].modelo,
        dispatchId
      })
      manterAberto(dispatchId)
    } catch (erro) {
      // O chat antigo não aceitou: a correção vai para um chat novo, com o motivo no arquivo da ordem.
      console.error(
        `Não consegui devolver ao mesmo chat: ${String(erro.stdout || erro.message).slice(0, 400)}`
      )
      const atual = montarEstado(lerEventos(projeto))
      const { chatId } = lancar(
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
  },

  perguntar(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const estado = montarEstado(lerEventos(projeto))
    const eu = quemSou()
    const para =
      destinoDaPergunta(estado, eu) ?? sair('Este chat está fora da hierarquia do projeto.')
    const perguntaId = `p-${String(Object.keys(estado.perguntas).length + 1).padStart(3, '0')}`
    anotar(projeto, 'pergunta', { perguntaId, de: eu, para, texto: op.texto })
    console.log(
      para === 'kaique'
        ? `Pergunta ${perguntaId} está na Fila do Kaique. Siga com as outras frentes enquanto ele não responde.`
        : `Pergunta ${perguntaId} registrada para ${para}. Envie-a agora com o comando "ask" do seu preâmbulo e espere a resposta.`
    )
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

  estado(op) {
    const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
    const estado = montarEstado(lerEventos(projeto))
    if (op.json) {
      console.log(JSON.stringify({ estado, fila: filaDoKaique(estado) }, null, 2))
      return
    }
    console.log(`Projeto: ${projeto}`)
    console.log(`PO: ${estado.po ?? '(nenhum)'}`)
    for (const ordem of Object.values(estado.ordens)) {
      const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
      const colunas = [
        `- ${ordem.id}`,
        `${ordem.papel}${chat ? ` (${chat.modelo})` : ''}`,
        ordem.situacao,
        `pedido por ${ordem.de}`,
        `chat ${ordem.chatId ?? '-'}${chat?.ativo === false ? ' (fechado)' : ''}`,
        ordem.campos.titulo ?? ordem.campos.objetivo.slice(0, 60),
        ordem.reprovacoes ? `reprovada ${ordem.reprovacoes}x` : '',
        chat?.mexidoPeloKaique ? 'mexido pelo Kaique' : ''
      ]
      console.log(colunas.filter(Boolean).join(' | '))
    }
    const fila = filaDoKaique(estado)
    console.log(`Fila do Kaique: ${fila.length}`)
    for (const item of fila) {
      console.log(
        `  * ${item.tipo} | ${item.ordemId ?? item.perguntaId} | ${item.resumo ?? item.texto ?? ''}`
      )
    }
  }
}

function decisaoDoKaique(op, tipo) {
  const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
  const estado = montarEstado(lerEventos(projeto))
  const chat = process.env.ORCA_TERMINAL_HANDLE
  if (chat && estado.chats[chat]) {
    sair('Só o Kaique dá OK ou devolve. Um chat da hierarquia não decide o próprio trabalho.')
  }
  if (estado.ordens[op.ordem]?.situacao !== 'esperando_kaique') {
    sair(`A ordem ${op.ordem} não está esperando o Kaique.`)
  }
  if (tipo !== 'ok' && String(op.motivo ?? '').trim() === '') {
    sair('Devolver exige o motivo: --motivo "..."')
  }
  anotar(projeto, tipo, { ordemId: op.ordem, ...(op.motivo ? { motivo: op.motivo } : {}) })
  avisarPo(
    estado.po,
    tipo === 'ok'
      ? `O Kaique deu OK na ordem ${op.ordem}. Rode hierarquia estado e siga: agora pode juntar ou publicar essa entrega.`
      : `O Kaique DEVOLVEU a ordem ${op.ordem}. Motivo: ${op.motivo}. Rode hierarquia estado e decida o proximo passo.`
  )
  console.log(
    tipo === 'ok'
      ? `OK do Kaique registrado para ${op.ordem}.`
      : `Ordem ${op.ordem} devolvida ao PO.`
  )
}

const [nome, ...resto] = process.argv.slice(2)
if (!comandos[nome]) {
  sair(`Uso: hierarquia <${Object.keys(comandos).join(' | ')}> [opções]`)
}
comandos[nome](opcoes(resto))
