'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MapPin, Loader2 } from 'lucide-react'

const PLACEHOLDER_EXAMPLES = ['หน่วยบริการพัฒนานิคม', 'ห้องเรียนจิงโจ้']
const TYPE_DELAY = 90
const ERASE_DELAY = 45
const HOLD_AFTER_TYPE = 1200
const HOLD_AFTER_ERASE = 350

interface Props {
  teacherName: string
  onSave: (workplace: string) => Promise<void>
}

export default function WorkplacePromptModal({ teacherName, onSave }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placeholder, setPlaceholder] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Cycling typewriter placeholder
  useEffect(() => {
    let cancelled = false
    let exampleIdx = 0
    let charIdx = 0
    let phase: 'typing' | 'pause' | 'erasing' = 'typing'
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = () => {
      if (cancelled) return
      const example = PLACEHOLDER_EXAMPLES[exampleIdx]

      if (phase === 'typing') {
        charIdx += 1
        setPlaceholder(example.slice(0, charIdx))
        if (charIdx >= example.length) {
          phase = 'pause'
          timer = setTimeout(() => {
            phase = 'erasing'
            tick()
          }, HOLD_AFTER_TYPE)
          return
        }
        timer = setTimeout(tick, TYPE_DELAY)
      } else if (phase === 'erasing') {
        charIdx -= 1
        setPlaceholder(example.slice(0, Math.max(charIdx, 0)))
        if (charIdx <= 0) {
          exampleIdx = (exampleIdx + 1) % PLACEHOLDER_EXAMPLES.length
          charIdx = 0
          phase = 'typing'
          timer = setTimeout(tick, HOLD_AFTER_ERASE)
          return
        }
        timer = setTimeout(tick, ERASE_DELAY)
      }
    }

    timer = setTimeout(tick, 300)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Autofocus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      setError('กรุณากรอกชื่อห้องเรียน/หน่วยบริการ')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
    } catch {
      setError('บันทึกไม่สำเร็จ ลองอีกครั้ง')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                ระบุห้องเรียน / หน่วยบริการ
              </h3>
              <p className="text-xs text-gray-400">{teacherName}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            ระบบยังไม่มีข้อมูลที่ทำงานของคุณ กรอกชื่อห้องเรียนหรือหน่วยบริการเพื่อใช้กรองรายชื่อนักเรียนที่คุณดูแล
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              disabled={saving}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
              autoComplete="off"
            />

            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={saving || !value.trim()}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              บันทึก
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
