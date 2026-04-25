'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, ScanFace, User, Search } from 'lucide-react'
import FaceCaptureModal from './face-capture-modal'
import type { FaceEmbedding } from '@/types/database'

export interface CandidateProfile {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  workplace: string | null
}

interface Props {
  candidates: CandidateProfile[]
  onClose: () => void
  onEnrolled: (profile: CandidateProfile, embeddings: FaceEmbedding[]) => Promise<void>
}

export default function AddTeacherModal({ candidates, onClose, onEnrolled }: Props) {
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<CandidateProfile | null>(null)

  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.nickname || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.workplace || '').toLowerCase().includes(q)
    )
  })

  if (picked) {
    return (
      <FaceCaptureModal
        title={`ลงทะเบียนใบหน้า: ${picked.nickname || picked.name}`}
        subtitle="ถ่ายรูป 3 มุม"
        frameCount={3}
        onClose={() => setPicked(null)}
        onComplete={async (embs) => {
          await onEnrolled(picked, embs)
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">เพิ่มครู</h3>
            <p className="text-xs text-gray-400">
              เลือกจากรายชื่อที่ลงทะเบียน Telegram แล้ว ({candidates.length})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ / ชื่อเล่น / เบอร์ / สถานที่"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {candidates.length === 0
                ? 'ครูทุกคนที่มี Telegram ถูกเพิ่มแล้ว'
                : 'ไม่พบรายชื่อที่ค้นหา'}
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setPicked(c)}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-cyan-50 rounded-xl transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {c.nickname ? `${c.name} (${c.nickname})` : c.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {[c.phone, c.workplace].filter(Boolean).join(' • ') || '—'}
                  </div>
                </div>
                <ScanFace className="w-4 h-4 text-cyan-500 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
