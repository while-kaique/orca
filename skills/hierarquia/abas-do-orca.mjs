// As abas que o Orca guarda (inclusive as que voltaram sem terminal ao reabrir), lidas da sessão gravada
// em disco. `orca terminal list` só mostra terminais vivos; o fluxograma desenha as abas guardadas.
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function pastaDeDadosDoOrca() {
  if (process.env.HIERARQUIA_ORCA_DADOS) {
    return process.env.HIERARQUIA_ORCA_DADOS
  }
  // O fork usa a pasta `orca-fork`; o comando dele é o `orca-dev`.
  const nome = (process.env.HIERARQUIA_ORCA ?? 'orca-dev') === 'orca-dev' ? 'orca-fork' : 'orca'
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), nome)
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', nome)
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), nome)
}

function bancoDoPerfil(dados) {
  const indice = join(dados, 'orca-profile-index.json')
  const perfil = existsSync(indice)
    ? (JSON.parse(readFileSync(indice, 'utf8')).activeProfileId ?? 'local-default')
    : 'local-default'
  return join(dados, 'profiles', perfil, 'profile-state.db')
}

/**
 * Abas de terminal guardadas pelo Orca: Map(id da aba -> { pasta, titulo }). Devolve null quando não dá
 * para ler (Orca sem sessão gravada, node sem `node:sqlite`): aí ninguém afirma "dormindo" nem "fechado".
 */
export async function abasGuardadas() {
  try {
    const banco = bancoDoPerfil(pastaDeDadosDoOrca())
    if (!existsSync(banco)) {
      return null
    }
    // `node:sqlite` ainda avisa que é experimental: o aviso sujaria a saída de `hierarquia estado`.
    const avisar = process.emitWarning
    process.emitWarning = () => {}
    const { DatabaseSync } = await import('node:sqlite').finally(() => {
      process.emitWarning = avisar
    })
    const db = new DatabaseSync(banco, { readOnly: true })
    try {
      const linha = db
        .prepare(`select payload from profile_state_documents where domain = 'workspaceSession'`)
        .get()
      const sessao = linha ? JSON.parse(linha.payload) : null
      if (!sessao?.tabsByWorktree) {
        return null
      }
      const abas = new Map()
      const pastaDe = (worktreeId) => String(worktreeId ?? '').split('::')[1] ?? null
      for (const [worktreeId, lista] of Object.entries(sessao.tabsByWorktree)) {
        for (const aba of lista ?? []) {
          abas.set(aba.id, { pasta: pastaDe(worktreeId), titulo: aba.title })
        }
      }
      // O fluxograma também desenha a sessão de agente dormindo cuja aba não voltou à lista.
      const fechadas = sessao.closedTerminalTabTombstonesByTabId ?? {}
      for (const dormindo of Object.values(sessao.sleepingAgentSessionsByPaneKey ?? {})) {
        if (dormindo?.tabId && !abas.has(dormindo.tabId) && !fechadas[dormindo.tabId]) {
          abas.set(dormindo.tabId, { pasta: pastaDe(dormindo.worktreeId), titulo: null })
        }
      }
      return abas
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}
