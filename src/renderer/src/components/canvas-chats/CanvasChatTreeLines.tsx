import {
  busPath,
  childChatPath,
  elbowPath,
  type CanvasBox,
  type CanvasProject
} from './canvas-chats-layout'

/** Project → chat, chat → the chats it created, chat → what hangs off it. */
export function canvasChatTreeLines(
  projects: readonly CanvasProject[],
  boxes: Readonly<Record<string, CanvasBox>>
): React.JSX.Element[] {
  const lines: React.JSX.Element[] = []
  for (const project of projects) {
    const pbox = boxes[`project:${project.id}`]
    for (const chat of project.chats) {
      const cbox = boxes[chat.key]
      const creatorBox = chat.parentKey ? boxes[chat.parentKey] : undefined
      if (creatorBox && cbox) {
        lines.push(
          <path
            key={`c-${chat.key}`}
            className="cc-line-tree cc-line-created"
            style={{ stroke: project.color }}
            d={childChatPath(creatorBox, cbox)}
          />
        )
      } else if (pbox && cbox) {
        lines.push(<path key={`b-${chat.key}`} className="cc-line-tree" d={busPath(pbox, cbox)} />)
      }
      for (const agent of [...chat.agents, ...chat.extras]) {
        const abox = boxes[agent.id]
        if (cbox && abox) {
          lines.push(
            <path key={`e-${agent.id}`} className="cc-line-tree" d={elbowPath(cbox, abox)} />
          )
        }
      }
    }
  }
  return lines
}
