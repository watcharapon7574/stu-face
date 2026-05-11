'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Loader2, User } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface TeacherOpt {
  id: string
  name: string
  nickname: string | null
  workplace?: string | null
  service_point_id?: string | null
}

interface Props {
  hqServicePointId: string | null
  onConfirm: (teacherName: string) => void
  onCancel: () => void
}

// Per-device tally of how often each picked teacher has been used.
// Stored in localStorage so the most-frequent shows up first without
// extra DB roundtrips. Key is stable across reloads of the kiosk.
const STORAGE_KEY = 'kiosk-teacher-history'

interface TallyEntry {
  count: number
  last_used: string
}

function loadTally(): Record<string, TallyEntry> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveTally(name: string) {
  if (typeof window === 'undefined') return
  const t = loadTally()
  const prev = t[name]
  t[name] = {
    count: (prev?.count || 0) + 1,
    last_used: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
}

export default function TeacherPickerModal({
  hqServicePointId,
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<TeacherOpt[]>([])
  const [selectedName, setSelectedName] = useState<string>('')
  const [tally, setTally] = useState<Record<string, TallyEntry>>({})

  useEffect(() => {
    setTally(loadTally())
  }, [])

  useEffect(() => {
    let mounted = true
    const url = hqServicePointId
      ? `/api/teachers?service_point_id=${hqServicePointId}`
      : '/api/teachers'
    apiFetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        const list: TeacherOpt[] = data.teachers || []
        setTeachers(list)
        setLoading(false)
      })
      .catch(() => {
        if (mounted) {
          setError('โหลดรายชื่อครูไม่สำเร็จ')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [hqServicePointId])

  // Sort by usage frequency (per-device tally) desc, then alphabetical.
  const sorted = useMemo(() => {
    return [...teachers].sort((a, b) => {
      const ac = tally[a.name]?.count || 0
      const bc = tally[b.name]?.count || 0
      if (ac !== bc) return bc - ac
      return a.name.localeCompare(b.name, 'th')
    })
  }, [teachers, tally])

  // Default-select the most-used teacher once both are loaded.
  useEffect(() => {
    if (!selectedName && sorted.length > 0) {
      setSelectedName(sorted[0].name)
    }
  }, [sorted, selectedName])

  const submit = () => {
    const name = selectedName.trim()
    if (!name) {
      setError('กรุณาเลือกครู')
      return
    }
    setSubmitting(true)
    setError(null)
    saveTally(name)
    onConfirm(name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-md border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-500" />
            ครูคนใดเป็นคนทำรายการ
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            เลือกครูที่ทำหน้าที่รับ-ส่งนักเรียนคนนี้
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              ไม่พบรายชื่อครู
            </p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {sorted.map((t) => {
                const active = selectedName === t.name
                const used = tally[t.name]?.count || 0
                const label = t.nickname ? `${t.name} (${t.nickname})` : t.name
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedName(t.name)}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition text-left ${
                      active
                        ? 'bg-cyan-50 border-cyan-300 text-cyan-900'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm font-medium flex items-center gap-2 truncate">
                      {active && <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />}
                      {label}
                    </span>
                    {used > 0 && (
                      <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                        {used}×
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs text-center">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || loading || !selectedName}
              className="flex-1"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              ยืนยัน
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
