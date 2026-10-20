import { describe, expect, it } from 'vitest'
import { buildProcessTableIndex, collectDescendantsFromIndex } from './process-table-index'

describe('collectDescendantsFromIndex', () => {
  it('terminates on a ppid cycle left by Windows PID reuse', () => {
    const rows = [
      { pid: 100, ppid: 1 },
      { pid: 200, ppid: 100 },
      { pid: 300, ppid: 200 },
      // Recycled PID: 200's ppid points back into its own subtree.
      { pid: 100, ppid: 300 }
    ]
    const descendants = collectDescendantsFromIndex(buildProcessTableIndex(rows), 100)
    expect(descendants.map((row) => row.pid)).toEqual([200, 300])
  })

  it('terminates on a two-process cycle below the root', () => {
    const rows = [
      { pid: 10, ppid: 1 },
      { pid: 20, ppid: 30 },
      { pid: 30, ppid: 20 },
      { pid: 30, ppid: 10 }
    ]
    const descendants = collectDescendantsFromIndex(buildProcessTableIndex(rows), 10)
    expect(descendants.map((row) => row.pid)).toEqual([30, 20])
  })

  it('keeps depth-first, last-pushed-first order and depths', () => {
    const rows = [
      { pid: 1, ppid: 0 },
      { pid: 2, ppid: 1 },
      { pid: 3, ppid: 1 },
      { pid: 4, ppid: 2 }
    ]
    const descendants = collectDescendantsFromIndex(buildProcessTableIndex(rows), 1)
    expect(descendants.map(({ pid, depth }) => [pid, depth])).toEqual([
      [3, 1],
      [2, 1],
      [4, 2]
    ])
  })
})
