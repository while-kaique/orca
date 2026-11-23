import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import { getVerifiedNativeChatCommands } from '../../../../shared/native-chat/native-chat-agent-profiles'

const COMMAND_TOKEN_STYLE = 'color: var(--text-link, #58a6ff)'

/** Fork: a leading `/command` the agent knows reads in link blue, typed or picked. */
export const NativeChatCommandTokenDecoration = Extension.create<{
  isKnown: (name: string) => boolean
}>({
  name: 'nativeChatCommandToken',
  addOptions() {
    return { isKnown: () => false }
  },
  addProseMirrorPlugins() {
    const isKnown = (name: string): boolean => this.options.isKnown(name)
    return [
      new Plugin({
        key: new PluginKey('nativeChatCommandToken'),
        props: {
          decorations(state) {
            const first = state.doc.firstChild
            const lead = first?.firstChild
            // Offsets below hold only while the first paragraph opens with plain text.
            const token = lead?.isText ? /^\/([^\s/]+)/u.exec(lead.text ?? '') : null
            if (!token || !isKnown(token[1]!)) {
              return null
            }
            return DecorationSet.create(state.doc, [
              Decoration.inline(1, 1 + token[0].length, { style: COMMAND_TOKEN_STYLE })
            ])
          }
        }
      })
    ]
  }
})

export function nativeChatKnownCommand(agent: string | undefined): (name: string) => boolean {
  const names = new Set(
    agent ? getVerifiedNativeChatCommands(agent as AgentType).map((command) => command.name) : []
  )
  return (name) => names.has(name)
}
