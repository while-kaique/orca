import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitWorktreeInfo } from '../../../../shared/worktree/types'
import {
  _setWorktreeListResultCacheEnabledForTests,
  invalidateWorktreeListResults,
  readWorktreeListShared
} from './worktree-list-result-cache'

const LIST = [{ path: 'C:/repo', head: 'abc', branch: 'main' }] as unknown as GitWorktreeInfo[]

describe('readWorktreeListShared', () => {
  beforeEach(() => _setWorktreeListResultCacheEnabledForTests(true))
  afterEach(() => {
    vi.useRealTimers()
    _setWorktreeListResultCacheEnabledForTests(false)
  })

  it('shares one spawn between overlapping and recent callers', async () => {
    const run = vi.fn(async () => LIST)
    const [a, b] = await Promise.all([
      readWorktreeListShared('C:/repo', undefined, undefined, run),
      readWorktreeListShared('C:/repo', undefined, undefined, run)
    ])
    const c = await readWorktreeListShared('C:/repo', undefined, undefined, run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(a).toEqual(LIST)
    expect(c).toEqual(LIST)
    // Callers get their own copies.
    expect(a[0]).not.toBe(b[0])
  })

  it('spawns again after the TTL, after invalidation and after a failure', async () => {
    vi.useFakeTimers()
    const run = vi.fn(async () => LIST)
    await readWorktreeListShared('C:/repo', undefined, undefined, run)
    vi.advanceTimersByTime(3_001)
    await readWorktreeListShared('C:/repo', undefined, undefined, run)
    invalidateWorktreeListResults('C:/repo')
    await readWorktreeListShared('C:/repo', undefined, undefined, run)
    expect(run).toHaveBeenCalledTimes(3)

    const failing = vi.fn(async (): Promise<GitWorktreeInfo[]> => {
      throw new Error('boom')
    })
    invalidateWorktreeListResults('C:/repo')
    await expect(readWorktreeListShared('C:/repo', undefined, undefined, failing)).rejects.toThrow()
    await readWorktreeListShared('C:/repo', undefined, undefined, run)
    expect(run).toHaveBeenCalledTimes(4)
  })

  it('keeps WSL distros apart and never seeds from an abortable caller', async () => {
    const run = vi.fn(async () => LIST)
    await readWorktreeListShared('C:/repo', 'Ubuntu', undefined, run)
    await readWorktreeListShared('C:/repo', undefined, undefined, run)
    expect(run).toHaveBeenCalledTimes(2)

    const signalRun = vi.fn(async () => LIST)
    await readWorktreeListShared('C:/other', undefined, new AbortController().signal, signalRun)
    await readWorktreeListShared('C:/other', undefined, undefined, signalRun)
    expect(signalRun).toHaveBeenCalledTimes(2)
  })
})
