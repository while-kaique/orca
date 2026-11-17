// Regras do início do turno de um chat lançado: onde está a ordem na tela, quando reenviar o Enter, quem destravar.
// Puro: sem disco, sem rede, sem Orca.

const MARCA_DE_COLAGEM = '[Pasted text'
export const LINHA_DE_SEPARACAO = /^[─━-]{10,}$/u

function emUmaLinha(linhas) {
  return linhas.join(' ').replace(/\s+/gu, ' ')
}

/**
 * A tarefa nova é a que não existia antes e tem o título dado ao worker-start. O `task-list` já a mostra,
 * com `dispatchId`, enquanto o worker ainda está `starting` (sem terminal no `worker-list`).
 */
export function acharTarefaNova(tarefas, antes, titulo) {
  return tarefas.find((t) => t.title === titulo && t.dispatchId && !antes.has(t.id)) ?? null
}

/**
 * O terminal do chat novo: o `assignee` da tarefa, quando já existe; antes disso, o único terminal
 * de agente (`agentIdentity`) que não existia antes. Com dois ou mais candidatos não adivinha.
 */
export function acharTerminalNovo(terminais, antes, assignee) {
  if (assignee) {
    return terminais.find((t) => t.handle === assignee) ?? null
  }
  const novos = terminais.filter((t) => t.agentIdentity === 'claude' && !antes.has(t.handle))
  return novos.length === 1 ? novos[0] : null
}

/** Onde o texto enviado está na tela do chat: digitado na caixa de entrada (ainda não enviado) ou já no histórico. */
export function ondeEstaOTexto(linhas, trecho) {
  const tela = linhas.map((linha) => String(linha).trim())
  const caixa = tela.findLastIndex((linha) => linha.startsWith('❯'))
  if (caixa === -1) {
    return emUmaLinha(tela).includes(trecho) ? 'no_historico' : 'ausente'
  }
  let fim = tela.findIndex((linha, i) => i > caixa && LINHA_DE_SEPARACAO.test(linha))
  fim = fim === -1 ? tela.length : fim
  const dentro = emUmaLinha(tela.slice(caixa, fim))
  if (dentro.includes(trecho) || dentro.includes(MARCA_DE_COLAGEM)) {
    return 'na_caixa'
  }
  return emUmaLinha(tela.slice(0, caixa)).includes(trecho) ? 'no_historico' : 'ausente'
}

/**
 * Onde está a ordem. O `terminal read` do Orca tira da tela o texto digitado e ainda não enviado e o
 * devolve à parte, em `rascunho`: a caixa aparece vazia e a ordem inteira está ali (o-033). Rascunho com
 * o começo ou o fim da ordem, ou o marcador de texto colado que o Claude põe no lugar de texto longo,
 * conta como ordem parada na caixa; a conversa tem prioridade.
 */
export function ondeEstaAOrdem(linhas, rascunho, trechos) {
  const naTela = linhas ? ondeEstaOTexto(linhas, trechos[0]) : 'desconhecido'
  const digitado = emUmaLinha([String(rascunho ?? '')]).trim()
  const ordemNoRascunho =
    trechos.some((t) => digitado.includes(t)) || digitado.startsWith(MARCA_DE_COLAGEM)
  if (naTela !== 'no_historico' && digitado !== '' && ordemNoRascunho) {
    return 'na_caixa'
  }
  return naTela
}

export const ESTABILIDADE_DA_CAIXA_MS = 4000
/** Depois de enviar, o texto precisa continuar na caixa por este tempo para valer um novo envio (a tecla pode ter se perdido). */
export const REENVIO_APOS_MS = 20000
/** Enquanto a ordem estiver parada, o Enter segue sendo reenviado (a cada REENVIO_APOS_MS); o prazo de 45 min do vigia é o freio. */
export const MAXIMO_DE_ENVIOS = 60
/** O comando que lancou o chat tem ate isto para confirmar o inicio; depois, quem insiste e o vigia do criador. */
export const JANELA_DO_COMANDO_MS = 10 * 60 * 1000
/** Quanto tempo o vigia do criador insiste num chat que nao comecou, a contar do lancamento. */
export const PRAZO_DE_INSISTIR_MS = 45 * 60 * 1000

