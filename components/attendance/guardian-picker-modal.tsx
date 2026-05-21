'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Loader2, Plus, User } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface GuardianRow {
  name: string
  count: number
  last_used: string
}

interface Props {
  studentId: string
  studentName: string
  type: 'check_in' | 'check_out'
  onConfirm: (guardian: string) => void | Promise<void>
  onCancel: () => void
}

export default function GuardianPickerModal({
  studentId,
  studentName,
  type,
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardians, setGuardians] = useState<GuardianRow[]>([])
  const [selected, setSelected] = useState<string>('')
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    apiFetch(`/api/students/${studentId}/guardians`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        const list: GuardianRow[] = data.guardians || []
        setGuardians(list)
        if (list.length > 0) {
          setSelected(list[0].name) // most-used = pre-selected
          setAddingNew(false)
        } else {
          setAddingNew(true) // first time: go straight to input
        }
        setLoading(false)
      })
      .catch(() => {
        if (mounted) {
          setError('โหลดประวัติผู้ปกครองไม่สำเร็จ')
          setAddingNew(true)
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [studentId])

  useEffect(() => {
    if (addingNew) {
      // give the input a tick to mount before focusing
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [addingNew])

  const label = type === 'check_in' ? 'ใครเป็นคนพามาส่ง' : 'ใครเป็นคนมารับ'

  const value = useMemo(() => (addingNew ? newName.trim() : selected.trim()), [addingNew, newName, selected])

  const submit = async () => {
    if (!value) {
      setError('กรุณาเลือกหรือกรอกชื่อ')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(value)
    } catch {
      setError('บันทึกไม่สำเร็จ ลองอีกครั้ง')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-md border-gray-200">
        <CardHeader className="pb-2">
          {/* Prominent student name banner — teachers must verify the
              recognized student before continuing, since a single scan can
              still mis-identify. Make the name impossible to miss. */}
          <div
            className={`-mx-6 -mt-6 mb-2 px-5 py-4 rounded-t-lg border-b ${
              type === 'check_in'
                ? 'bg-gradient-to-br from-cyan-50 to-white border-cyan-200'
                : 'bg-gradient-to-br from-violet-50 to-white border-violet-200'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              ยืนยันนักเรียน
            </p>
            <p className="text-2xl font-bold text-gray-900 leading-tight break-words">
              {studentName}
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5">
              ⚠️ ตรวจสอบให้แน่ใจว่าเป็นคนนี้ก่อนกดยืนยัน
            </p>
          </div>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-500" />
            {label}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
            </div>
          ) : addingNew ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={
                  guardians[0]?.name
                    ? `ใช้บ่อย: ${guardians[0].name}`
                    : 'เช่น มารดา, บิดา, ยาย, อา'
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
              />
              {guardians.length > 0 && (
                <button
                  onClick={() => {
                    setAddingNew(false)
                    setNewName('')
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ← กลับไปเลือกจากรายชื่อเดิม
                </button>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {guardians.map((g) => {
                  const active = selected === g.name
                  return (
                    <button
                      key={g.name}
                      onClick={() => setSelected(g.name)}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition ${
                        active
                          ? 'bg-cyan-50 border-cyan-300 text-cyan-900'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-sm font-medium flex items-center gap-2">
                        {active && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                        {g.name}
                      </span>
                      <span className="text-[11px] text-gray-400 tabular-nums">
                        ใช้ {g.count} ครั้ง
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setAddingNew(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <Plus className="w-4 h-4" />
                เพิ่มคนใหม่
              </button>
            </>
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
              disabled={submitting || loading || !value}
              className="flex-1"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              ยืนยัน
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
