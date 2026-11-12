import { createdChatLinkPath, projectChatPath, type LineObstacle } from './canvas-chat-line-paths'
import { isFreeChat, type CanvasBox, type CanvasProject } from './canvas-chats-layout'
import { chatVisualBox } from './canvas-chat-shape'

/** Project → chat and chat → the chats it created; each line leaves the side that faces the other card. */
export function canvasChatTreeLines(
  projects: readonly CanvasProject[],
  boxes: Readonly<Record<string, CanvasBox>>
): React.JSX.Element[] {
  const lines: React.JSX.Element[] = []
  // Lines touch what is drawn: a slim planner or a round executor is smaller than its slot.
  const drawnBoxes = new Map<string, CanvasBox>()
  for (const project of projects) {
    for (const chat of project.chats) {
      const slot = boxes[chat.key]
      if (slot) {
        drawnBoxes.set(chat.key, chatVisualBox(chat, slot))
      }
    }
  }
  // Every card on the board: a line goes around the ones that are not its own two ends.
  const obstacles: LineObstacle[] = [
    ...projects.flatMap((project) => {
      const box = boxes[`project:${project.id}`]
      return box ? [{ box }] : []
    }),
    ...[...drawnBoxes.values()].map((box) => ({ box }))
  ]
  for (const project of projects) {
    const pbox = boxes[`project:${project.id}`]
    const chatByKey = new Map(project.chats.map((chat) => [chat.key, chat]))
    for (const chat of project.chats) {
      const cbox = drawnBoxes.get(chat.key)
      const creator = chat.parentKey ? chatByKey.get(chat.parentKey) : undefined
      // Free chats hang off the project only, and a free chat never creates a hierarchy chat's line.
      const creatorBox =
        creator && !isFreeChat(creator) && !isFreeChat(chat)
          ? drawnBoxes.get(creator.key)
          : undefined
      if (pbox && cbox && isFreeChat(chat)) {
        lines.push(
          <path
            key={`f-${chat.key}`}
            className="cc-line-tree"
            d={projectChatPath(pbox, cbox, obstacles)}
          />
        )
      } else if (creatorBox && cbox) {
        lines.push(
          <path
            key={`c-${chat.key}`}
            className="cc-line-tree cc-line-created"
            d={createdChatLinkPath(creatorBox, cbox, obstacles)}
          />
        )
      } else if (pbox && cbox) {
        lines.push(
          <path
            key={`b-${chat.key}`}
            className="cc-line-tree"
            d={projectChatPath(pbox, cbox, obstacles)}
          />
        )
      }
    }
  }
  return lines
}
