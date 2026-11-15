import { STATUS_LABEL } from './CanvasChatsNodes'

const LEGEND_ORDER = [
  'idle',
  'working',
  'monitoring',
  'team',
  'unseen',
  'seen',
  'waiting',
  'suspended'
] as const

/** Fork: the flowchart's color key, one entry per card state. */
export function CanvasChatsLegend(): React.JSX.Element {
  return (
    <div className="cc-legend" onPointerDown={(e) => e.stopPropagation()}>
      {LEGEND_ORDER.map((s) => (
        <span key={s} data-status={s}>
          <em />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  )
}
