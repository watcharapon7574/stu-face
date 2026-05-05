'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getSavedTeacher } from '@/lib/teacher-store'
import LoginForm from './login-form'

type Status = 'loading' | 'unauth' | 'auth'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    setStatus(getSavedTeacher() ? 'auth' : 'unauth')

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'stu-face-teacher') {
        setStatus(getSavedTeacher() ? 'auth' : 'unauth')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
      </main>
    )
  }

  if (status === 'unauth') {
    return (
      <main className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="max-w-md w-full">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src="/std2.png" alt="Logo" className="w-12 h-12 object-contain" />
            <div className="text-left">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                ระบบเช็คชื่อ
              </h1>
              <p className="text-xs text-gray-400">
                ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี
              </p>
            </div>
          </div>
          <LoginForm onLoggedIn={() => setStatus('auth')} />
        </div>
      </main>
    )
  }

  return <>{children}</>
}
