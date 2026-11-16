// `hierarquia porta` e `hierarquia retomar` (o-041): a porta de reabrir o Orca e a volta dos chats depois de reabrir.
import { abasGuardadas } from './abas-do-orca.mjs'
import {
  abrirLiberacao,
  cancelarLiberacao,
  olharPorta,
  projetosDaMaquina,
  textoDaPorta
} from './porta-do-orca.mjs'
import { acharProjeto, anotar, caminhos, lerEventos, sair } from './registro.mjs'
import { montarEstado } from './regras.mjs'
import { garantirVigia } from './vigia-do-criador.mjs'
import { lerJson } from './trava.mjs'
import { tratarEscondidos } from './chats-escondidos.mjs'
import { AVISO_DE_CONVERSA_PERDIDA_ATE_MS } from './conversa-perdida.mjs'

/**
 * `hierarquia retomar`: o Orca do fork roda isto ao abrir. Em todo projeto da maquina, liga o vigia de cada chat
 * com trabalho pendente (ordem aberta, chat cortado ou aviso guardado), para a volta e os avisos seguirem sozinhos.
 */
export async function comandoRetomar(script) {
  const abas = await abasGuardadas()
  const projetos = projetosDaMaquina([...(abas?.values() ?? [])].map((aba) => aba.pasta))
  // Chats que rodavam escondidos e o Orca encerrou ao reabrir: as ordens deles param (o vigia avisa quem criou).
  await tratarEscondidos(projetos).catch(() => null)
  for (const projeto of projetos) {
    const estado = montarEstado(lerEventos(projeto))
    // Chat perdido ainda sem aviso: o vigia de quem criou avisa; criador que sumiu passa a vez ao PO (herdeiro).
    const perdidas = Object.values(estado.ordens).filter(
      (ordem) =>
        ordem.situacao === 'parou' &&
        ordem.paradaAutomatica &&
        !ordem.conversaAvisada &&
        Date.now() - Date.parse(ordem.paradaEm ?? 0) < AVISO_DE_CONVERSA_PERDIDA_ATE_MS
    )
    const donos = new Set([
      ...Object.values(estado.ordens)
        .filter((ordem) =>
          ['trabalhando', 'em_prova', 'devolvido', 'em_espera'].includes(ordem.situacao)
        )
        .map((ordem) => ordem.de),
      ...Object.values(estado.chats)
        .filter((chat) => chat.ativo && chat.cortadoEm && !chat.retomadoEm)
        .map((chat) => chat.pai ?? chat.id),
      ...Object.values(estado.guardados).map(
        (aviso) => estado.chats[aviso.chatId]?.pai ?? aviso.chatId
      ),
      ...perdidas.map((ordem) => ordem.de),
      ...(perdidas.length > 0 && estado.po ? [estado.po] : [])
    ])
    for (const dono of donos) {
      if (estado.chats[dono]?.ativo && abas?.has(dono)) {
        const pid = garantirVigia(
          caminhos(projeto).base,
          dono,
          script,
          projeto,
          estado.chats[dono].handle
        )
        console.log(`${projeto}: vigia de ${dono} (${pid})`)
      }
    }
  }
}

/** `hierarquia porta`: pode fechar ou reabrir o Orca agora? Olha todos os chats da máquina. */
export async function comandoPorta(op) {
  if (op.cancelar) {
    cancelarLiberacao()
    console.log('Liberacao de reabrir cancelada: ordens novas voltam a sair.')
    return
  }
  // O X ja olhou a porta para perguntar: com `--porta-salva` o corte usa aquela lista e nao olha tudo de novo (olhar
  // de novo passava do prazo do X nesta maquina e o corte nao era gravado; Orca de teste, 15/11).
  const salva = op['porta-salva'] ? lerJson(op['porta-salva']) : null
  const porta = salva?.chats ? salva : await olharPorta({ rapido: Boolean(op.rapido) })
  if (op['registrar-corte']) {
    // O X do Orca roda isto depois de o usuario escolher fechar: cada chat da hierarquia que trabalhava fica marcado como cortado.
    for (const chat of porta.chats.filter((item) => !item.livre)) {
      anotar(chat.projeto, 'chat_cortado', {
        chatId: chat.chatId,
        ...(chat.ordemId ? { ordemId: chat.ordemId } : {}),
        segundoPlano: chat.segundoPlano,
        motivo: 'o Orca foi fechado com o chat trabalhando'
      })
    }
  }
  if (op.json) {
    console.log(JSON.stringify(porta, null, 2))
    process.exitCode = porta.pode ? 0 : 2
    return
  }
  if (op.atalho) {
    // O atalho de abrir o Orca: nada na saida quando pode; senao, so a lista de quem esta trabalhando.
    if (porta.chats.length > 0) {
      const linhas = textoDaPorta({ ...porta, recentes: [], liberacao: null }).split('\n')
      console.log(linhas.filter((linha) => linha.startsWith('- ')).join('\n'))
    }
    return
  }
  console.log(textoDaPorta(porta))
  if (!op.liberar) {
    process.exitCode = porta.pode ? 0 : 2
    return
  }
  if (!porta.pode) {
    sair(
      'Liberacao recusada: ha chat trabalhando ou ordem recem-lancada (lista acima). Nao diga "pode reabrir".',
      2
    )
  }
  abrirLiberacao({
    desde: new Date().toISOString(),
    por: process.env.ORCA_TAB_ID ?? 'fora de um chat',
    projeto: acharProjeto(op.projeto)
  })
  console.log(
    'Liberado: pode dizer "pode reabrir". Ate o Orca reabrir (ou 30 min), nenhuma ordem nova sai; para desistir: hierarquia porta --cancelar.'
  )
}
