import type { Metadata } from 'next'
import './globals.css'
import NavMenu from '@/components/ui/nav-menu'
import SwRegister from '@/components/pwa/sw-register'
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
      </body>
    </html>
  )
}
