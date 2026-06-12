'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import FaceRecognition, { type ScanMatch } from '@/components/attendance/face-recognition'
import { CheckCircle2, LogIn, LogOut, Sun, Moon, Clock, MapPin, Loader2, User, X, RefreshCw, Camera, Check, Search, Users } from 'lucide-react'
import type { Student, AttendanceMethod } from '@/types/database'
import { CONFIDENCE_THRESHOLD } from '@/types/database'
import { getCurrentPosition, findNearestServicePoint, findClosestServicePoint, type ServicePoint } from '@/lib/geolocation'
import { getSavedTeacher, saveTeacher, clearTeacher, type SavedTeacher } from '@/lib/teacher-store'
import { detectFaces, initializeHuman } from '@/lib/face-detection'
import type { FaceEmbedding } from '@/types/database'
import { matchWorkplaceToServicePoint, matchWorkplaceToClassroom, type ClassroomLike } from '@/lib/workplace-match'
import WorkplacePromptModal from '@/components/attendance/workplace-prompt-modal'
import GuardianPickerModal from '@/components/attendance/guardian-picker-modal'
import TeacherPickerModal from '@/components/attendance/teacher-picker-modal'
import { apiFetch } from '@/lib/api'
import { supabase } from '@/lib/supabase/client'
import {
  loadCachedEmbeddings,
  saveCachedEmbeddings,
  patchCachedEmbedding,
  rosterFingerprint,
  type EmbeddingRow,
} from '@/lib/embeddings-cache'

// --- Location detector ---
function useLocationDetection(servicePoints: ServicePoint[]) {
  const [status, setStatus] = useState<'loading' | 'found' | 'out_of_range' | 'error'>('loading')
  const [matched, setMatched] = useState<ServicePoint | null>(null)
  const [closest, setClosest] = useState<{ point: ServicePoint; distance: number } | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (servicePoints.length === 0) return

    getCurrentPosition()
      .then((pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        const match = findNearestServicePoint(latitude, longitude, servicePoints)
        const near = findClosestServicePoint(latitude, longitude, servicePoints)
        setClosest(near)

        if (match) {
          setMatched(match.point)
          setStatus('found')
        } else {
          setStatus('out_of_range')
        }
      })
      .catch(() => {
        setStatus('error')
      })
  }, [servicePoints])

  return { status, matched, closest, coords }
}

