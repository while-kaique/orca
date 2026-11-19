import { useMemo } from 'react'
import { nativeChatStreamingMessage } from '../../../../shared/native-chat/native-chat-streaming'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'
import {
  commandMarkersAsMessages,
  type NativeChatCommandMarker
} from './native-chat-command-marker'
import { nativeChatStoppedNoticeMessages } from './native-chat-stopped-notice'

/** The session plus the rows that trail the transcript: command feedback, the stop notice, the live preview, pending sends. */
export function useNativeChatSessionWithTail<
  S extends { messages: readonly NativeChatMessage[] }
>(args: {
  session: S
  commandMarkers: readonly NativeChatCommandMarker[]
  stopped: boolean
  streamingText: string | null
  pendingMessages: readonly NativeChatMessage[]
}): S {
  const { session, commandMarkers, stopped, streamingText, pendingMessages } = args
  return useMemo(() => {
    if (!pendingMessages.length && !commandMarkers.length && !stopped && !streamingText) {
      return session
    }
    return {
      ...session,
      messages: [
        ...session.messages,
        ...commandMarkersAsMessages(commandMarkers),
        ...nativeChatStoppedNoticeMessages(stopped),
        ...(streamingText ? [nativeChatStreamingMessage(streamingText)] : []),
        ...pendingMessages
      ]
    }
  }, [session, commandMarkers, stopped, streamingText, pendingMessages])
}
