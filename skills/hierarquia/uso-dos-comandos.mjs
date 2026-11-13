import { opcoes } from './opcoes-da-linha.mjs'
import { sair } from './registro.mjs'

// Ajuda e campos obrigatórios de cada subcomando: conferidos antes de ler ou gravar o registro, para --help nunca ter efeito.
export const USO = {
  'criar-po': { uso: 'hierarquia criar-po [--projeto PASTA] [--teste]', exige: [] },
  ordem: {
    uso: 'hierarquia ordem --para planejador|executor --arquivo ordem.json [--pedido NOME] [--na-frente] [--na-pasta-do-criador]',
    exige: ['para', 'arquivo']
  },
  'lancar-espera': { uso: 'hierarquia lancar-espera', exige: [] },
  vigiar: { uso: 'hierarquia vigiar (ligado sozinho pelo comando ordem)', exige: [] },
  baixa: { uso: 'hierarquia baixa --ordem ID --motivo "..."', exige: ['ordem', 'motivo'] },
  responder: {
    uso: 'hierarquia responder --pergunta p-NNN --texto "..."',
    exige: ['pergunta', 'texto']
  },
  entregar: {
    uso: 'hierarquia entregar --ordem ID --prova CAMINHO [--prova CAMINHO ...] [--resumo "..."]',
    exige: ['ordem']
  },
  conferir: {
    uso: 'hierarquia conferir --ordem ID (--aprovar | --reprovar --motivo "...")',
    exige: ['ordem']
  },
  perguntar: { uso: 'hierarquia perguntar --texto "..."', exige: ['texto'] },
  vez: { uso: 'hierarquia vez -- <comando pesado>', exige: [] },
  'pedir-ok': { uso: 'hierarquia pedir-ok --ordem ID [--resumo "..."]', exige: ['ordem'] },
  ok: { uso: 'hierarquia ok --ordem ID (só o Kaique)', exige: ['ordem'] },
  devolver: {
    uso: 'hierarquia devolver --ordem ID --motivo "..." (só o Kaique)',
    exige: ['ordem', 'motivo']
  },
  encerrar: { uso: 'hierarquia encerrar --chat ID [--motivo "..."] (só o Orca)', exige: ['chat'] },
  estado: { uso: 'hierarquia estado [--json]', exige: [] },
  fechar: { uso: 'hierarquia fechar --ordem ID | --terminados | --pedido NOME', exige: [] }
}

export function pedidoDeAjuda(argumentos) {
  return argumentos.includes('--help') || argumentos.includes('-h')
}

/** Os campos obrigatórios que a linha de comando não trouxe (vazio também conta como falta). */
export function camposQueFaltam(nome, op) {
  return (USO[nome]?.exige ?? []).filter((campo) => String(op[campo] ?? '').trim() === '')
}

/**
 * Lê `hierarquia <comando> [opções] [-- comando pesado]`. Ajuda e campo faltando saem aqui, antes de
 * qualquer leitura ou gravação do registro e de qualquer mensagem a chat.
 */
export function lerLinhaDeComando(argv, nomesDosComandos) {
  const [nome, ...argumentos] = argv
  const usoGeral = `Uso: hierarquia <${nomesDosComandos.join(' | ')}> [opções]`
  if (!nomesDosComandos.includes(nome)) {
    sair(usoGeral, pedidoDeAjuda([nome ?? '']) ? 0 : 1)
  }
  const separador = argumentos.indexOf('--')
  const resto = separador === -1 ? argumentos : argumentos.slice(0, separador)
  if (pedidoDeAjuda(resto)) {
    sair(`${USO[nome].uso}\n${usoGeral}`, 0)
  }
  const op = opcoes(resto)
  const faltam = camposQueFaltam(nome, op)
  if (faltam.length > 0) {
    sair(`Falta ${faltam.map((campo) => `--${campo}`).join(', ')}. Uso: ${USO[nome].uso}`)
  }
  // O comando volta a ser uma linha de shell: argumento com espaço ou símbolo vai entre aspas.
  op.comando =
    separador === -1
      ? ''
      : argumentos
          .slice(separador + 1)
          .map((arg) => (/[\s"&|<>^()]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg))
          .join(' ')
  return { nome, op }
}
