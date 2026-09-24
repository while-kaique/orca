import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TerminalTabLeadingIcon } from './TerminalTabLeadingIcon'
import type { TerminalTabActivityStatus } from './terminal-tab-activity-status'

/** Render one activity status through the production leading-icon component. */
function renderStatus(status: TerminalTabActivityStatus): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <TerminalTabLeadingIcon
        agent="codex"
        activityStatus={status}
        shell={undefined}
        showUnreadActivity={false}
        isActive={false}
      />
    </TooltipProvider>
  )
}

describe('TerminalTabLeadingIcon', () => {
  it('shows a working spinner beside the provider icon', () => {
    const markup = renderStatus('working')

    expect(markup).toContain('data-testid="tab-agent-activity-indicator"')
    expect(markup).toContain('data-agent-activity-status="working"')
    expect(markup).toContain('aria-label="Working"')
    expect(markup).toContain('data-agent-spinner')
    expect(markup).toContain('data-agent-icon="codex"')
  })

  it('shows a seen completion as an outline ring', () => {
    const markup = renderStatus('done')

    expect(markup).toContain('data-agent-activity-status="done"')
    expect(markup).toContain('border-agent-done')
    expect(markup).not.toContain('bg-agent-done')
    expect(markup).toContain('data-agent-icon="codex"')
  })

  it('shows a needs-input (permission) state as the shared question glyph', () => {
    const markup = renderStatus('permission')

    expect(markup).toContain('data-agent-activity-status="permission"')
    expect(markup).toContain('lucide-message-circle-question-mark')
    expect(markup).toContain('text-agent-question')
    expect(markup).not.toContain('bg-red-500')
  })

  it('shows no activity glyph for an active shell — just the identity icon', () => {
    const markup = renderStatus('active')

    expect(markup).not.toContain('data-testid="tab-agent-activity-indicator"')
    expect(markup).toContain('data-agent-icon="codex"')
  })

  it('falls back to the shell icon when a plain tab is inactive', () => {
    const markup = renderToStaticMarkup(
      <TerminalTabLeadingIcon
        agent={null}
        activityStatus="inactive"
        shell={undefined}
        showUnreadActivity={false}
        isActive={false}
      />
    )

    expect(markup).toContain('data-shell-icon="generic"')
    expect(markup).not.toContain('data-testid="tab-agent-activity-indicator"')
  })

  it('fills the done dot after an unvisited completion', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider>
        <TerminalTabLeadingIcon
          agent="codex"
          activityStatus="done"
          shell={undefined}
          showUnreadActivity={true}
          isActive={false}
        />
      </TooltipProvider>
    )

    expect(markup).toContain('bg-agent-done')
    expect(markup).toContain('aria-label="Done, not seen yet"')
    expect(markup).toContain('data-agent-icon="codex"')
    expect(markup).not.toContain('data-testid="tab-activity-bell"')
  })
})
