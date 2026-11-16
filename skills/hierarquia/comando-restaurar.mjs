// `hierarquia restaurar`: o chat voltou sem aba (queda, Orca fechado): abre a conversa dele em terminal novo, na mesma
// pasta, e grava um evento so (`chat_restaurado`). O registro faz o chat novo herdar o lugar do antigo (regras.mjs).
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { pastaDeDadosDoOrca } from './abas-do-orca.mjs'
import { acharConversa, pastaDasConversas } from './conversa-perdida.mjs'
import { vidaDosChats } from './fechar-chats.mjs'
import { abaDoChat, citar, orca, semAcento } from './orca-lancador.mjs'
import { acharProjeto, anotar, caminhos, lerEventos, sair } from './registro.mjs'
import { decidirRestauracao } from './decisao-de-restauracao.mjs'
import { esforcoDoModelo, montarEstado } from './regras.mjs'
import { garantirVigia } from './vigia-do-criador.mjs'

/** Conversas menores que isto sao abas recem-abertas, nunca o chat que trabalhava. */
const CONVERSA_MINIMA_BYTES = 8 * 1024
const CONVERSA_RECENTE_MS = 7 * 24 * 60 * 60 * 1000

/** A conversa do chat: a do `--conversa`; a que recebeu a ordem (pelo dispatchId); senao a maior das mais recentes da pasta. */
export function escolherConversa({ pasta, dispatchId, explicita, raiz }) {
  if (explicita) {
    return { sessao: explicita, como: 'informada por --conversa' }
  }
  const pelaOrdem = acharConversa({ pasta, dispatchId, raiz })
  if (pelaOrdem) {
    return { sessao: pelaOrdem.sessao, como: 'a que recebeu a ordem (dispatchId no comeco dela)' }
  }
  const dir = pastaDasConversas(pasta, raiz ?? join(homedir(), '.claude', 'projects'))
  let arquivos = []
  try {
    arquivos = readdirSync(dir)
      .filter((nome) => nome.endsWith('.jsonl'))
      .map((nome) => ({ nome, ...statSync(join(dir, nome)) }))
  } catch {
    return null
  }
  const recentes = arquivos.filter(
    (a) => a.size >= CONVERSA_MINIMA_BYTES && Date.now() - a.mtimeMs < CONVERSA_RECENTE_MS
  )
  const maior = recentes.sort((a, b) => b.size - a.size || b.mtimeMs - a.mtimeMs)[0]
  return maior
    ? { sessao: basename(maior.nome, '.jsonl'), como: 'a maior das conversas recentes da pasta' }
    : null
}

/** A pasta do plugin `orca-agent-view` do Orca com que este comando fala: a mais nova guardada no perfil dele. */
export function pastaDoPluginDoClaude() {
  if (process.env.HIERARQUIA_PLUGIN_DIR) {
    return process.env.HIERARQUIA_PLUGIN_DIR
  }
  const raiz = join(pastaDeDadosDoOrca(), 'claude-agent-view')
  try {
    return readdirSync(raiz)
      .map((nome) => join(raiz, nome, 'orca-agent-view'))
      .filter((pasta) => existsSync(pasta))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
  } catch {
    return undefined
  }
}

function acharNaResposta(valor, chave) {
  if (valor && typeof valor === 'object') {
    if (typeof valor[chave] === 'string') {
      return valor[chave]
    }
    for (const filho of Object.values(valor)) {
      const achado = acharNaResposta(filho, chave)
      if (achado) {
        return achado
      }
    }
  }
  return undefined
}

export async function comandoRestaurar(op, eu, script) {
  const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
  const estado = montarEstado(lerEventos(projeto))
  const antigo = estado.chats[op.chat]
  const { vidas } = await vidaDosChats(estado)
  const decisao = decidirRestauracao(estado, {
    eu,
    chatAnterior: op.chat,
    vida: antigo ? vidas.get(antigo.id) : null
  })
  if (decisao.acao === 'recusar') {
    sair(`Restauração recusada: ${decisao.motivo}`)
  }
  const ordem = antigo.ordemId ? estado.ordens[antigo.ordemId] : null
  const pasta = String(op.pasta ?? ordem?.pasta ?? projeto).replaceAll('\\', '/')
  const conversa = escolherConversa({
    pasta,
    dispatchId: ordem?.dispatchId,
    explicita: op.conversa
  })
  if (!conversa) {
    sair(
      `Não achei a conversa guardada de ${op.chat} em ${pasta}. Sem conversa é restauração sem memória: dê baixa na ordem e relance, ou informe --conversa ID.`
    )
  }
  const plugin = pastaDoPluginDoClaude()
  if (plugin && /[\s"]/u.test(plugin)) {
    sair(
      `A pasta do plugin tem espaço ou aspas (${plugin}); informe outra em HIERARQUIA_PLUGIN_DIR.`
    )
  }
  const comando = [
    'claude',
    ...(plugin ? ['--plugin-dir', plugin] : []),
    '--model',
    decisao.modelo,
    ...(esforcoDoModelo(decisao.modelo) ? ['--effort', esforcoDoModelo(decisao.modelo)] : []),
    '--permission-mode',
    'auto',
    '--resume',
    conversa.sessao
  ].join(' ')
  const nome =
    decisao.papel === 'po'
      ? 'PO (restaurado)'
      : `${ordem?.campos?.titulo ?? ordem?.id ?? antigo.id} (${ordem?.id ?? 'chat'}, restaurado)`
  const resposta = orca([
    'terminal',
    'create',
    '--worktree',
    citar(`path:${pasta}`),
    '--title',
    citar(semAcento(nome)),
    '--command',
    citar(comando)
  ])
  const handle = acharNaResposta(resposta.result ?? resposta, 'handle')
  if (!resposta.ok || !handle) {
    sair(`O Orca não abriu o terminal: ${JSON.stringify(resposta).slice(0, 500)}`)
  }
  const chatId =
    acharNaResposta(resposta.result, 'tabId') ?? (await abaDoChat(null, handle)) ?? handle
  anotar(projeto, 'chat_restaurado', {
    chatAnterior: antigo.id,
    chatId,
    handle,
    conversa: conversa.sessao,
    pasta
  })
  if (decisao.papel === 'po') {
    garantirVigia(caminhos(projeto).base, chatId, script, projeto, handle)
  }
  console.log(
    [
      `Chat ${antigo.id} restaurado como ${chatId} (${decisao.papel}${ordem ? `, ${ordem.id}` : ''}), terminal ${handle}.`,
      `Conversa ${conversa.sessao} (${conversa.como}); pasta ${pasta}; ${decisao.modelo}, esforco ${esforcoDoModelo(decisao.modelo) ?? 'padrao'}, modo auto.`,
      'Falta ver a tela uma vez (conversa carregada, modo auto) e mandar o AVISO DO PO; confira com: hierarquia estado.'
    ].join('\n')
  )
}
