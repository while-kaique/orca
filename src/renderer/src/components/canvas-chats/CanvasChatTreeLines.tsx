import { busPath, busPathUp, childChatPath } from './canvas-chat-line-paths'
import { isFreeChat, type CanvasBox, type CanvasProject } from './canvas-chats-layout'
import { chatVisualBox } from './canvas-chat-shape'

/** Project → chat (up to a free chat, down to a hierarchy chat), chat → the chats it created. */
export function canvasChatTreeLines(
  projects: readonly CanvasProject[],
  boxes: Readonly<Record<string, CanvasBox>>
): React.JSX.Element[] {
  const lines: React.JSX.Element[] = []
  for (const project of projects) {
    const pbox = boxes[`project:${project.id}`]
    const chatByKey = new Map(project.chats.map((chat) => [chat.key, chat]))
    // Lines touch what is drawn: a slim planner or a round executor is smaller than its slot.
    const drawn = (key: string): CanvasBox | undefined => {
      const chat = chatByKey.get(key)
      const slot = boxes[key]
      return chat && slot ? chatVisualBox(chat, slot) : slot
    }
    for (const chat of project.chats) {
      const cbox = drawn(chat.key)
      const creator = chat.parentKey ? chatByKey.get(chat.parentKey) : undefined
      // Free chats hang off the project only, and a free chat never creates a hierarchy chat's line.
      const creatorBox =
        creator && !isFreeChat(creator) && !isFreeChat(chat) ? drawn(creator.key) : undefined
      if (pbox && cbox && isFreeChat(chat)) {
        lines.push(
          <path key={`f-${chat.key}`} className="cc-line-tree" d={busPathUp(pbox, cbox)} />
        )
      } else if (creatorBox && cbox) {
        lines.push(
          <path
            key={`c-${chat.key}`}
            className="cc-line-tree cc-line-created"
            d={childChatPath(creatorBox, cbox)}
          />
        )
      } else if (pbox && cbox) {
        lines.push(<path key={`b-${chat.key}`} className="cc-line-tree" d={busPath(pbox, cbox)} />)
      }
    }
  }
  return lines
}
