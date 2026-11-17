import { describe, expect, it } from 'vitest'
import { closeSuspendingAllChats } from './fork-close-suspend-all'

describe('closeSuspendingAllChats', () => {
  it('suspends all chats, then records the cut, then lets the close go on (the quit sweep ends what is left)', async () => {
    const steps: string[] = []
    await closeSuspendingAllChats({
      suspendAll: async () => steps.push('suspender-todos'),
      recordCut: async () => steps.push('registrar-corte'),
      proceed: () => steps.push('seguir')
    })
    expect(steps).toEqual(['suspender-todos', 'registrar-corte', 'seguir'])
  })

  it('does not hold the close when the batch fails', async () => {
    const steps: string[] = []
    await closeSuspendingAllChats({
      suspendAll: () => Promise.reject(new Error('janela travada')),
      recordCut: async () => steps.push('registrar-corte'),
      proceed: () => steps.push('seguir')
    })
    expect(steps).toEqual(['registrar-corte', 'seguir'])
  })
})
