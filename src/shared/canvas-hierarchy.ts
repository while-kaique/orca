// Fork: the "PO > planner > executor" state a project keeps in `.hierarquia/estado.json`.
// The `hierarquia` command (skills/hierarquia) owns the rules and writes the file; Orca only reads it.

export type CanvasHierarchyRole = 'po' | 'planejador' | 'executor'

export type CanvasHierarchyOrderState =
  | 'em_espera'
  | 'trabalhando'
  | 'em_prova'
  | 'conferindo_plano'
  | 'conferindo_produto'
  | 'aprovado'
  | 'esperando_kaique'
  | 'liberado'
  | 'devolvido'
  | 'parou'
  | 'subiu'

export type CanvasHierarchyChat = {
  /** The chat's tab id: it survives an Orca restart, unlike the terminal handle. */
  id: string
  papel: CanvasHierarchyRole
  pai: string | null
  ordemId: string | null
  ativo: boolean
  mexidoPeloKaique: boolean
}

export type CanvasHierarchyOrder = {
  id: string
  /** Tab id of the chat that gave the order. */
  de: string
  chatId: string | null
  situacao: CanvasHierarchyOrderState
  reprovacoes: number
  titulo: string
}

export type CanvasHierarchyQueueItem = {
  tipo: 'ok' | 'reprovada_duas_vezes' | 'pergunta'
  ordemId?: string
  perguntaId?: string
  /** Tab id of the chat the item came from. */
  chatId: string
  resumo?: string
  texto?: string
}

export type CanvasHierarchySnapshot = {
  /** Folder that holds `.hierarquia/`. */
  folder: string
  chats: Record<string, CanvasHierarchyChat>
  ordens: Record<string, CanvasHierarchyOrder>
  fila: CanvasHierarchyQueueItem[]
}

export type CanvasHierarchyDecision = {
  folder: string
  ordemId: string
  decisao: 'ok' | 'devolver'
  motivo?: string
}

export type CanvasHierarchyDecisionResult = { kind: 'ok' } | { kind: 'error'; error: string }