/**
 * Um passo da conferência do início do turno. `vigia` guarda o que já foi visto/feito; `visto` é
 * {atividade, onde}. Só envia com o texto parado na caixa; chat que já trabalha nunca recebe tecla.
 * Reenvia se o texto continua na caixa bem depois do último envio.
 */
export function decidirInicio(vigia, visto, agora) {
  if (vigia.comecouEm) {
    return { acao: 'comecou', vigia }
  }
  // Só prova positiva vale: trabalhando, ou a ordem já na conversa. 'done' não prova nada (o Orca o marca
  // também em chat que nunca recebeu a ordem, como o da o-033).
  if (visto.atividade === 'working' || visto.onde === 'no_historico') {
    const fonte = visto.atividade === 'working' ? 'atividade' : 'tela'
    return { acao: 'comecou', vigia: { ...vigia, comecouEm: agora, fonte, onde: visto.onde } }
  }
  const proximo = { ...vigia, onde: visto.onde }
  if (visto.onde !== 'na_caixa') {
    // Leitura que falhou (máquina carregada) não prova que o texto saiu da caixa: a contagem continua.
    const desde = visto.onde === 'desconhecido' ? vigia.naCaixaDesde : null
    return { acao: 'esperar', vigia: { ...proximo, onde: vigia.onde, naCaixaDesde: desde } }
  }
  const desde = vigia.naCaixaDesde ?? agora
  const envios = vigia.envios ?? (vigia.tentouEnviarEm ? 1 : 0)
  const paradoDesde = envios === 0 ? desde : Math.max(desde, vigia.tentouEnviarEm ?? 0)
  const espera = envios === 0 ? ESTABILIDADE_DA_CAIXA_MS : REENVIO_APOS_MS
  if (envios < MAXIMO_DE_ENVIOS && agora - paradoDesde >= espera) {
    return { acao: 'enviar', vigia: { ...proximo, naCaixaDesde: desde, envios: envios + 1 } }
  }
  return { acao: 'esperar', vigia: { ...proximo, naCaixaDesde: desde, envios } }
}

/** A aba do criador some da lista do Orca com outro identificador depois de o Orca reabrir: vale achá-la também pelo terminal. */
export function criadorSemAba(terminais, chatId, handles) {
  const certos = handles.filter(Boolean)
  return (
    terminais.length > 0 && !terminais.some((t) => t.tabId === chatId || certos.includes(t.handle))
  )
}

/**
 * Ordens do criador cujo chat ainda não comecou e que o vigia deve destravar: as que o comando
 * já declarou sem início e as que ficaram "lançando" além da janela do comando (ele morreu).
 * `desistir` lista as que passaram do prazo de insistir e ainda não foram declaradas desistidas.
 */
export function ordensSemInicio(estado, eu, agora) {
  const tentar = []
  const desistir = []
  for (const ordem of Object.values(estado.ordens)) {
    const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
    if (
      ordem.de !== eu ||
      ordem.situacao !== 'trabalhando' ||
      !chat?.ativo ||
      ordem.inicio === 'confirmado' ||
      ordem.inicioDesistido
    ) {
      continue
    }
    const idade = agora - Date.parse(ordem.lancadoEm)
    if (Number.isNaN(idade)) {
      continue
    }
    if (idade >= PRAZO_DE_INSISTIR_MS) {
      desistir.push(ordem)
    } else if (ordem.inicio !== 'pendente' || idade >= JANELA_DO_COMANDO_MS) {
      tentar.push(ordem)
    }
  }
  return { tentar, desistir }
}
