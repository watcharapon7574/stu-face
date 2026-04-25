'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Loader2, Save } from 'lucide-react'

export interface StudentFormData {
  name: string
  nickname: string | null
  date_of_birth: string | null
  service_point_id: string | null
  is_active: boolean
}

interface ServicePoint {
  id: string
  short_name: string
}

interface Props {
  mode: 'add' | 'edit'
  initial?: Partial<StudentFormData>
  servicePoints: ServicePoint[]
  onClose: () => void
  onSave: (data: StudentFormData) => Promise<void>
}

export default function StudentFormModal({
  mode,
  initial,
  servicePoints,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<StudentFormData>({
    name: initial?.name || '',
    nickname: initial?.nickname || null,
    date_of_birth: initial?.date_of_birth || null,
    service_point_id: initial?.service_point_id || null,
    is_active: initial?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('กรุณากรอกชื่อ')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch {
      setError('บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">
            {mode === 'edit' ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียน'}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">ชื่อ-นามสกุล *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              placeholder="เช่น ด.ช. สมชาย ใจดี"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">ชื่อเล่น</label>
            <input
              type="text"
              value={form.nickname || ''}
              onChange={(e) => setForm({ ...form, nickname: e.target.value || null })}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">วันเกิด</label>
            <input
              type="date"
              value={form.date_of_birth || ''}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value || null })
              }
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">หน่วยบริการ</label>
            <select
              value={form.service_point_id || ''}
              onChange={(e) =>
                setForm({ ...form, service_point_id: e.target.value || null })
              }
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 bg-white"
            >
              <option value="">— ไม่ระบุ —</option>
              {servicePoints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.short_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <div className="text-sm font-medium text-gray-900">เปิดใช้งาน</div>
              <div className="text-xs text-gray-400">นักเรียนยังเรียนอยู่</div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                form.is_active ? 'bg-cyan-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  form.is_active ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center bg-red-50 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={onClose}
              disabled={saving}
              variant="outline"
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              บันทึก
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