// --- Clock + buttons ---
function AttendanceSelect({
  onSelect,
}: {
  onSelect: (type: 'check_in' | 'check_out') => void
}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!now) {
    return <div className="flex-1 mt-4" aria-hidden />
  }

  const hours = now.getHours()
  const isAfternoon = hours >= 12
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const greeting = hours < 12 ? 'สวัสดีตอนเช้า' : hours < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'

  return (
    <div className="flex flex-col flex-1 mt-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 border border-gray-100">
          {hours < 17 ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          <span className="text-xs text-gray-500">{greeting}</span>
        </div>
        <div className="text-5xl font-extralight text-gray-900 mt-4 tabular-nums tracking-tight">
          {timeStr}
        </div>
        <div className="text-sm text-gray-400 mt-1">{dateStr}</div>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        <div className="flex gap-3 flex-1">
          <button
            onClick={() => onSelect('check_in')}
            disabled={isAfternoon}
            className={`group relative flex-[3] rounded-3xl p-6 flex items-center gap-5 transition-all active:scale-[0.97] disabled:pointer-events-none overflow-hidden ${
              isAfternoon
                ? 'bg-gray-50/80 border border-gray-100'
                : 'bg-white border border-cyan-200 shadow-[0_2px_20px_rgba(0,180,200,0.10)] hover:shadow-[0_8px_32px_rgba(0,180,200,0.18)] hover:border-cyan-300'
            }`}
          >
            {!isAfternoon && <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-cyan-50 opacity-60" />}
            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isAfternoon ? 'bg-gray-100' : 'bg-gradient-to-br from-cyan-100 to-cyan-50 shadow-sm'}`}>
              <LogIn className={`w-6 h-6 ${isAfternoon ? 'text-gray-300' : 'text-cyan-600'}`} />
            </div>
            <div className="relative flex-1 text-left">
              <div className={`text-2xl font-bold ${isAfternoon ? 'text-gray-300' : 'text-gray-900'}`}>เช้า</div>
              <div className={`text-sm ${isAfternoon ? 'text-gray-200' : 'text-gray-400'}`}>Check in</div>
            </div>
            {!isAfternoon && (
              <div className="relative mr-2">
                <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                  <LogIn className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </button>

          {/* Late check-in — mirrors the 'กลับก่อน' button but for the
              afternoon: lets a teacher record a check-in even after 12:00
              for students who arrived late. */}
          <button
            onClick={() => onSelect('check_in')}
            disabled={!isAfternoon}
            className={`group relative flex-1 rounded-3xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.97] disabled:pointer-events-none overflow-hidden ${
              !isAfternoon
                ? 'bg-gray-50/80 border border-gray-100'
                : 'bg-white border border-amber-200 shadow-[0_2px_20px_rgba(245,158,11,0.10)] hover:shadow-[0_8px_32px_rgba(245,158,11,0.18)] hover:border-amber-300'
            }`}
            title="ใช้กรณีนักเรียนมาสายหลัง 12:00"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${!isAfternoon ? 'bg-gray-100' : 'bg-gradient-to-br from-amber-100 to-amber-50'}`}>
              <LogIn className={`w-4 h-4 ${!isAfternoon ? 'text-gray-300' : 'text-amber-600'}`} />
            </div>
            <div className={`text-sm font-bold leading-tight text-center ${!isAfternoon ? 'text-gray-300' : 'text-gray-900'}`}>
              มาสาย
            </div>
            <div className={`text-[10px] leading-tight ${!isAfternoon ? 'text-gray-200' : 'text-amber-600'}`}>
              หลัง 12:00
            </div>
          </button>
        </div>

        <div className="flex gap-3 flex-1">
          <button
            onClick={() => onSelect('check_out')}
            disabled={!isAfternoon}
            className={`group relative flex-[3] rounded-3xl p-6 flex items-center gap-5 transition-all active:scale-[0.97] disabled:pointer-events-none overflow-hidden ${
              !isAfternoon
                ? 'bg-gray-50/80 border border-gray-100'
                : 'bg-white border border-violet-200 shadow-[0_2px_20px_rgba(130,80,220,0.10)] hover:shadow-[0_8px_32px_rgba(130,80,220,0.18)] hover:border-violet-300'
            }`}
          >
            {isAfternoon && <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-violet-50 opacity-60" />}
            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${!isAfternoon ? 'bg-gray-100' : 'bg-gradient-to-br from-violet-100 to-violet-50 shadow-sm'}`}>
              <LogOut className={`w-6 h-6 ${!isAfternoon ? 'text-gray-300' : 'text-violet-600'}`} />
            </div>
            <div className="relative flex-1 text-left">
              <div className={`text-2xl font-bold ${!isAfternoon ? 'text-gray-300' : 'text-gray-900'}`}>เย็น</div>
              <div className={`text-sm ${!isAfternoon ? 'text-gray-200' : 'text-gray-400'}`}>Check out</div>
            </div>
            {isAfternoon && (
              <div className="relative mr-2">
                <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
                  <LogOut className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </button>

          <button
            onClick={() => onSelect('check_out')}
            disabled={isAfternoon}
            className={`group relative flex-1 rounded-3xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.97] disabled:pointer-events-none overflow-hidden ${
              isAfternoon
                ? 'bg-gray-50/80 border border-gray-100'
                : 'bg-white border border-amber-200 shadow-[0_2px_20px_rgba(245,158,11,0.10)] hover:shadow-[0_8px_32px_rgba(245,158,11,0.18)] hover:border-amber-300'
            }`}
            title="ใช้กรณีนักเรียนกลับก่อน 12:00"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isAfternoon ? 'bg-gray-100' : 'bg-gradient-to-br from-amber-100 to-amber-50'}`}>
              <LogOut className={`w-4 h-4 ${isAfternoon ? 'text-gray-300' : 'text-amber-600'}`} />
            </div>
            <div className={`text-sm font-bold leading-tight text-center ${isAfternoon ? 'text-gray-300' : 'text-gray-900'}`}>
              กลับก่อน
            </div>
            <div className={`text-[10px] leading-tight ${isAfternoon ? 'text-gray-200' : 'text-amber-600'}`}>
              ก่อน 12:00
            </div>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-4 mb-2">
        <Clock className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-xs text-gray-300">
          {isAfternoon ? 'ช่วงบ่าย — เช็คชื่อออก' : 'ช่วงเช้า — เช็คชื่อเข้า'}
        </span>
      </div>
    </div>
  )
}

