import { useCallback, useEffect } from 'react'

export const focusTargetClass = 'focus:outline-3 focus:outline-offset-3 focus:outline-brand-focus'
export const focusTargetScrollMarginClass = 'scroll-mt-6'

export function focusElementWithScroll(element: HTMLElement | null) {
  if (!element) {
    return
  }

  element.focus({ preventScroll: true })
  element.scrollIntoView({ block: 'start' })
}

function readHashTargetId(hash: string) {
  const rawValue = hash.startsWith('#') ? hash.slice(1) : hash
  if (!rawValue) {
    return null
  }

  try {
    return decodeURIComponent(rawValue)
  } catch {
    return rawValue
  }
}

export function useHashTargetFocus(
  focusElement: (element: HTMLElement | null) => void = focusElementWithScroll,
  resolveTarget?: (targetId: string) => HTMLElement | null,
) {
  const focusHashTarget = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const targetId = readHashTargetId(window.location.hash)
    if (!targetId) {
      return
    }

    window.setTimeout(() => {
      const target = resolveTarget?.(targetId) ?? document.getElementById(targetId)
      focusElement(target instanceof HTMLElement ? target : null)
    }, 0)
  }, [focusElement, resolveTarget])

  useEffect(() => {
    focusHashTarget()
    window.addEventListener('hashchange', focusHashTarget)

    return () => {
      window.removeEventListener('hashchange', focusHashTarget)
    }
  }, [focusHashTarget])

  return focusHashTarget
}
