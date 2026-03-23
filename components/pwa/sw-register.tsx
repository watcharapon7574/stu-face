'use client'

import { useEffect } from 'react'

const CHECK_INTERVAL = 60_000
const RELOAD_GUARD_KEY = 'sw-reload-ts'
const RELOAD_GUARD_MS = 10_000

export default function SwRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'development') return

    let registration: ServiceWorkerRegistration | null = null

    const registerAndPoll = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        })

        // Poll for updates
        setInterval(() => {
          registration?.update()
        }, CHECK_INTERVAL)

        // Listen for new SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration!.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready — tell it to activate
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      } catch (err) {
        console.error('[SW] Registration failed:', err)
      }
    }

    // When new SW takes over → reload with loop protection
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
      if (Date.now() - lastReload < RELOAD_GUARD_MS) return
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
      window.location.reload()
    })

    registerAndPoll()
  }, [])

  return null
}
