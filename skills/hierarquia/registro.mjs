// O registro do projeto (`.hierarquia/registro.jsonl`) e a foto que o fluxograma lê. Usado pelo comando `hierarquia`.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { filaDoKaique, montarEstado } from './regras.mjs'

export function sair(mensagem, codigo = 1) {
  console.error(mensagem)
  process.exit(codigo)
}

/** A pasta do projeto é a que tem `.hierarquia/`; cópias de trabalho do git apontam para a principal. */
/** Só conta como projeto a pasta cujo `.hierarquia/` tem registro: uma `.hierarquia` vazia na pasta do usuário enganava a busca. */
function temRegistro(pasta) {
  return existsSync(join(pasta, '.hierarquia', 'registro.jsonl'))
}

export function acharProjeto(explicito) {
  if (explicito) {
    return resolve(explicito)
  }
  if (process.env.HIERARQUIA_PROJETO) {
    return resolve(process.env.HIERARQUIA_PROJETO)
  }
  let pasta = process.cwd()
  for (;;) {
    if (temRegistro(pasta)) {
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
      encoding: 'utf8',
      windowsHide: true
    }).trim()
    const principal = dirname(comum)
    if (temRegistro(principal)) {
      return principal
    }
  } catch {
    // Pasta sem git: segue para o erro abaixo.
  }
  return null
}

export function caminhos(projeto) {
  const base = join(projeto, '.hierarquia')
  return {
    base,
    registro: join(base, 'registro.jsonl'),
    ordens: join(base, 'ordens'),
    config: join(base, 'config.json')
  }
}

export function lerEventos(projeto) {
  const { registro } = caminhos(projeto)
  if (!existsSync(registro)) {
    return []
  }
  return readFileSync(registro, 'utf8')
    .split('\n')
    .filter((linha) => linha.trim() !== '')
    .map((linha) => JSON.parse(linha))
}

/** Lista de projetos com hierarquia nesta máquina: a porta de reabrir o Orca olha todos. */
export function arquivoDoIndice() {
  return process.env.HIERARQUIA_INDICE ?? join(homedir(), '.hierarquia-projetos.json')
}

export function lembrarProjeto(projeto) {
  const arquivo = arquivoDoIndice()
  let lista = []
  try {
    lista = JSON.parse(readFileSync(arquivo, 'utf8'))
  } catch {
    // Índice ainda não existe.
  }
  const certo = resolve(projeto)
  if (!lista.some((item) => resolve(item).toLowerCase() === certo.toLowerCase())) {
    try {
      writeFileSync(arquivo, JSON.stringify([...lista, certo], null, 2), 'utf8')
    } catch {
      // Sem o índice a porta ainda acha o projeto pelas abas do Orca.
    }
  }
}

export function anotar(projeto, tipo, dados) {
  const evento = { t: new Date().toISOString(), tipo, ...dados }
  appendFileSync(caminhos(projeto).registro, `${JSON.stringify(evento)}\n`, 'utf8')
  gravarFoto(projeto)
  lembrarProjeto(projeto)
  return evento
}

function chatCortado(estado, ordem) {
  const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
  return Boolean(ordem.situacao === 'trabalhando' && chat?.cortadoEm && !chat.retomadoEm)
}

/** `estado.json`: a foto do momento que o fluxograma lê, sempre derivada do registro. */
export function gravarFoto(projeto) {
  const estado = montarEstado(lerEventos(projeto))
  const ordens = Object.fromEntries(
    Object.values(estado.ordens).map((ordem) => [
      ordem.id,
      {
        id: ordem.id,
        de: ordem.de,
        papel: ordem.papel,
        chatId: ordem.chatId,
        // Chat cortado que ainda nao voltou aparece "na fila" no card, nunca "trabalhando" (o-041 parte 4).
        situacao: chatCortado(estado, ordem) ? 'em_espera' : ordem.situacao,
        ...(chatCortado(estado, ordem) ? { cortado: true } : {}),
        reprovacoes: ordem.reprovacoes,
        titulo: ordem.campos.titulo ?? ordem.campos.objetivo,
        inicio: ordem.inicio
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

export function lerConfig(projeto) {
  const { config } = caminhos(projeto)
  return existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')) : {}
}
