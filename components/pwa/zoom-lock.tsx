'use client'

import { useEffect } from 'react'

/**
 * Belt-and-suspenders zoom blocker for iOS Safari, which ignores
 * `user-scalable=no` and the CSS `touch-action` hint when the page
 * is added to the home screen as a PWA. We swallow the gesture* /
 * multi-touch events directly so pinch-zoom and double-tap-zoom
 * never start.
 */
export default function ZoomLock() {
  useEffect(() => {
    const cancel = (e: Event) => e.preventDefault()

    // iOS Safari fires these on pinch — ignore.
    document.addEventListener('gesturestart', cancel as EventListener, { passive: false })
    document.addEventListener('gesturechange', cancel as EventListener, { passive: false })
    document.addEventListener('gestureend', cancel as EventListener, { passive: false })

    // Block two-finger touchmove (covers Android + iOS belt).
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('touchmove', blockMultiTouch, { passive: false })

    // Block fast double-tap zoom (iOS triggers it on <300ms gap).
    let lastTouch = 0
    const blockDoubleTap = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouch < 350) e.preventDefault()
      lastTouch = now
    }
    document.addEventListener('touchend', blockDoubleTap, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', cancel as EventListener)
      document.removeEventListener('gesturechange', cancel as EventListener)
      document.removeEventListener('gestureend', cancel as EventListener)
      document.removeEventListener('touchmove', blockMultiTouch)
      document.removeEventListener('touchend', blockDoubleTap)
    }
  }, [])

  return null
}
