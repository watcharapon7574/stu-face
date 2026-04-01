'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ScanFace } from 'lucide-react'
import { getSavedTeacher } from '@/lib/teacher-store'
import { isTeacherCheckedInToday } from '@/lib/teacher-checkin-store'

export default function CheckinBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const teacher = getSavedTeacher()
    if (teacher && !isTeacherCheckedInToday(teacher.id)) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <a
      href="/teacher-checkin"
      className="block bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 hover:bg-amber-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-800 font-medium">
            ยังไม่ได้สแกนเข้างาน
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            กดเพื่อสแกนหน้าเข้างานก่อนเช็คชื่อนักเรียน
          </p>
        </div>
        <ScanFace className="w-5 h-5 text-amber-500 shrink-0" />
      </div>
    </a>
  )
}
