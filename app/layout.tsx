import type { Metadata, Viewport } from 'next'
import './globals.css'
import NavMenu from '@/components/ui/nav-menu'
import SwRegister from '@/components/pwa/sw-register'
import ZoomLock from '@/components/pwa/zoom-lock'
import AuthGate from '@/components/auth/auth-gate'

export const metadata: Metadata = {
  title: 'ระบบเช็คชื่อศูนย์การศึกษาพิเศษ',
  description: 'ระบบเช็คชื่อด้วย Face Recognition สำหรับศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'เช็คชื่อศูนย์การศึกษาพิเศษ',
  },
}

// Lock zoom — kiosk-style PWA. Without this teachers easily double-tap
// or pinch by accident while scanning and the camera frame gets out of
// alignment.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body>
        <span className="fixed top-5 left-4 z-50 text-[10px] text-gray-300 pointer-events-none">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
        <AuthGate>
          <NavMenu />
          {children}
        </AuthGate>
        <SwRegister />
        <ZoomLock />
      </body>
    </html>
  )
}
