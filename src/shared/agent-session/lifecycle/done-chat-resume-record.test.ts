import { describe, expect, it } from 'vitest'
import { liveResumeRecord, statusRetainsResumableIdentity } from './agent-resume-record-from-status'
import type { ResumeRecordStatus } from './agent-resume-record-from-status'

// Fork (PC-desk) guard: an idle chat (finished turn, waiting on the user) must keep a resume
// record, or a power-off brings it back as a bare shell. Upstream covers this with live records.
describe('finished Claude chat resume record', () => {
  const entry: ResumeRecordStatus = {
    paneKey: 'tab-1:leaf-1',
    agentType: 'claude',
    state: 'done',
    prompt: 'last prompt',
    updatedAt: 1_000,
    providerSession: { key: 'session_id', id: 'd74a6471-0d66-4d92-b4be-328a4a3b6497' },
    lastAssistantMessage: 'last answer',
    worktreeId: 'repo::C:/proj'
  }

  it('keeps a resumable record for a done Claude status', () => {
    const record = liveResumeRecord({
      entry,
      retainsResumableIdentity: statusRetainsResumableIdentity(entry, entry.providerSession),
      worktreeIdOf: () => 'repo::C:/proj',
      tabOf: () => ({ id: 'tab-1' }),
      capturedAt: 2_000
    })
    expect(record).toMatchObject({
      paneKey: 'tab-1:leaf-1',
      tabId: 'tab-1',
      agent: 'claude',
      state: 'done',
      origin: 'live',
      providerSession: entry.providerSession
    })
  })

  it('leaves no record when the done status has no provider session', () => {
    const withoutSession = { ...entry, providerSession: undefined }
    expect(
      liveResumeRecord({
        entry: withoutSession,
        retainsResumableIdentity: statusRetainsResumableIdentity(withoutSession, undefined),
        worktreeIdOf: () => 'repo::C:/proj',
        tabOf: () => undefined,
        capturedAt: 2_000
      })
    ).toBeNull()
  })
})
