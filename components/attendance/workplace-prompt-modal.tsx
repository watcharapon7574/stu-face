'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MapPin, Building2, Loader2 } from 'lucide-react'

interface ServicePointLite {
  id: string
  short_name: string
  name: string
  is_headquarters?: boolean
}

interface ClassroomLite {
  id: string
  name: string
}

interface Props {
  teacherName: string
  servicePoints: ServicePointLite[]
  classrooms: ClassroomLite[]
  onSave: (workplace: string) => Promise<void>
}

export default function WorkplacePromptModal({
  teacherName,
  servicePoints,
  classrooms,
  onSave,
}: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherServicePoints = servicePoints.filter((sp) => !sp.is_headquarters)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!picked) {
      setError('กรุณาเลือกห้องเรียน หรือหน่วยบริการ')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(picked)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message === 'no_match') {
        setError('ตัวเลือกนี้ยังไม่ตรงกับหน่วยในระบบ ลองเลือกใหม่')
      } else {
        setError('บันทึกไม่สำเร็จ ลองอีกครั้ง')
      }
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[95vh] flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                เลือกห้องเรียน / หน่วยบริการ
              </h3>
              <p className="text-xs text-gray-400">{teacherName}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            ระบบจะใช้ข้อมูลนี้กรองรายชื่อนักเรียนที่คุณดูแล
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Classrooms (HQ) */}
          {classrooms.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  ห้องเรียน (ศูนย์ฯ หลัก)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {classrooms.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                      picked === c.name
                        ? 'bg-cyan-50 border border-cyan-300'
                        : 'hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="workplace"
                      value={c.name}
                      checked={picked === c.name}
                      onChange={(e) => setPicked(e.target.value)}
                      className="accent-cyan-500"
                      disabled={saving}
                    />
                    <span className="text-gray-900 truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Other service points */}
          {otherServicePoints.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  หน่วยบริการ
                </span>
              </div>
              <div className="space-y-1.5">
                {otherServicePoints.map((sp) => (
                  <label
                    key={sp.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      picked === sp.name
                        ? 'bg-violet-50 border border-violet-300'
                        : 'hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="workplace"
                      value={sp.name}
                      checked={picked === sp.name}
                      onChange={(e) => setPicked(e.target.value)}
                      className="accent-violet-500"
                      disabled={saving}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {sp.short_name}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{sp.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {error && (
            <p className="text-sm text-red-600 text-center bg-red-50 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}
        </form>

        <div className="p-5 border-t border-gray-100">
          <Button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            className="w-full"
            size="lg"
            disabled={saving || !picked}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  )
}
