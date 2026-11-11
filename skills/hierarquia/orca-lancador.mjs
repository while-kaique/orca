// Conversa com o Orca: lançar chat, manter aberto e avisar. Usado pelo comando `hierarquia`.
import { execFileSync } from 'node:child_process'

/** O texto que vai para o Orca precisa ser ASCII puro: acento vira lixo na ordem. */
export function semAcento(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^\x20-\x7e]/gu, ' ')
    .replace(/"/gu, "'")
}

export function orca(args) {
  const comando = process.env.HIERARQUIA_ORCA ?? 'orca-dev'
  // No Windows o comando é um .cmd, que só abre pelo shell.
  let saida
  try {
    saida = execFileSync(comando, [...args, '--json'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 64 * 1024 * 1024
    })
  } catch (erro) {
    // O Orca sai com código 1 também quando só não confirmou o início do turno: a resposta vem igual.
    if (!String(erro.stdout ?? '').includes('{')) {
      throw erro
    }
    saida = String(erro.stdout)
  }
  const util = saida
    .split('\n')
    .filter((linha) => !linha.includes('_keepalive'))
    .join('\n')
  return JSON.parse(util.slice(util.indexOf('{')))
}

export function dormir(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function citar(texto) {
  return process.platform === 'win32' ? `"${texto}"` : texto
}

export function garantirExecucao() {
  const atual = orca(['orchestration', 'run-current']).result?.run
  if (atual) {
    return atual.id
  }
  const nova = orca([
    'orchestration',
    'run-create',
    '--objective',
    citar('Hierarquia de chats do projeto')
  ])
  return nova.result.run.id
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
