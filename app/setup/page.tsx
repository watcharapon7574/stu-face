'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CameraCapture from '@/components/setup/camera-capture'
import {
  MapPin,
  Building2,
  UserPlus,
  ScanFace,
  Search,
  Loader2,
  Camera,
  CheckCircle2,
  Settings2,
  Trash2,
  Save,
  X,
} from 'lucide-react'
import type { FaceEmbedding } from '@/types/database'
import { getSavedTeacher } from '@/lib/teacher-store'

// Canonical Thai name prefixes — picked from a dropdown to keep spelling
// consistent across teachers. Stored concatenated with the rest of the
// name in std_students.name (no separate column).
const NAME_PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'] as const
type NamePrefix = (typeof NAME_PREFIXES)[number]

function splitNamePrefix(full: string): { prefix: NamePrefix | ''; rest: string } {
  const trimmed = full.trim()
  for (const p of NAME_PREFIXES) {
    if (trimmed.startsWith(p)) {
      return { prefix: p, rest: trimmed.slice(p.length).trim() }
    }
  }
  return { prefix: '', rest: trimmed }
}

interface ServicePointOption {
  id: string
  name: string
  short_name: string
  district: string | null
  is_headquarters: boolean
}

interface StudentRow {
  id: string
  name: string
  nickname: string | null
  service_point: string | null
  is_active: boolean
  // Always [] in slim responses; rely on embedding_count for UI badges.
  face_embeddings: FaceEmbedding[] | null
  embedding_count?: number
}

type Tab = 'add' | 'update' | 'manage'
type AddStep = 'form' | 'camera' | 'saving'
type UpdateStep = 'pick' | 'camera' | 'saving' | 'done'

export default function SetupPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('add')
  const [servicePoints, setServicePoints] = useState<ServicePointOption[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/service-points')
      .then((r) => r.json())
      .then((data) => setServicePoints(data.service_points || []))
      .catch(() => {})
  }, [])

  // Check admin status so the management tab only renders for those who
  // have std_teacher_faces.is_admin = true.
  useEffect(() => {
    const saved = getSavedTeacher()
    if (!saved?.id) return
    fetch(`/api/profiles/${saved.id}`)
      .then((r) => r.json())
      .then((data) => setIsAdmin(!!data?.profile?.is_admin))
      .catch(() => {})
  }, [])

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">ลงทะเบียนนักเรียน</h1>
          <p className="text-gray-600 text-sm">
            เพิ่มนักเรียนใหม่ หรืออัปเดตใบหน้านักเรียนที่มีอยู่
          </p>
        </div>

        {/* Tabs — single-line labels with tight padding so 3 tabs fit
            cleanly on narrow phones. Icons already convey context, so
            the text can be terse. */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setTab('add')}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              tab === 'add' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            ลงทะเบียน
          </button>
          <button
            onClick={() => setTab('update')}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              tab === 'update' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ScanFace className="w-4 h-4 shrink-0" />
            อัปเดตใบหน้า
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab('manage')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                tab === 'manage' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Settings2 className="w-4 h-4 shrink-0" />
              จัดการ
            </button>
          )}
        </div>

        {tab === 'add' && (
          <AddTab servicePoints={servicePoints} onCancel={() => router.push('/')} />
        )}
        {tab === 'update' && <UpdateTab onCancel={() => router.push('/')} />}
        {tab === 'manage' && isAdmin && (
          <ManageTab servicePoints={servicePoints} onCancel={() => router.push('/')} />
        )}
      </div>
    </main>
  )
}

// ====================================================================
// Add tab — create new student (with optional face scan)
// ====================================================================
interface ClassroomOption {
  id: string
  name: string
  service_point_id: string | null
}

