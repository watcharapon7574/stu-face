'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { getSavedTeacher, saveTeacher, type SavedTeacher } from '@/lib/teacher-store'
import {
  matchWorkplaceToServicePoint,
  matchWorkplaceToClassroom,
  type ServicePointLike,
  type ClassroomLike,
} from '@/lib/workplace-match'
import WorkplacePromptModal from '@/components/attendance/workplace-prompt-modal'

interface SPRow extends ServicePointLike {
  id: string
}

interface ClassroomRow extends ClassroomLike {
  id: string
}

type Status = 'loading' | 'ok' | 'needs_workplace'

// After AuthGate confirms the user is logged in, this gate verifies that
// the teacher's stored workplace matches one of the canonical service
// points or classrooms in the database. If it doesn't, the user is held
// behind a blocking modal until they pick a valid value — workplace is
// what gates access to per-unit student data and the dashboard view.
export default function WorkplaceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [teacher, setTeacher] = useState<SavedTeacher | null>(null)
  const [servicePoints, setServicePoints] = useState<SPRow[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([])

  const refresh = useCallback(async () => {
    const saved = getSavedTeacher()
    if (!saved) {
      // AuthGate will redirect to login on its own.
      setStatus('ok')
      return
    }
    setTeacher(saved)

    try {
      const [spRes, clRes, profRes] = await Promise.all([
        fetch('/api/service-points', { cache: 'no-store' }),
        fetch('/api/classrooms', { cache: 'no-store' }),
        fetch(`/api/profiles/${saved.id}`, { cache: 'no-store' }),
      ])
      const spData = await spRes.json()
      const clData = await clRes.json()
      const profData = await profRes.json()

      const sps = (spData.service_points || []) as SPRow[]
      const cls = (clData.classrooms || []) as ClassroomRow[]
      setServicePoints(sps)
      setClassrooms(cls)

      // Always trust the latest server value over the cached one — an
      // admin may have just edited the teacher's workplace.
      const serverWp = (profData?.profile?.workplace as string | null) ?? null
      if (serverWp !== (saved.workplace ?? null)) {
        const updated = { ...saved, workplace: serverWp }
        saveTeacher(updated)
        setTeacher(updated)
      }

      const wp = serverWp
      const matchedSP = matchWorkplaceToServicePoint(wp, sps)
      const matchedClass = matchWorkplaceToClassroom(wp, cls)

      if (!wp || !wp.trim() || (!matchedSP && !matchedClass)) {
        setStatus('needs_workplace')
      } else {
        setStatus('ok')
      }
    } catch {
      // Network down — fall back to the locally cached workplace if it
      // still matches anything we already know. Without service-point
      // data we can't validate, so let the user through; the per-page
      // gate (AttendanceFlow) will catch it on the next mount.
      setStatus('ok')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleSave = async (workplace: string) => {
    if (!teacher) return

    const res = await fetch(`/api/profiles/${teacher.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workplace }),
    })
    if (!res.ok) throw new Error('failed')

    const matchedSP = matchWorkplaceToServicePoint(workplace, servicePoints)
    const matchedClass = matchWorkplaceToClassroom(workplace, classrooms)
    if (!matchedSP && !matchedClass) {
      const updated = { ...teacher, workplace }
      saveTeacher(updated)
      setTeacher(updated)
      throw new Error('no_match')
    }

    const updated = { ...teacher, workplace }
    saveTeacher(updated)
    setTeacher(updated)
    setStatus('ok')
  }

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
      </main>
    )
  }

  if (status === 'needs_workplace' && teacher) {
    return (
      <>
        {/* Dimmed background so it's obvious the rest of the app is locked. */}
        <main className="min-h-screen bg-gray-50" aria-hidden />
        <WorkplacePromptModal
          teacherName={teacher.nickname || teacher.name}
          servicePoints={servicePoints}
          classrooms={classrooms}
          onSave={handleSave}
        />
      </>
    )
  }

  return <>{children}</>
}