// --- Update Face Flow ---
function UpdateFaceFlow({
  student,
  onDone,
  onCancel,
}: {
  student: Student
  onDone: () => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [captured, setCaptured] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([])
  const target = 3

  useEffect(() => {
    let mounted = true
    async function init() {
      // Camera first — see note in face-recognition.tsx about iOS PWA
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      if (!mounted) {
        ms.getTracks().forEach((t) => t.stop())
        return
      }
      setStream(ms)
      if (videoRef.current) videoRef.current.srcObject = ms
      await initializeHuman()
    }
    init().catch(() => setError('ไม่สามารถเปิดกล้องได้'))
    return () => {
      mounted = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = async () => {
    if (!videoRef.current) return
    setError('')
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0)

    const { embeddings: embs } = await detectFaces(canvas)
    if (embs.length === 0) {
      setError('ไม่พบใบหน้า ลองอีกครั้ง')
      return
    }
    if (embs.length > 1) {
      setError('พบมากกว่า 1 ใบหน้า')
      return
    }

    const next = [...embeddings, embs[0]]
    setEmbeddings(next)
    setCaptured(next.length)

    if (next.length >= target) {
      // Save embeddings
      setSaving(true)
      try {
        const res = await fetch(`/api/students/${student.id}/embeddings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeddings: next }),
        })
        if (!res.ok) throw new Error('Failed')
        stream?.getTracks().forEach((t) => t.stop())
        onDone()
      } catch {
        setError('บันทึกไม่สำเร็จ')
        setSaving(false)
      }
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-cyan-500" />
            อัปเดตใบหน้า
          </CardTitle>
          <p className="text-sm text-gray-500">{student.name} {student.nickname ? `(${student.nickname})` : ''}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/40 rounded-full w-40 h-40" />
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${(captured / target) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 tabular-nums">{captured}/{target}</span>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <Button
            onClick={capture}
            disabled={saving || captured >= target}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> กำลังบันทึก...</>
            ) : (
              <><Camera className="w-5 h-5 mr-2" /> ถ่ายรูป ({captured}/{target})</>
            )}
          </Button>

          <Button onClick={onCancel} variant="outline" className="w-full">
            ยกเลิก
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Confirm identity after a scan ---
// Always shown after a scan (even a high-confidence match) so the teacher
// verifies the name before it's recorded. If the match is wrong, the teacher
// picks the correct student here; the just-scanned face is then reused to
// update that student (see handleConfirmIdentity in the parent).
function ConfirmIdentity({
  students,
  matches,
  type,
  onConfirm,
  onCancel,
}: {
  students: Student[]
  matches: ScanMatch[]
  type: 'check_in' | 'check_out'
  onConfirm: (student: Student, confidence: number, method: AttendanceMethod) => void
  onCancel: () => void
}) {
  const top = matches[0]
  const [chosen, setChosen] = useState<Student | null>(null)
  // Below the suggestion threshold the top guess is likely wrong, so open the
  // picker straight away rather than nudging the teacher to rubber-stamp it.
  const [picking, setPicking] = useState(top.confidence < CONFIDENCE_THRESHOLD.SUGGESTION)
  const [query, setQuery] = useState('')

  // A manual pick overrides the scan's top match.
  const proposed = chosen ?? top.student
  const corrected = chosen != null
  const confidence = corrected ? 0 : top.confidence
  const method: AttendanceMethod = corrected
    ? 'manual'
    : top.confidence >= CONFIDENCE_THRESHOLD.AUTO
      ? 'auto'
      : 'suggestion'

  const lowConfidence = !corrected && top.confidence < CONFIDENCE_THRESHOLD.SUGGESTION
  const pct = Math.round(confidence * 100)
  const confColor =
    top.confidence >= CONFIDENCE_THRESHOLD.AUTO
      ? 'text-green-600'
      : top.confidence >= CONFIDENCE_THRESHOLD.SUGGESTION
        ? 'text-amber-600'
        : 'text-red-500'

  // Surface the scan's candidates at the top of the list (best first) so a
  // near-miss correction is one tap away, then the rest of the roster.
  const matchConf = new Map(matches.map((m) => [m.student.id, m.confidence]))
  const ordered = [
    ...matches.map((m) => m.student),
    ...students.filter((s) => !matchConf.has(s.id)),
  ]
  const q = query.trim().toLowerCase()
  const filtered = q
    ? ordered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.nickname?.toLowerCase().includes(q) ?? false),
      )
    : ordered

  const label = type === 'check_in' ? 'เข้า' : 'ออก'

  return (
    <div className="mt-4 space-y-4">
      <Card className="border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-gray-900 text-lg">ยืนยันชื่อนักเรียน</CardTitle>
          <p className="text-sm text-gray-400">ตรวจสอบให้ตรงตัวก่อนเช็คชื่อ{label}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Proposed student */}
          <div
            className={`rounded-2xl border p-4 ${
              corrected
                ? 'border-cyan-200 bg-cyan-50/40'
                : lowConfidence
                  ? 'border-red-200 bg-red-50/40'
                  : 'border-gray-200 bg-gray-50/60'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-gray-400 mb-0.5">
                  {corrected ? 'เลือกเอง' : 'ระบบจดจำได้'}
                </div>
                <div className="text-xl font-bold text-gray-900 truncate">{proposed.name}</div>
                {proposed.nickname && (
                  <div className="text-sm text-gray-400">({proposed.nickname})</div>
                )}
              </div>
              {!corrected && (
                <div className="text-right shrink-0">
                  <div className={`text-2xl font-bold tabular-nums ${confColor}`}>{pct}%</div>
                  <div className="text-[10px] text-gray-400">ความมั่นใจ</div>
                </div>
              )}
            </div>
            {lowConfidence && (
              <p className="text-xs text-red-600 mt-2">
                ระบบไม่ค่อยมั่นใจ — กรุณาตรวจสอบหรือเลือกชื่อเอง
              </p>
            )}
          </div>

          {/* Confirm the proposed name. De-emphasised when the guess is
              low-confidence so the teacher doesn't tap it on autopilot. */}
          <Button
            onClick={() => onConfirm(proposed, confidence, method)}
            variant={lowConfidence ? 'outline' : 'default'}
            className="w-full h-14 text-base"
            size="lg"
          >
            <Check className="w-5 h-5 mr-2" />
            ยืนยัน — {proposed.nickname || proposed.name}
          </Button>

          {/* Correct the name */}
          {!picking ? (
            <Button onClick={() => setPicking(true)} variant="outline" className="w-full">
              <Users className="w-4 h-4 mr-2" />
              ไม่ใช่คนนี้ — เลือกชื่อเอง
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาชื่อ / ชื่อเล่น"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {filtered.map((s) => {
                  const c = matchConf.get(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setChosen(s)
                        setPicking(false)
                        setQuery('')
                      }}
                      className="w-full p-3 border border-gray-200 rounded-xl hover:bg-cyan-50/60 text-left flex items-center justify-between transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{s.name}</div>
                        {s.nickname && (
                          <div className="text-xs text-gray-400">({s.nickname})</div>
                        )}
                      </div>
                      {c != null && (
                        <span className="text-xs font-mono text-gray-400 shrink-0 ml-2">
                          {Math.round(c * 100)}%
                        </span>
                      )}
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">ไม่พบชื่อนี้</p>
                )}
              </div>
            </div>
          )}

          <Button onClick={onCancel} variant="outline" className="w-full text-gray-500">
            ยกเลิก / สแกนใหม่
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Main ---
interface AttendanceFlowProps {
  students: Student[]
  servicePoints: ServicePoint[]
  classrooms?: ClassroomLike[]
}

export default function AttendanceFlow({
  students: initialStudents,
  servicePoints,
  classrooms = [],
}: AttendanceFlowProps) {
  // Treat the prop as a server-rendered seed. The seed carries name/SP only —
  // face_embeddings is lazy-loaded from /api/students/embeddings the first
  // time the user enters face-match mode (see hydrateEmbeddings below). This
  // avoids shipping ~MB of float arrays on every page load to every kiosk.
  const [students, setStudents] = useState<Student[]>(initialStudents)
  const [embeddingsReady, setEmbeddingsReady] = useState(false)
  // Track the last hydration timestamp so kiosks left open all day pick
  // up newly enrolled faces from /setup. After STALE_MS, the next entry
  // into face mode re-fetches embeddings.
  const lastHydratedAtRef = useRef<number>(0)
  const STALE_MS = 5 * 60 * 1000
  // How long an IndexedDB embeddings snapshot is trusted before we re-pull the
  // authoritative copy (picks up cross-device learning and existing-student
  // re-enrolls that don't change the roster id set). 24h: the roster
  // fingerprint catches enrolls/removals immediately, and per-scan learning
  // is patched into the snapshot locally, so a daily authoritative refresh
  // is plenty.
  const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000

  const hydrateEmbeddings = useCallback(async () => {
    const now = Date.now()
    const fresh = embeddingsReady && now - lastHydratedAtRef.current < STALE_MS
    if (fresh) return
    try {
      // Cheap roster check first: just the active ids (a few KB). Direct from
      // Supabase (thin-client path); fall back to the Vercel API route if the
      // direct call fails. The id set tells us whether the heavy embeddings
      // payload could have meaningfully changed, so we can skip the multi-MB
      // download on the common case where the roster is unchanged.
      let fingerprint: string | null = null
      try {
        const { data: ids, error } = await supabase
          .from('std_students')
          .select('id')
          .eq('is_active', true)
        if (!error && Array.isArray(ids)) {
          fingerprint = rosterFingerprint(ids.map((s) => s.id as string))
        } else {
          const slimRes = await fetch('/api/students?is_active=true')
          if (slimRes.ok) {
            const slim = (await slimRes.json())?.students as Array<{ id: string }> | undefined
            if (Array.isArray(slim)) fingerprint = rosterFingerprint(slim.map((s) => s.id))
          }
        }
      } catch {
        // roster check failed — fall through and lean on whatever's cached
      }

      const cached = await loadCachedEmbeddings()
      const cacheUsable =
        cached != null &&
        (fingerprint === null || cached.fingerprint === fingerprint) &&
        now - cached.savedAt < MAX_CACHE_AGE_MS

      let rows: EmbeddingRow[]
      if (cacheUsable && cached) {
        rows = cached.rows
      } else {
        // Heavy payload: prefer Supabase direct (PostgREST gzips the JSON),
        // fall back to the Vercel API route, then to any stale snapshot.
        let fetched: EmbeddingRow[] | null = null
        try {
          const { data, error } = await supabase
            .from('std_students')
            .select('id, face_embeddings')
            .eq('is_active', true)
          if (!error && Array.isArray(data)) {
            fetched = (data as Array<{ id: string; face_embeddings: unknown }>)
              .filter((r) => Array.isArray(r.face_embeddings) && (r.face_embeddings as unknown[]).length > 0)
              .map((r) => ({ id: r.id, face_embeddings: r.face_embeddings as number[][] }))
          }
        } catch {
          // direct path down — try the API route below
        }
        if (!fetched) {
          const res = await fetch('/api/students/embeddings?is_active=true')
          if (res.ok) {
            const data = await res.json()
            const list = data?.embeddings as EmbeddingRow[] | undefined
            if (Array.isArray(list)) fetched = list
          }
        }

        if (fetched) {
          rows = fetched
          await saveCachedEmbeddings({
            fingerprint: fingerprint ?? cached?.fingerprint ?? '',
            savedAt: now,
            rows,
          })
        } else if (cached) {
          // Both origins unreachable but we have a snapshot — use it rather
          // than leaving the kiosk unable to scan.
          rows = cached.rows
        } else {
          return
        }
      }

      const byId = new Map(rows.map((r) => [r.id, r.face_embeddings]))
      setStudents((prev) =>
        prev.map((s) => ({ ...s, face_embeddings: byId.get(s.id) ?? s.face_embeddings ?? [] })),
      )
      lastHydratedAtRef.current = Date.now()
      setEmbeddingsReady(true)
    } catch {
      // Network down — leave embeddingsReady as-is; the scan button stays
      // disabled until a successful hydrate.
    }
  }, [embeddingsReady])

  // Hydrate as soon as the page mounts so embeddings are ready by the
  // time the user picks check_in/check_out. This is the canonical race
  // fix — FaceRecognition's scan button is also gated on embeddingsReady
  // in case hydrate is still in flight when the user is fast.
  useEffect(() => {
    hydrateEmbeddings()
  }, [hydrateEmbeddings])

  const [mode, setMode] = useState<'select' | 'face' | 'confirm' | 'manual' | 'update_face' | 'success'>('select')
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out'>('check_in')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [updatingStudent, setUpdatingStudent] = useState<Student | null>(null)
  // The face captured by the last scan + its ranked candidates. The embedding
  // is reused to update whichever student the teacher confirms (rolling
  // buffer), so recognition keeps improving on every scan.
  const [scannedEmbedding, setScannedEmbedding] = useState<FaceEmbedding | null>(null)
  const [scanMatches, setScanMatches] = useState<ScanMatch[]>([])
  const [teacher, setTeacher] = useState<SavedTeacher | null>(null)
  const [needsWorkplace, setNeedsWorkplace] = useState(false)
  const [pendingAttendance, setPendingAttendance] = useState<{
    student: Student
    confidence: number
    method: AttendanceMethod
  } | null>(null)
  // For kiosk mode only: the teacher picked per-scan (overrides the
  // logged-in kiosk identity when saving attendance). null when no
  // teacher has been picked yet for the current pending scan.
  const [pickedTeacherName, setPickedTeacherName] = useState<string | null>(null)
  // Surface a "ทำไปแล้ว" success variant when the server reports the
  // student was already scanned for this type today.
  const [alreadyDoneAt, setAlreadyDoneAt] = useState<string | null>(null)
  // 409 from server when the user tries to scan-out without a check-in.
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null)
  const { status, matched, closest, coords } = useLocationDetection(servicePoints)

  // Load saved teacher from localStorage on mount
  useEffect(() => {
    const saved = getSavedTeacher()
    if (saved) setTeacher(saved)
  }, [])

  // Always re-fetch workplace from server when a teacher is present so
  // admin updates to profiles.workplace take effect without logout.
  useEffect(() => {
    if (!teacher?.id) return
    let cancelled = false

    fetch(`/api/profiles/${teacher.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const wp = (data?.profile?.workplace as string | null) ?? null
        if (wp !== (teacher.workplace ?? null)) {
          const updated = { ...teacher, workplace: wp }
          saveTeacher(updated)
          setTeacher(updated)
        }
      })
      .catch(() => {
        // Network down: fall back to whatever we cached locally
      })

    return () => {
      cancelled = true
    }
  }, [teacher?.id])

  // Resolve the teacher's workplace to a service point (HQ or a unit).
  // Classroom matching is still used for workplace validation (a teacher
  // may have workplace = 'ห้องเรียนจิงโจ้') but it is NOT used for filtering
  // the pickup-dropoff roster: every HQ teacher — regardless of which
  // classroom they belong to — should see every HQ student so they can
  // cover for each other across rooms.
  const teacherClassroom = matchWorkplaceToClassroom(
    teacher?.workplace ?? null,
    classrooms
  )
  const teacherSP = matchWorkplaceToServicePoint(
    teacher?.workplace ?? null,
    servicePoints
  )

  // Decide whether to prompt: workplace empty OR doesn't match anything
  useEffect(() => {
    if (!teacher) return
    if (servicePoints.length === 0) return
    const wp = teacher.workplace
    if (wp === undefined) return // still resolving from server
    if (!wp || !wp.trim() || (!teacherSP && !teacherClassroom)) {
      setNeedsWorkplace(true)
    } else {
      setNeedsWorkplace(false)
    }
  }, [teacher, teacherSP, teacherClassroom, servicePoints.length])

  const handleWorkplaceSave = async (workplace: string) => {
    if (!teacher) return
    const res = await fetch(`/api/profiles/${teacher.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workplace }),
    })
    if (!res.ok) throw new Error('failed')

    // Re-match against either a service point or a classroom; if still no
    // match, throw so the modal stays open with a hint
    const matchedSP = matchWorkplaceToServicePoint(workplace, servicePoints)
    const matchedClass = matchWorkplaceToClassroom(workplace, classrooms)
    if (!matchedSP && !matchedClass) {
      // Persist the typed value but flag mismatch so the modal stays open
      const updated = { ...teacher, workplace }
      saveTeacher(updated)
      setTeacher(updated)
      throw new Error('no_match')
    }

    const updated = { ...teacher, workplace }
    saveTeacher(updated)
    setTeacher(updated)
    setNeedsWorkplace(false)
  }

  // Visible students: scope by the teacher's service point only. HQ
  // teachers see all HQ students (any classroom); unit teachers see only
  // their unit's students.
  const visibleStudents = teacherSP
    ? students.filter((s) => s.service_point === teacherSP.short_name)
    : students

  const handleAttendanceTypeSelect = (type: 'check_in' | 'check_out') => {
    setAttendanceType(type)
    setMode('face')
    // If embeddings hydrated >5 min ago, refresh — covers the case where
    // /setup enrolled a new face while this kiosk was open. No-op if still
    // fresh.
    hydrateEmbeddings()
  }

  const handleLogout = () => {
    if (!confirm('ออกจากระบบ?')) return
    clearTeacher()
    window.location.href = '/'
  }

  // After face/manual selection, hold the attendance details and open the
  // guardian picker; the actual POST happens once the user confirms a guardian.
  const handleFaceRecognized = (
    studentId: string,
    confidence: number,
    method: AttendanceMethod
  ) => {
    const student = students.find((s) => s.id === studentId)
    if (!student) return
    setPendingAttendance({ student, confidence, method })
  }

  // A scan produced a face + candidates. Hold them and show the confirm
  // screen so the teacher verifies (or corrects) the name. The embedding is
  // applied to the final student only once attendance is actually recorded
  // (see submitAttendance), so a back-out-then-correct can't learn the wrong
  // student.
  const handleScanResult = (embedding: FaceEmbedding, matches: ScanMatch[]) => {
    setScannedEmbedding(embedding)
    setScanMatches(matches)
    setMode('confirm')
  }

  // Append the just-scanned face to a student's embeddings (rolling buffer,
  // server trims to 20). Also reflect it locally so recognition improves this
  // session without waiting for the next hydrate. Non-critical: failure here
  // must not block attendance.
  const saveScannedFace = useCallback(
    async (studentId: string, embedding: FaceEmbedding) => {
      try {
        // Direct SECURITY DEFINER RPC (thin-client path) — anon is read-only
        // on std_students itself; the rolling 20-embedding trim lives in the
        // function. Fall back to the API route if the direct call fails.
        const { error } = await supabase.rpc('std_add_embedding', {
          p_student_id: studentId,
          p_embedding: embedding,
        })
        if (error) {
          const res = await apiFetch(`/api/students/${studentId}/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embedding }),
          })
          if (!res.ok) return
        }
        setStudents((prev) =>
          prev.map((s) =>
            s.id === studentId
              ? {
                  ...s,
                  face_embeddings: [
                    ...((s.face_embeddings as FaceEmbedding[] | null) ?? []),
                    embedding,
                  ].slice(-20),
                }
              : s,
          ),
        )
        // Persist into the IndexedDB snapshot too so a page reload keeps the
        // just-learned face instead of reverting to the older cached copy.
        patchCachedEmbedding(studentId, embedding)
      } catch {
        // ignore — attendance still proceeds; the face just won't refresh
      }
    },
    [],
  )

  // Teacher confirmed who the scanned face belongs to. Hold it; the face is
  // learned in submitAttendance once the row is actually recorded.
  const handleConfirmIdentity = (
    student: Student,
    confidence: number,
    method: AttendanceMethod
  ) => {
    setPendingAttendance({ student, confidence, method })
  }

  const submitAttendance = async (guardian: string) => {
    if (!pendingAttendance) return
    const { student, confidence, method } = pendingAttendance

    // Kiosk mode attributes the action to the per-scan picked teacher,
    // not the shared kiosk login identity.
    const effectiveTeacherName = teacher?.is_kiosk
      ? pickedTeacherName
      : teacher?.name || null

    // Every attendance row must carry the SP of the scan location.
    // Prefer the GPS-matched SP; if GPS didn't match (out of range,
    // permission denied, errored), fall back to the teacher's
    // workplace SP. If neither resolves, refuse to submit — the row
    // would otherwise leave service_point_id NULL.
    const effectiveSPId = matched?.id ?? teacherSP?.id ?? null
    if (!effectiveSPId) {
      throw new Error('ไม่พบหน่วยบริการสำหรับการสแกน — เปิด GPS หรือเลือก workplace ก่อน')
    }

    const today = new Date().toISOString().split('T')[0]

    // Thin-client path: write through the SECURITY DEFINER RPC directly
    // (anon is read-only on std_attendance itself). Falls back to the
    // Vercel API route if the direct call errors, so a kiosk keeps working
    // through either origin. Both paths normalize to the same result shape.
    type SubmitResult = {
      success?: boolean
      error?: string
      message?: string
      already_done?: boolean
      attendance?: { check_in?: string | null; check_out?: string | null } | null
    }
    let result: SubmitResult | null = null

    const { data: rpcData, error: rpcError } = await supabase.rpc('record_attendance', {
      p_student_id: student.id,
      p_date: today,
      p_type: attendanceType,
      p_method: method,
      p_service_point_id: effectiveSPId,
      p_confidence: confidence,
      p_teacher_name: effectiveTeacherName,
      p_lat: coords?.lat ?? null,
      p_lng: coords?.lng ?? null,
      p_guardian: guardian,
    })
    if (!rpcError && rpcData) {
      result = rpcData as SubmitResult
    } else {
      const response = await apiFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.id,
          date: today,
          type: attendanceType,
          confidence,
          method,
          service_point_id: effectiveSPId,
          teacher_name: effectiveTeacherName,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          guardian,
        }),
      })
      const data = (await response.json().catch(() => null)) as SubmitResult | null
      if (response.status === 409 && data?.error === 'no_check_in') {
        result = data
      } else if (!response.ok) {
        throw new Error('Failed to record attendance')
      } else {
        result = data
      }
    }

    // Rejected check-out because no check-in exists today.
    if (result?.error === 'no_check_in') {
      setPendingAttendance(null)
      setPickedTeacherName(null)
      setSelectedStudent(student)
      setScannedEmbedding(null)
      setScanMatches([])
      setAlreadyDoneAt(null)
      setSubmitErrorMsg(result.message || 'ยังไม่ได้สแกนเข้าวันนี้ — สแกนเข้าก่อนแล้วค่อยสแกนออก')
      setMode('success')
      setTimeout(() => {
        setMode('select')
        setSelectedStudent(null)
        setSubmitErrorMsg(null)
      }, 3500)
      return
    }

    if (!result?.success) throw new Error('Failed to record attendance')

    // Learn the scanned face now that the row is recorded, keyed to the
    // student that actually got the attendance — not whoever was tentatively
    // confirmed earlier. Manual (non-scan) selections leave scannedEmbedding
    // null, so they don't learn anything. Fire-and-forget.
    if (scannedEmbedding) {
      saveScannedFace(student.id, scannedEmbedding)
    }

    const existing = result.attendance ?? null
    const alreadyTime = result.already_done
      ? attendanceType === 'check_in'
        ? existing?.check_in ?? null
        : existing?.check_out ?? null
      : null

    setPendingAttendance(null)
    setPickedTeacherName(null)
    setSelectedStudent(student)
    setScannedEmbedding(null)
    setScanMatches([])
    setAlreadyDoneAt(alreadyTime)
    setSubmitErrorMsg(null)
    setMode('success')

    setTimeout(() => {
      setMode('select')
      setSelectedStudent(null)
      setAlreadyDoneAt(null)
    }, alreadyTime ? 3500 : 2000)
  }

  const handleManualSelect = () => {
    // Entering manual selection without a scan: drop any leftover scanned face
    // so a previous scan's embedding can't attach to a hand-picked student.
    setScannedEmbedding(null)
    setScanMatches([])
    setMode('manual')
  }

  const handleManualSelectStudent = (student: Student) => {
    handleFaceRecognized(student.id, 0, 'manual')
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-center gap-3">
        <img src="/std2.png" alt="Logo" className="w-10 h-10 object-contain" />
        <div className="text-left">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">เช็คชื่อนักเรียน</h1>
          <p className="text-xs text-gray-400">ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี</p>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap justify-center gap-2 mt-3">
        {/* Location badge */}
        {status === 'loading' && (
          <div className="inline-flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100">
            <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
            <span className="text-xs text-gray-400">ระบุตำแหน่ง...</span>
          </div>
        )}
        {status === 'found' && matched && (
          <div className="inline-flex items-center gap-2 bg-green-50 rounded-full px-3 py-1.5 border border-green-200">
            <MapPin className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-green-700 font-medium">{matched.short_name}</span>
          </div>
        )}
        {status === 'out_of_range' && closest && (
          <div className="inline-flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{closest.point.short_name}</span>
          </div>
        )}
        {status === 'error' && (
          <div className="inline-flex items-center gap-2 bg-red-50 rounded-full px-3 py-1.5 border border-red-200">
            <MapPin className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-600">ไม่พบตำแหน่ง</span>
          </div>
        )}

        {/* Teacher badge */}
        {teacher && (
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-3 py-1.5 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs text-blue-700 font-medium">
              {teacher.name || teacher.nickname}
            </span>
            <X className="w-3 h-3 text-blue-400" />
          </button>
        )}
      </div>

      {/* Select attendance type */}
      {mode === 'select' && <AttendanceSelect onSelect={handleAttendanceTypeSelect} />}

      {/* Face recognition mode */}
      {mode === 'face' && (
        <div className="mt-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>
              <strong>โหมด:</strong> {attendanceType === 'check_in' ? 'เช็คชื่อเข้า' : 'เช็คชื่อออก'}
            </span>
            <div className="flex items-center gap-3">
              {matched && (
                <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                  <MapPin className="w-3 h-3" />
                  {matched.short_name}
                </span>
              )}
              {teacher && (
                <span className="inline-flex items-center gap-1 text-blue-600 text-xs">
                  <User className="w-3 h-3" />
                  {teacher.name || teacher.nickname}
                </span>
              )}
            </div>
          </div>

          <FaceRecognition
            students={visibleStudents}
            type={attendanceType}
            onScanResult={handleScanResult}
            onManualSelect={handleManualSelect}
            embeddingsReady={embeddingsReady}
          />

          <Button
            onClick={() => setMode('select')}
            variant="outline"
            className="w-full"
          >
            ยกเลิก
          </Button>
        </div>
      )}

      {/* Confirm identity after a scan — always shown so a wrong match can be
          corrected before recording, and the scanned face updates the student. */}
      {mode === 'confirm' && scanMatches.length > 0 && (
        <ConfirmIdentity
          students={visibleStudents}
          matches={scanMatches}
          type={attendanceType}
          onConfirm={handleConfirmIdentity}
          onCancel={() => {
            setScannedEmbedding(null)
            setScanMatches([])
            setMode('face')
          }}
        />
      )}

      {/* Manual selection mode */}
      {mode === 'manual' && (
        <div className="mt-4 space-y-3">
          {/* Suggestion to update face */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 font-medium">สแกนไม่ผ่าน?</p>
              <p className="text-xs text-amber-600 mt-0.5">เลือกชื่อนักเรียนเพื่อเช็คชื่อ หรือกดปุ่มกล้องเพื่ออัปเดตใบหน้าใหม่</p>
            </div>
          </div>

          <Card className="border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-gray-900">เลือกนักเรียน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {visibleStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <button
                      onClick={() => handleManualSelectStudent(student)}
                      className="flex-1 p-3 text-left"
                    >
                      <div className="font-medium text-gray-900 text-sm">{student.name}</div>
                      {student.nickname && (
                        <div className="text-xs text-gray-400">({student.nickname})</div>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setUpdatingStudent(student)
                        setMode('update_face')
                      }}
                      className="p-3 text-gray-400 hover:text-cyan-600 transition-colors"
                      title="อัปเดตใบหน้า"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setMode('face')}
                variant="outline"
                className="w-full mt-4"
              >
                ย้อนกลับ
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Update face mode */}
      {mode === 'update_face' && updatingStudent && (
        <UpdateFaceFlow
          student={updatingStudent}
          onDone={() => {
            setUpdatingStudent(null)
            setMode('face')
          }}
          onCancel={() => {
            setUpdatingStudent(null)
            setMode('manual')
          }}
        />
      )}

      {/* Success message — two variants:
          - Normal: just recorded (green check)
          - Already done: this student was already scanned for this type
            today (amber clock, shows the original time so the teacher can
            see who/when did it) */}
      {mode === 'success' && selectedStudent && (
        <div className="mt-4 flex-1 flex items-center">
          <Card
            className={`w-full ${
              submitErrorMsg
                ? 'border-red-300 bg-red-50/40'
                : alreadyDoneAt
                  ? 'border-amber-300 bg-amber-50/40'
                  : 'border-gray-200'
            }`}
          >
            <CardContent className="py-12 text-center">
              {submitErrorMsg ? (
                <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
              ) : alreadyDoneAt ? (
                <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              ) : (
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              )}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {submitErrorMsg
                  ? 'บันทึกไม่ได้'
                  : alreadyDoneAt
                    ? `สแกน${attendanceType === 'check_in' ? 'เข้า' : 'ออก'}แล้ว`
                    : 'บันทึกสำเร็จ!'}
              </h2>
              <p className="text-lg text-gray-700 mb-2">{selectedStudent.name}</p>
              {submitErrorMsg ? (
                <p className="text-sm text-red-700 mb-2">{submitErrorMsg}</p>
              ) : alreadyDoneAt ? (
                <p className="text-sm text-amber-700 mb-2">
                  สแกน{attendanceType === 'check_in' ? 'เข้า' : 'ออก'}ไปแล้วเมื่อ{' '}
                  <span className="font-semibold tabular-nums">
                    {new Date(alreadyDoneAt).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Bangkok',
                    })}
                  </span>
                </p>
              ) : (
                <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
                  {matched && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {matched.short_name}
                    </span>
                  )}
                  {teacher && (
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {teacher.name || teacher.nickname}
                    </span>
                  )}
                </div>
              )}
              {!alreadyDoneAt && !submitErrorMsg && (
                <p className="text-gray-400 mt-2">
                  {attendanceType === 'check_in' ? 'เช็คชื่อเข้า' : 'เช็คชื่อออก'} เรียบร้อยแล้ว
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* First-login workplace prompt */}
      {needsWorkplace && teacher && (
        <WorkplacePromptModal
          teacherName={teacher.name || teacher.nickname || ''}
          servicePoints={servicePoints}
          classrooms={classrooms}
          onSave={handleWorkplaceSave}
        />
      )}

      {/* Kiosk teacher picker — only when logged in on the shared kiosk
          device. Shows before the guardian picker so the per-scan
          actor is recorded against the attendance row. */}
      {pendingAttendance && teacher?.is_kiosk && !pickedTeacherName && (
        <TeacherPickerModal
          hqServicePointId={
            servicePoints.find((sp) => sp.is_headquarters)?.id || null
          }
          onConfirm={(name) => setPickedTeacherName(name)}
          onCancel={() => {
            setPendingAttendance(null)
            setPickedTeacherName(null)
          }}
        />
      )}

      {/* Guardian picker — opens after teacher picker (kiosk) or
          directly after face/manual selection (non-kiosk). */}
      {pendingAttendance &&
        (!teacher?.is_kiosk || pickedTeacherName) && (
        <GuardianPickerModal
          studentId={pendingAttendance.student.id}
          studentName={
            pendingAttendance.student.nickname
              ? `${pendingAttendance.student.name} (${pendingAttendance.student.nickname})`
              : pendingAttendance.student.name
          }
          type={attendanceType}
          onConfirm={submitAttendance}
          onCancel={() => {
            setPendingAttendance(null)
            setPickedTeacherName(null)
          }}
        />
      )}
    </div>
  )
}
