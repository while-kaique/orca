import { useMemo } from 'react'
import type { ITheme } from '@xterm/xterm'
import { composeActiveTerminalTheme } from '@/components/terminal-pane/terminal-appearance'
import { useSystemPrefersDark } from '@/components/terminal-pane/use-system-prefers-dark'
import { resolveEffectiveTerminalAppearance } from '@/lib/terminal-theme'
import { useAppStore } from '@/store'

/** Same terminal theme the open card's terminal uses. */
export function useCanvasTerminalTheme(): ITheme | null {
  const settings = useAppStore((state) => state.settings)
  const systemPrefersDark = useSystemPrefersDark()
  return useMemo(() => {
    if (!settings) {
      return null
    }
    const appearance = resolveEffectiveTerminalAppearance(settings, systemPrefersDark)
    return composeActiveTerminalTheme(appearance.theme, settings)
  }, [settings, systemPrefersDark])
}
