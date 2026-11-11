import { Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { PcDeskProjectPicker } from '../sidebar/pc-desk-switcher/PcDeskProjectPicker'

/** Same project search as the sidebar "+": a new chat in the picked project, or "Criar projeto". */
export function CanvasAddProjectButton(): React.JSX.Element {
  const label = translate('fork.canvas.addProject', 'Novo chat ou projeto')
  return (
    // The search is portaled but still bubbles through React: keep its clicks and scrolling off the board's pan and zoom.
    <div onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <PcDeskProjectPicker
        side="top"
        align="end"
        // Opening the chat activates its workspace; come back to the flowchart.
        onChatOpened={() => {
          if (useAppStore.getState().activeView !== 'canvas') {
            useAppStore.getState().openCanvasPage()
          }
        }}
        trigger={
          <button type="button" className="cc-add" aria-label={label} title={label}>
            <Plus size={15} />
            {label}
          </button>
        }
      />
    </div>
  )
}
