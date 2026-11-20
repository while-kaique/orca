import { useCallback, useState } from 'react'
import type { NativeChatOptionPickerRequest } from './native-chat-composer-types'

/** Fork: a bare `/model` in a terminal chat opens the composer's Model picker instead of Claude's terminal menu. */
export function useNativeChatPtyModelPicker(modelId: string | null): {
  request: NativeChatOptionPickerRequest | null
  open: () => boolean
} {
  const [request, setRequest] = useState<NativeChatOptionPickerRequest | null>(null)
  const open = useCallback(() => {
    if (modelId === null) {
      return false
    }
    // The model's own id: the picker opens on its model list, not on a sibling option.
    setRequest({ id: modelId, consume: () => setRequest(null) })
    return true
  }, [modelId])
  return { request, open }
}

export function isBareModelCommand(draft: string): boolean {
  return draft.trim().toLowerCase() === '/model'
}
