import { describe, expect, it, vi } from 'vitest'
import { killWithDescendantSweep } from './pty-descendant-termination'
import {
  collectWindowsDescendants,
  terminateWindowsDescendantSurvivors
} from './windows-detached-descendant-sweep'

// Shell 100 > claude 200 > bash 300 > ping 400 (detached, breaks away from the job); 500 is unrelated.
const TABLE = [
  { pid: 100, ppid: 1, name: 'powershell.exe', creationTimeMs: 1000 },
  { pid: 200, ppid: 100, name: 'claude.exe', creationTimeMs: 1100 },
  { pid: 300, ppid: 200, name: 'bash.exe', creationTimeMs: 1200 },
  { pid: 400, ppid: 300, name: 'PING.EXE', creationTimeMs: 1300 },
  { pid: 500, ppid: 7, name: 'claude.exe', creationTimeMs: 900 }
]

describe('windows detached descendant sweep', () => {
  it('captures the whole tree under the terminal root and nothing else', () => {
    expect(collectWindowsDescendants(100, TABLE)?.map((p) => p.pid)).toEqual([200, 300, 400])
  })

  it('skips a recycled PID that is older than the parent it names', () => {
    const table = [...TABLE, { pid: 600, ppid: 400, name: 'node.exe', creationTimeMs: 50 }]
    expect(collectWindowsDescendants(100, table)?.map((p) => p.pid)).toEqual([200, 300, 400])
  })

  it('ends only survivors that are still the same process', async () => {
    const kill = vi.fn()
    // After the job: the ping survived; 300 was reused by another process.
    const after = [
      { pid: 400, ppid: 300, name: 'PING.EXE', creationTimeMs: 1300 },
      { pid: 300, ppid: 9, name: 'notepad.exe', creationTimeMs: 9000 }
    ]
    const ended = await terminateWindowsDescendantSurvivors(
      [
        { pid: 300, creationTimeMs: 1200 },
        { pid: 400, creationTimeMs: 1300 }
      ],
      { readTable: async () => after, kill, ownerPid: 1, ownChromiumPids: new Set() }
    )
    expect(ended).toEqual([400])
    expect(kill).toHaveBeenCalledExactlyOnceWith(400)
  })

  it('still sweeps captured descendants after the job reports the tree terminated', async () => {
    const terminateWindowsSurvivors = vi.fn(async () => [400])
    await killWithDescendantSweep(100, () => {}, {
      platform: 'win32',
      terminateOwnedTree: () => 'terminated',
      captureWindowsDescendants: async () => [{ pid: 400, creationTimeMs: 1300 }],
      terminateWindowsSurvivors
    })
    expect(terminateWindowsSurvivors).toHaveBeenCalledExactlyOnceWith([
      { pid: 400, creationTimeMs: 1300 }
    ])
  })
})
