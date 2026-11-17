import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { isRemoteRuntimePtyId } from '../../../../../shared/remote-runtime/remote-runtime-pty-id'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import {
  restorePtyDataHandlersAfterFailedShutdown,
  unregisterPtyDataHandlers
} from '@/components/terminal-pane/pty-dispatcher'
import { shutdownBufferCaptures } from '@/components/terminal-pane/shutdown-buffer-captures'
import { isValidCompletedAgentHibernationEntry } from '@/store/slices/agent-status/agent-status-sleeping-records'
import { resolveTerminalPtyOwner } from '@/lib/terminal-worktree-route'
import { resolveTerminalTeardownOwner } from '@/store/terminals/terminal-teardown-owner'
import type { AgentStatusEntry } from '../../../../../shared/agent-status/contracts/agent-status-types'

type ChatPane = { paneKey: string; leafId: string; ptyId: string; entry: AgentStatusEntry }
type ChatPaneState = Pick<
  ReturnType<typeof useAppStore.getState>,
  'agentStatusByPaneKey' | 'terminalLayoutsByTabId' | 'ptyIdsByTabId'
>

/** The chat's agent pane: its newest status row and the process behind it; null when there is nothing to resume. */
export function findChatPane(
  tabId: string,
  state: ChatPaneState = useAppStore.getState()
): ChatPane | null {
  let best: { paneKey: string; leafId: string; entry: AgentStatusEntry } | null = null
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
    const parsed = parsePaneKey(paneKey)
    if (parsed?.tabId !== tabId) {
      continue
    }
    if (!best || entry.stateStartedAt > best.entry.stateStartedAt) {
      best = { paneKey, leafId: parsed.leafId, entry }
    }
  }
  if (!best) {
    return null
  }
  const ptyId =
    state.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId?.[best.leafId] ??
    state.ptyIdsByTabId[tabId]?.[0]
  return ptyId && (state.ptyIdsByTabId[tabId] ?? []).includes(ptyId) ? { ...best, ptyId } : null
}

/**
 * Stops one chat's process on purpose, keeping its conversation: the card stays, shows "suspenso", and a click
 * resumes the same session (the sleeping-chat wake the card already runs). Returns whether the chat was suspended.
 *
 * A chat whose turn is done goes through Orca's own hibernation. That path refuses a chat that is still working, so
 * the others save the resume record the way a manual workspace sleep does and stop only this chat's process
 * (the workspace sleep stops every chat of the folder, which would take down neighbours).
 */
export async function suspendPcDeskChat(
  worktreeId: string,
  tabId: string,
  // Fork (o-051): the close's batch passes quiet so one failing chat does not stack an error toast per chat.
  opts: { quiet?: boolean } = {}
): Promise<boolean> {
  const notify = (message: string): void => {
    if (!opts.quiet) {
      toast.error(message)
    }
  }
  const pane = findChatPane(tabId)
  if (!pane) {
    notify(
      translate(
        'fork.canvas.suspendNothing',
        'Este chat não tem uma conversa para guardar, então não dá para suspender.'
      )
    )
    return false
  }
  const state = useAppStore.getState()
  if (!isLocalChatPane(state, worktreeId, pane)) {
    notify(translate('fork.canvas.suspendRemote', 'Só chats desta máquina podem ser suspensos.'))
    return false
  }
  try {
    if (isValidCompletedAgentHibernationEntry(pane.entry)) {
      await state.shutdownCompletedAgentPaneForHibernation(worktreeId, {
        paneKey: pane.paneKey,
        tabId,
        leafId: pane.leafId,
        ptyId: pane.ptyId
      })
      return true
    }
    return await suspendWorkingChat(worktreeId, tabId, pane)
  } catch (error) {
    console.warn('[suspend-chat] failed to suspend chat', error)
    notify(
      translate('fork.canvas.suspendFailed', 'Não consegui suspender o chat. Ele continua ligado.')
    )
    return false
  }
}

