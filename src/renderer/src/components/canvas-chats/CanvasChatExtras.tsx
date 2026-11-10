import { useEffect, useRef, useState } from 'react'
import { ExternalLink, FileText, Globe, Loader2, PanelTop, X } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useWorktreeRuntimeTarget } from '@/runtime/use-worktree-runtime-target'
import { moveFocusToRendererBeforeWebviewDetach } from '@/components/browser-pane/host-guest/webview-registry'
import { openAppHttpLink } from '@/lib/app-http-link-open'
import {
  killWorkspacePortForTarget,
  refreshWorkspacePortScanAfterStop
} from '@/lib/workspace-ports/workspace-port-actions'
import { ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE } from '../../../../shared/browser-guest-web-preferences'
import { dismissCanvasChatArtifact } from './canvas-chat-artifacts'
import { BrowserImportHintButton } from '../browser-pane/assemble-chrome/BrowserImportHintButton'
import type { CanvasBox, CanvasExtra } from './canvas-chats-layout'

/** Fork: a chat's localhost server or claude.ai artifact, as a pill under the chat; click opens a mini browser. */
export function ExtraNode({
  extra,
  box,
  onExpand
}: {
  extra: CanvasExtra
  box: CanvasBox
  onExpand: () => void
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const [stopping, setStopping] = useState(false)
  const runtimeTarget = useWorktreeRuntimeTarget(extra.server?.worktreeId ?? null)

  const stopServer = async (): Promise<void> => {
    const server = extra.server
    if (!server) {
      return
    }
    setStopping(true)
    const result = await killWorkspacePortForTarget(runtimeTarget, {
      repoId: server.repoId,
      pid: server.pid,
      port: server.port
    })
    setStopping(false)
    setConfirming(false)
    if (!result.ok) {
      toast.error(result.reason)
      return
    }
    toast.success(`Servidor da porta ${server.port} desligado`)
    const state = useAppStore.getState()
    void refreshWorkspacePortScanAfterStop({
      runtimeTarget,
      replaceWorkspacePortScans: state.replaceWorkspacePortScans,
      getWorkspacePortScansByKey: () => useAppStore.getState().workspacePortScansByKey,
      setWorkspacePortScanRefreshing: state.setWorkspacePortScanRefreshing
    })
  }

  return (
    <div
      className="cc-node cc-extra"
      data-kind={extra.kind}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      title={extra.url}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => {
        if (confirming) {
          return
        }
        onExpand()
      }}
    >
      <span className="cc-xwrap">
        <button
          type="button"
          className="cc-xbtn"
          title={
            extra.kind === 'server'
              ? translate('fork.canvas.stopServer', 'Desligar este servidor')
              : translate('fork.canvas.hideArtifact', 'Tirar este artifact do fluxograma')
          }
          onClick={(e) => {
            e.stopPropagation()
            if (extra.kind === 'server') {
              setConfirming(true)
            } else {
              dismissCanvasChatArtifact(extra.url)
            }
          }}
        >
          <X size={13} />
        </button>
      </span>
      <div className="cc-agent-head">
        <span className="cc-extra-icon">
          {extra.kind === 'server' ? <Globe size={13} /> : <FileText size={13} />}
        </span>
        <b>{extra.label}</b>
      </div>
      <div className="cc-agent-line">
        {extra.kind === 'server'
          ? translate('fork.canvas.serverOn', 'servidor ligado · clique para ver')
          : translate('fork.canvas.artifactOpen', 'artifact · clique para ver')}
      </div>
      {confirming ? (
        <div className="cc-confirm cc-confirm-row" onClick={(e) => e.stopPropagation()}>
          <b>
            {translate('fork.canvas.stopServerAsk', 'Desligar {{label}}?', { label: extra.label })}
          </b>
          <div>
            <button
              type="button"
              className="cc-confirm-ok"
              disabled={stopping}
              onClick={() => void stopServer()}
            >
              {stopping ? <Loader2 size={12} className="cc-voice-spin" /> : null}
              {translate('fork.canvas.stopServerYes', 'Desligar')}
            </button>
            <button
              type="button"
              className="cc-confirm-cancel"
              onClick={() => setConfirming(false)}
            >
              {translate('fork.canvas.closeChatNo', 'Cancelar')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Mini browser for an expanded server/artifact. Lives outside the zoomed board: webviews don't paint under CSS transforms. */
export function CanvasWebPreview({
  extra,
  onClose
}: {
  extra: CanvasExtra
  onClose: () => void
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const [loading, setLoading] = useState(true)
  // Logins imported from Chrome/Edge land in this same browser profile: reload to show the page signed in.
  const importStatus = useAppStore((s) => s.browserSessionImportState?.status)
  useEffect(() => {
    if (importStatus === 'success') {
      webviewRef.current?.reload()
    }
  }, [importStatus])

  useEffect(() => {
    let disposed = false
    let detach: (() => void) | undefined
    void window.api.browser.sessionResolvePartition({ profileId: null }).then((partition) => {
      const container = containerRef.current
      if (disposed || !container || !partition) {
        return
      }
      const webview = document.createElement('webview') as Electron.WebviewTag
      webview.setAttribute('partition', partition)
      webview.setAttribute('webpreferences', ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE)
      webview.style.display = 'flex'
      webview.style.width = '100%'
      webview.style.height = '100%'
      webview.style.border = 'none'
      const onStart = (): void => setLoading(true)
      const onStop = (): void => setLoading(false)
      webview.addEventListener('did-start-loading', onStart)
      webview.addEventListener('did-stop-loading', onStop)
      container.appendChild(webview)
      webviewRef.current = webview
      webview.setAttribute('src', extra.url)
      detach = () => {
        webview.removeEventListener('did-start-loading', onStart)
        webview.removeEventListener('did-stop-loading', onStop)
        moveFocusToRendererBeforeWebviewDetach(webview)
        webview.remove()
        webviewRef.current = null
      }
    })
    return () => {
      disposed = true
      detach?.()
    }
  }, [extra.url])

  return (
    <div className="cc-web" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cc-web-head">
        <span className="cc-extra-icon">
          {extra.kind === 'server' ? <Globe size={13} /> : <FileText size={13} />}
        </span>
        <b>{extra.label}</b>
        {loading ? <Loader2 size={13} className="cc-voice-spin" /> : null}
        {extra.kind === 'artifact' ? (
          // Private artifacts need a claude.ai login: Orca's own import brings it over from Chrome/Edge.
          <BrowserImportHintButton profileId={null} compact />
        ) : null}
        <button
          type="button"
          className="cc-head-button"
          // Same login as this mini browser: sign in to claude.ai there once (by e-mail) and artifacts open here.
          title={translate(
            'fork.canvas.openBrowser',
            'Abrir no navegador do Orca (para entrar no claude.ai)'
          )}
          onClick={() => openAppHttpLink(extra.url)}
        >
          <PanelTop size={13} />
        </button>
        <button
          type="button"
          className="cc-head-button"
          title={translate('fork.canvas.openSystemBrowser', 'Abrir no navegador do computador')}
          onClick={() => void window.api.shell.openUrl(extra.url)}
        >
          <ExternalLink size={13} />
        </button>
        <button
          type="button"
          className="cc-head-button"
          title={translate('fork.canvas.collapse', 'Recolher')}
          onClick={onClose}
        >
          <X size={13} />
        </button>
      </div>
      <div ref={containerRef} className="cc-web-body" />
    </div>
  )
}