function AddTab({
  servicePoints,
  onCancel,
}: {
  servicePoints: ServicePointOption[]
  onCancel: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<AddStep>('form')
  const [prefix, setPrefix] = useState<NamePrefix>('เด็กชาย')
  const [studentName, setStudentName] = useState('')
  const [nickname, setNickname] = useState('')
  const [servicePointId, setServicePointId] = useState('')
  const [classroomId, setClassroomId] = useState('')
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [skipping, setSkipping] = useState(false)

  const fullName = `${prefix}${studentName.trim()}`

  const hqPoints = servicePoints.filter((sp) => sp.is_headquarters)
  const otherPoints = servicePoints.filter((sp) => !sp.is_headquarters)
  const isHqSelected = !!hqPoints.find((sp) => sp.id === servicePointId)

  // Load classrooms once (small list)
  useEffect(() => {
    fetch('/api/classrooms')
      .then((r) => r.json())
      .then((data) => setClassrooms(data.classrooms || []))
      .catch(() => {})
  }, [])

  // Reset classroom when switching away from HQ
  useEffect(() => {
    if (!isHqSelected && classroomId) setClassroomId('')
  }, [isHqSelected, classroomId])

  const validateForm = (): boolean => {
    if (!studentName.trim()) {
      setError('กรุณากรอกชื่อ-นามสกุล')
      return false
    }
    if (!prefix) {
      setError('กรุณาเลือกคำนำหน้า')
      return false
    }
    if (!servicePointId) {
      setError('กรุณาเลือกห้อง/หน่วยบริการ')
      return false
    }
    if (isHqSelected && !classroomId) {
      setError('กรุณาเลือกห้องเรียน')
      return false
    }
    setError(null)
    return true
  }

  const createStudent = async (
    embeddings: FaceEmbedding[]
  ): Promise<{ ok: true; student: StudentRow } | { ok: false; message: string }> => {
    const sp = servicePoints.find((s) => s.id === servicePointId)
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          nickname: nickname || null,
          service_point: sp?.short_name || null,
          classroom_id: isHqSelected ? classroomId || null : null,
        }),
      })
      if (!res.ok) return { ok: false, message: 'สร้างนักเรียนไม่สำเร็จ' }
      const { student } = await res.json()

      if (embeddings.length > 0) {
        const embRes = await fetch(`/api/students/${student.id}/embeddings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeddings }),
        })
        if (!embRes.ok) return { ok: false, message: 'บันทึก embedding ไม่สำเร็จ' }
      }
      return { ok: true, student }
    } catch {
      return { ok: false, message: 'ไม่สามารถเชื่อมต่อ API ได้' }
    }
  }

  const handleNextWithCamera = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setStep('camera')
  }

  const handleSkipScan = async () => {
    if (!validateForm()) return
    setSkipping(true)
    const result = await createStudent([])
    setSkipping(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    alert(`บันทึก ${fullName} สำเร็จ! (ยังไม่ได้สแกนใบหน้า — มาอัปเดตภายหลังในแท็บ "อัปเดตใบหน้า")`)
    router.refresh()
    router.push('/')
  }

  const handleCaptureComplete = async (embeddings: FaceEmbedding[]) => {
    setStep('saving')
    setError(null)
    const result = await createStudent(embeddings)
    if (!result.ok) {
      setError(result.message)
      setStep('camera')
      return
    }
    alert(`ลงทะเบียน ${fullName} สำเร็จ!`)
    router.refresh()
    router.push('/')
  }

  if (step === 'saving') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 mx-auto mb-4 animate-spin" />
          <p className="text-lg font-medium">กำลังบันทึกข้อมูล...</p>
        </CardContent>
      </Card>
    )
  }

  if (step === 'camera') {
    return (
      <div className="space-y-4">
        <CameraCapture
          studentName={fullName}
          onComplete={handleCaptureComplete}
          targetPhotos={5}
        />
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={() => setStep('form')}>
          ย้อนกลับ
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ข้อมูลนักเรียน</CardTitle>
        <CardDescription>กรอกข้อมูลพื้นฐานของนักเรียน</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleNextWithCamera} className="space-y-5">
          {/* Prefix picker — required, picks one of 4 canonical Thai
              titles so the name format stays consistent across teachers. */}
          <div>
            <label className="block text-sm font-medium mb-2">
              คำนำหน้า <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {NAME_PREFIXES.map((p) => (
                <label
                  key={p}
                  className={`flex items-center justify-center px-2 py-2 rounded-xl cursor-pointer transition-colors text-sm border ${
                    prefix === p
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-700 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="prefix"
                    value={p}
                    checked={prefix === p}
                    onChange={() => setPrefix(p)}
                    className="sr-only"
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              ชื่อ-นามสกุล <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
              placeholder="เช่น สมชาย ใจดี"
              required
            />
            {studentName.trim() && (
              <p className="text-xs text-gray-400 mt-1">
                บันทึกเป็น: <span className="text-gray-700 font-medium">{fullName}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="nickname" className="block text-sm font-medium mb-2">
              ชื่อเล่น
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
              placeholder="เช่น ชาย"
            />
          </div>

          {/* Service point selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ห้อง / หน่วยบริการ <span className="text-red-500">*</span>
            </label>

            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-2">
              {hqPoints.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      ศูนย์หลัก
                    </span>
                  </div>
                  {hqPoints.map((sp) => (
                    <label
                      key={sp.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        servicePointId === sp.id
                          ? 'bg-cyan-50 border border-cyan-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="service_point"
                        value={sp.id}
                        checked={servicePointId === sp.id}
                        onChange={(e) => setServicePointId(e.target.value)}
                        className="accent-cyan-500"
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
              )}

              {otherPoints.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 py-1 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      หน่วยบริการ
                    </span>
                  </div>
                  {otherPoints.map((sp) => (
                    <label
                      key={sp.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        servicePointId === sp.id
                          ? 'bg-violet-50 border border-violet-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="service_point"
                        value={sp.id}
                        checked={servicePointId === sp.id}
                        onChange={(e) => setServicePointId(e.target.value)}
                        className="accent-violet-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {sp.short_name}
                        </div>
                        {sp.district && (
                          <div className="text-xs text-gray-400">อ.{sp.district}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Classroom picker — only when ศูนย์หลัก is selected. Indented + accent
              border to make the "sub-step under ศูนย์หลัก" relationship obvious. */}
          {isHqSelected && (
            <div className="ml-3 pl-4 border-l-2 border-cyan-300">
              <div className="flex items-baseline gap-2 mb-1">
                <label className="block text-sm font-medium">
                  ห้องเรียนในศูนย์ฯ หลัก <span className="text-red-500">*</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                เลือกห้องเรียนที่นักเรียนคนนี้สังกัด (เฉพาะนักเรียนในศูนย์ฯ หลักเท่านั้น)
              </p>
              {classrooms.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-2">กำลังโหลดรายการห้อง...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  {classrooms.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                        classroomId === c.id
                          ? 'bg-cyan-50 border border-cyan-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="classroom"
                        value={c.id}
                        checked={classroomId === c.id}
                        onChange={(e) => setClassroomId(e.target.value)}
                        className="accent-cyan-500"
                      />
                      <span className="text-gray-900 truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Button type="submit" className="w-full" size="lg" disabled={skipping}>
              <Camera className="w-4 h-4 mr-2" />
              ถัดไป: ถ่ายรูปใบหน้า
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleSkipScan}
              disabled={skipping}
            >
              {skipping ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              ข้ามการสแกน — บันทึกเฉพาะข้อมูล
            </Button>
            <p className="text-xs text-gray-400 text-center pt-1">
              ถ้าข้ามไปก่อน สามารถมาอัปเดตใบหน้าภายหลังในแท็บ &quot;อัปเดตใบหน้า&quot;
            </p>
          </div>
        </form>

        <Button variant="ghost" className="w-full mt-4 text-gray-500" onClick={onCancel}>
          ยกเลิก กลับหน้าแรก
        </Button>
      </CardContent>
    </Card>
  )
}

// ====================================================================
// Update tab — pick existing student, scan face, replace embeddings
// ====================================================================
function UpdateTab({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState<UpdateStep>('pick')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<StudentRow | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string>('')

  useEffect(() => {
    fetch('/api/students?is_active=true')
      .then((r) => r.json())
      .then((data) => setStudents(data.students || []))
      .catch(() => setError('โหลดรายชื่อไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nickname || '').toLowerCase().includes(q) ||
      (s.service_point || '').toLowerCase().includes(q)
    )
  })

  const handleCaptureComplete = async (embeddings: FaceEmbedding[]) => {
    if (!picked) return
    setStep('saving')
    setError(null)
    try {
      const res = await fetch(`/api/students/${picked.id}/embeddings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeddings }),
      })
      if (!res.ok) throw new Error('failed')
      setSavedName(picked.name)
      setStep('done')
    } catch {
      setError('บันทึกใบหน้าไม่สำเร็จ')
      setStep('camera')
    }
  }

  const reset = () => {
    setPicked(null)
    setSavedName('')
    setStep('pick')
    setError(null)
    // Reload list to reflect updated embedding counts
    setLoading(true)
    fetch('/api/students?is_active=true')
      .then((r) => r.json())
      .then((data) => setStudents(data.students || []))
      .finally(() => setLoading(false))
  }

  if (step === 'saving') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 mx-auto mb-4 animate-spin" />
          <p className="text-lg font-medium">กำลังบันทึกใบหน้า...</p>
        </CardContent>
      </Card>
    )
  }

  if (step === 'done') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">อัปเดตใบหน้าสำเร็จ</h2>
          <p className="text-sm text-gray-500 mb-6">{savedName}</p>
          <div className="space-y-2">
            <Button onClick={reset} className="w-full">
              อัปเดตคนถัดไป
            </Button>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              กลับหน้าแรก
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'camera' && picked) {
    return (
      <div className="space-y-4">
        <Card className="border-cyan-200 bg-cyan-50/30">
          <CardContent className="py-3 flex items-center gap-3">
            <ScanFace className="w-5 h-5 text-cyan-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {picked.nickname ? `${picked.name} (${picked.nickname})` : picked.name}
              </div>
              <div className="text-xs text-gray-500">
                ใบหน้าเดิม {picked.embedding_count ?? picked.face_embeddings?.length ?? 0} ภาพ — ถ่ายใหม่ 5 ภาพเพื่อแทนที่
              </div>
            </div>
          </CardContent>
        </Card>

        <CameraCapture
          studentName={picked.name}
          onComplete={handleCaptureComplete}
          targetPhotos={5}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setPicked(null)
            setStep('pick')
            setError(null)
          }}
        >
          เลือกคนอื่น
        </Button>
      </div>
    )
  }

  // Pick step
  return (
    <Card>
      <CardHeader>
        <CardTitle>เลือกนักเรียน</CardTitle>
        <CardDescription>
          ค้นหาและเลือกนักเรียนที่ต้องการอัปเดตใบหน้า ({students.length} คน)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหา ชื่อ / ชื่อเล่น / หน่วยบริการ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-cyan-500 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">
            {students.length === 0
              ? 'ยังไม่มีนักเรียน — เพิ่มในแท็บ "ลงทะเบียนใหม่" ก่อน'
              : 'ไม่พบรายชื่อที่ค้นหา'}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {filtered.map((s) => {
              const embCount = s.embedding_count ?? s.face_embeddings?.length ?? 0
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setPicked(s)
                    setStep('camera')
                    setError(null)
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-cyan-50 rounded-xl transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {s.nickname ? `${s.name} (${s.nickname})` : s.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.service_point && (
                        <span className="text-[10px] text-gray-400 inline-flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {s.service_point}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          embCount > 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {embCount > 0 ? `${embCount} ใบหน้า` : 'ยังไม่ได้สแกน'}
                      </span>
                    </div>
                  </div>
                  <ScanFace className="w-4 h-4 text-cyan-500 shrink-0" />
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <Button variant="ghost" className="w-full text-gray-500" onClick={onCancel}>
          กลับหน้าแรก
        </Button>
      </CardContent>
    </Card>
  )
}

// ====================================================================
// Manage tab — admin-only: edit / delete any student
// ====================================================================
function ManageTab({
  servicePoints,
  onCancel,
}: {
  servicePoints: ServicePointOption[]
  onCancel: () => void
}) {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [spFilter, setSpFilter] = useState<string>('all') // service-point short_name or 'all'
  const [classroomFilter, setClassroomFilter] = useState<string>('all') // classroom id or 'all'
  const [editing, setEditing] = useState<StudentRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/students?is_active=true')
      .then((r) => r.json())
      .then((data) => setStudents(data.students || []))
      .catch(() => setError('โหลดรายชื่อไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch('/api/classrooms')
      .then((r) => r.json())
      .then((data) => setClassrooms(data.classrooms || []))
      .catch(() => {})
  }, [])

  const selectedSP = servicePoints.find((sp) => sp.short_name === spFilter)
  const isHqFilter = !!selectedSP?.is_headquarters

  // Reset classroom filter when SP filter leaves HQ.
  useEffect(() => {
    if (!isHqFilter && classroomFilter !== 'all') setClassroomFilter('all')
  }, [isHqFilter, classroomFilter])

  const filtered = students.filter((s) => {
    // Service point filter (matches stored short_name string)
    if (spFilter !== 'all' && s.service_point !== spFilter) return false

    // Classroom filter (only meaningful when HQ is selected)
    if (classroomFilter !== 'all') {
      const cid = (s as { classroom_id?: string | null }).classroom_id
      if (cid !== classroomFilter) return false
    }

    // Free-text search across name / nickname / service_point
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nickname || '').toLowerCase().includes(q) ||
      (s.service_point || '').toLowerCase().includes(q)
    )
  })

  const handleDelete = async (s: StudentRow) => {
    if (!confirm(`ลบ "${s.name}" ออกจากระบบ?\n(ลบไม่ได้แล้วถ้ายืนยัน)`)) return
    setError(null)
    try {
      const res = await fetch(`/api/students/${s.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      setStudents((prev) => prev.filter((x) => x.id !== s.id))
    } catch {
      setError('ลบไม่สำเร็จ')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>จัดการรายชื่อ</CardTitle>
        <CardDescription>
          แก้ไขหรือลบนักเรียน ({students.length} คน) — สำหรับผู้ดูแลระบบ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหา ชื่อ / ชื่อเล่น / หน่วยบริการ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
          />
        </div>

        {/* Service point / classroom filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={spFilter}
              onChange={(e) => setSpFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 appearance-none"
            >
              <option value="all">ทุกหน่วย / ศูนย์</option>
              {servicePoints.map((sp) => (
                <option key={sp.id} value={sp.short_name}>
                  {sp.short_name}
                </option>
              ))}
            </select>
          </div>

          {isHqFilter && classrooms.length > 0 && (
            <div className="relative">
              <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={classroomFilter}
                onChange={(e) => setClassroomFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 appearance-none"
              >
                <option value="all">ทุกห้องเรียน</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <span>พบ {filtered.length} จาก {students.length} คน</span>
          {(spFilter !== 'all' || classroomFilter !== 'all' || search) && (
            <button
              onClick={() => { setSpFilter('all'); setClassroomFilter('all'); setSearch('') }}
              className="text-cyan-600 hover:text-cyan-700"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-cyan-500 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">
            {students.length === 0 ? 'ยังไม่มีนักเรียนในระบบ' : 'ไม่พบรายชื่อที่ค้นหา'}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {s.nickname ? `${s.name} (${s.nickname})` : s.name}
                  </div>
                  {s.service_point && (
                    <div className="text-[10px] text-gray-400 inline-flex items-center gap-0.5 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {s.service_point}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setEditing(s)}
                  className="p-2 hover:bg-cyan-50 text-cyan-600 rounded-lg"
                  title="แก้ไข"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
                  title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <Button variant="ghost" className="w-full text-gray-500" onClick={onCancel}>
          กลับหน้าแรก
        </Button>
      </CardContent>

      {editing && (
        <ManageEditModal
          student={editing}
          servicePoints={servicePoints}
          classrooms={classrooms}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
            setEditing(null)
          }}
        />
      )}
    </Card>
  )
}

function ManageEditModal({
  student,
  servicePoints,
  classrooms,
  onClose,
  onSaved,
}: {
  student: StudentRow
  servicePoints: ServicePointOption[]
  classrooms: ClassroomOption[]
  onClose: () => void
  onSaved: (s: StudentRow) => void
}) {
  const split = splitNamePrefix(student.name)
  const [prefix, setPrefix] = useState<NamePrefix>((split.prefix || 'เด็กชาย') as NamePrefix)
  const [restName, setRestName] = useState(split.rest)
  const [nickname, setNickname] = useState(student.nickname || '')
  const initialSP =
    servicePoints.find((sp) => sp.short_name === student.service_point)?.id || ''
  const [servicePointId, setServicePointId] = useState(initialSP)
  const initialClassroom =
    (student as { classroom_id?: string | null }).classroom_id || ''
  const [classroomId, setClassroomId] = useState(initialClassroom)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isHq = !!servicePoints.find((sp) => sp.id === servicePointId)?.is_headquarters

  const handleSave = async () => {
    if (!restName.trim()) {
      setErr('กรุณากรอกชื่อ-นามสกุล')
      return
    }
    setSaving(true)
    setErr(null)
    const sp = servicePoints.find((s) => s.id === servicePointId)
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${prefix}${restName.trim()}`,
          nickname: nickname.trim() || null,
          service_point: sp?.short_name || null,
          classroom_id: isHq ? classroomId || null : null,
        }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      onSaved(data.student as StudentRow)
    } catch {
      setErr('บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[95vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">แก้ไขข้อมูลนักเรียน</h3>
            <p className="text-xs text-gray-400">{student.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">คำนำหน้า</label>
            <div className="grid grid-cols-4 gap-2">
              {NAME_PREFIXES.map((p) => (
                <label
                  key={p}
                  className={`flex items-center justify-center px-2 py-2 rounded-xl cursor-pointer transition-colors text-sm border ${
                    prefix === p
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-700 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    checked={prefix === p}
                    onChange={() => setPrefix(p)}
                    className="sr-only"
                    disabled={saving}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ชื่อ-นามสกุล</label>
            <input
              type="text"
              value={restName}
              onChange={(e) => setRestName(e.target.value)}
              disabled={saving}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ชื่อเล่น</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={saving}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ห้อง / หน่วยบริการ</label>
            <select
              value={servicePointId}
              onChange={(e) => setServicePointId(e.target.value)}
              disabled={saving}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 bg-white"
            >
              <option value="">— ไม่ระบุ —</option>
              {servicePoints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.short_name}
                </option>
              ))}
            </select>
          </div>

          {isHq && classrooms.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">ห้องเรียน (ศูนย์ฯ หลัก)</label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                disabled={saving}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 bg-white"
              >
                <option value="">— ไม่ระบุ —</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {err && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{err}</p>
          )}
        </div>

        <div className="p-5 border-t border-gray-100">
          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  )
}
