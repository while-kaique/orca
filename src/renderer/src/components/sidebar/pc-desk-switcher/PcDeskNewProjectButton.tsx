import React from 'react'
import { Plus } from 'lucide-react'
import { PcDeskProjectPicker } from './PcDeskProjectPicker'

/** PC-desk mode: fixed "+" under the open chats — a new chat (own row) in a Projetos folder, or a new project. */
export function PcDeskNewProjectButton(): React.JSX.Element {
  return (
    <div className="shrink-0 px-2 pt-1 pb-2">
      <PcDeskProjectPicker
        trigger={
          <button
            type="button"
            aria-label="Abrir ou criar projeto"
            aria-haspopup="dialog"
            className="dashed-outline-spaced flex h-8 w-full items-center justify-center rounded-lg bg-sidebar-accent/25 text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground data-[state=open]:bg-sidebar-accent/60 data-[state=open]:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        }
      />
    </div>
  )
}
