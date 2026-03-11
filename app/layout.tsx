import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