/** Remote chats are stopped by their own host; this window cannot prove that stop, so it never tries. */
export function isLocalChatPane(
  state: Parameters<typeof resolveTerminalPtyOwner>[0],
  worktreeId: string,
  pane: Pick<ChatPane, 'ptyId'>
): boolean {
  const teardownOwner = resolveTerminalTeardownOwner(resolveTerminalPtyOwner(state, worktreeId), [
    pane.ptyId
  ])
  return (
    teardownOwner.kind !== 'refused' &&
    teardownOwner.runtimeEnvironmentId === null &&
    !isRemoteRuntimePtyId(pane.ptyId)
  )
}

async function suspendWorkingChat(
  worktreeId: string,
  tabId: string,
  pane: ChatPane
): Promise<boolean> {
  const { paneKey, ptyId } = pane
  const before = useAppStore.getState().sleepingAgentSessionsByPaneKey[paneKey]
  useAppStore.getState().captureSleepingAgentSessionsByWorktree(worktreeId, [paneKey])
  const record = useAppStore.getState().sleepingAgentSessionsByPaneKey[paneKey]
  if (!record || record.origin !== 'worktree-sleep') {
    // Without a resume record the stop would lose the conversation: keep the chat running.
    return false
  }
  const restoreRecord = (): void =>
    useAppStore.setState((s) => {
      const next = { ...s.sleepingAgentSessionsByPaneKey }
      if (before) {
        next[paneKey] = before
      } else {
        delete next[paneKey]
      }
      return { sleepingAgentSessionsByPaneKey: next }
    })
  // Why: the same record Orca's own hibernation writes: "done" arms the pane's wake on the card's click and resumes
  // the same session; a tab-open-only record would be skipped by that wake and open a fresh conversation.
  useAppStore.setState((s) => ({
    sleepingAgentSessionsByPaneKey: {
      ...s.sleepingAgentSessionsByPaneKey,
      [paneKey]: { ...record, state: 'done', restoreOnTabOpenOnly: false }
    }
  }))
  try {
    shutdownBufferCaptures.get(tabId)?.({ includeLocalBuffers: false })
  } catch {
    // One unavailable pane must not block the suspend.
  }
  // Why: the kill's exit event must not close the tab (same guard the hibernation uses).
  useAppStore.setState((s) => ({
    suppressedPtyExitIds: { ...s.suppressedPtyExitIds, [ptyId]: true }
  }))
  const handlerSnapshots = unregisterPtyDataHandlers([ptyId]) ?? []
  try {
    await window.api.pty.kill(ptyId, { keepHistory: true })
  } catch (error) {
    restorePtyDataHandlersAfterFailedShutdown(handlerSnapshots)
    useAppStore.setState((s) => {
      const next = { ...s.suppressedPtyExitIds }
      delete next[ptyId]
      return { suppressedPtyExitIds: next }
    })
    restoreRecord()
    throw error
  }
  for (const snapshot of handlerSnapshots) {
    snapshot.commit?.()
  }
  useAppStore.setState((s) => {
    const remaining = (s.ptyIdsByTabId[tabId] ?? []).filter((id) => id !== ptyId)
    const tabs = s.tabsByWorktree[worktreeId] ?? []
    const nextInput = { ...s.lastTerminalInputAtByPaneKey }
    delete nextInput[paneKey]
    return {
      ptyIdsByTabId: { ...s.ptyIdsByTabId, [tabId]: remaining },
      tabsByWorktree: {
        ...s.tabsByWorktree,
        [worktreeId]: tabs.map((tab) =>
          tab.id === tabId ? { ...tab, ptyId: remaining.at(-1) ?? null } : tab
        )
      },
      lastTerminalInputAtByPaneKey: nextInput
    }
  })
  useAppStore.getState().dropHibernatedAgentStatusPane(worktreeId, paneKey)
  return true
}
