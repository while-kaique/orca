/** A transformed ancestor (the zoomed canvas board) makes `position: fixed` relative to itself, not the window. */
function establishesFixedContainingBlock(element: HTMLElement): boolean {
  const style = getComputedStyle(element)
  return (
    style.transform !== 'none' ||
    style.perspective !== 'none' ||
    style.filter !== 'none' ||
    (style.backdropFilter !== undefined && style.backdropFilter !== 'none') ||
    style.willChange.includes('transform') ||
    style.contain.includes('paint')
  )
}

export type NativeChatFixedMenuFrame = { left: number; width: number; bottom: number }

/** Fixed-position offsets that put a menu just above `anchor`, in the coordinate space of `container`'s fixed containing block. */
export function nativeChatFixedMenuFrame(
  anchor: DOMRect,
  container: HTMLElement,
  gap: number
): NativeChatFixedMenuFrame {
  let block: HTMLElement | null = container
  while (block && block !== document.body && !establishesFixedContainingBlock(block)) {
    block = block.parentElement
  }
  if (!block || block === document.body) {
    return {
      left: anchor.left,
      width: anchor.width,
      bottom: window.innerHeight - anchor.top + gap
    }
  }
  const rect = block.getBoundingClientRect()
  const scale = block.offsetWidth > 0 ? rect.width / block.offsetWidth : 1
  return {
    left: (anchor.left - rect.left) / scale,
    width: anchor.width / scale,
    bottom: (rect.bottom - anchor.top) / scale + gap
  }
}

export function sameMenuFrame(
  a: NativeChatFixedMenuFrame | null,
  b: NativeChatFixedMenuFrame
): boolean {
  return a?.left === b.left && a.width === b.width && a.bottom === b.bottom
}
