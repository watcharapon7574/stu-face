'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import FaceRecognition from '@/components/attendance/face-recognition'
import { CheckCircle2, LogIn, LogOut, Sun, Moon, Clock, MapPin, Loader2, User, X, RefreshCw, Camera } from 'lucide-react'
import type { Student, AttendanceMethod } from '@/types/database'
import { getCurrentPosition, findNearestServicePoint, findClosestServicePoint, type ServicePoint } from '@/lib/geolocation'
import { getSavedTeacher, saveTeacher, clearTeacher, type SavedTeacher } from '@/lib/teacher-store'
import { detectFaces, initializeHuman } from '@/lib/face-detection'
import type { FaceEmbedding } from '@/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

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

// --- OTP Login ---
function TeacherLogin({ onSelect }: { onSelect: (teacher: SavedTeacher) => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requestOtp = async () => {
    if (phone.replace(/\D/g, '').length < 9) {
      setError('กรุณากรอกเบอร์โทรให้ถูกต้อง')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stu-request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      setTeacherName(data.name)
      setStep('otp')
    } catch {
      setError('ไม่สามารถเชื่อมต่อได้')
    }
    setLoading(false)
  }

  const verifyOtp = async () => {
    if (otp.length !== 4) {
      setError('กรุณากรอก OTP 4 หลัก')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stu-verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      const saved: SavedTeacher = {
        id: data.teacher.id,
        name: data.teacher.name,
        nickname: data.teacher.nickname,
        avatar_url: data.teacher.avatar_url,
      }
      saveTeacher(saved)
      onSelect(saved)
    } catch {
      setError('ไม่สามารถเชื่อมต่อได้')
    }
    setLoading(false)
  }

  return (
    <div className="mt-4">
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-gray-900 text-lg">เข้าสู่ระบบ</CardTitle>
          <p className="text-sm text-gray-400">
            {step === 'phone'
              ? 'กรอกเบอร์โทรเพื่อรับ OTP ทาง Telegram (บอท OTP FastDoc)'
              : `ส่ง OTP ไปให้ ${teacherName} แล้ว`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'phone' ? (
            <>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="เบอร์โทร เช่น 0812345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
                maxLength={12}
              />
              <Button
                onClick={requestOtp}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                ส่ง OTP
              </Button>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-green-50 rounded-full px-4 py-2 border border-green-200 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700">{teacherName}</span>
                </div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="กรอก OTP 4 หลัก"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
                maxLength={4}
                autoFocus
              />
              <Button
                onClick={verifyOtp}
                disabled={loading || otp.length !== 4}
                className="w-full"
                size="lg"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                ยืนยัน
              </Button>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                เปลี่ยนเบอร์ / ส่ง OTP ใหม่
              </button>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
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
        <button
          onClick={() => onSelect('check_in')}
          disabled={isAfternoon}
          className={`group relative flex-1 rounded-3xl p-6 flex items-center gap-5 transition-all active:scale-[0.97] disabled:pointer-events-none overflow-hidden ${
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
      await initializeHuman()
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      if (mounted && videoRef.current) {
        setStream(ms)
        videoRef.current.srcObject = ms
      }
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

// --- Main ---
interface AttendanceFlowProps {
  students: Student[]
  servicePoints: ServicePoint[]
}

export default function AttendanceFlow({ students, servicePoints }: AttendanceFlowProps) {
  const [mode, setMode] = useState<'select' | 'pick_teacher' | 'face' | 'manual' | 'update_face' | 'success'>('select')
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out'>('check_in')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [updatingStudent, setUpdatingStudent] = useState<Student | null>(null)
  const [teacher, setTeacher] = useState<SavedTeacher | null>(null)
  const { status, matched, closest, coords } = useLocationDetection(servicePoints)

  // Load saved teacher from localStorage on mount
  useEffect(() => {
    const saved = getSavedTeacher()
    if (saved) setTeacher(saved)
  }, [])

  const handleAttendanceTypeSelect = (type: 'check_in' | 'check_out') => {
    setAttendanceType(type)
    if (teacher) {
      // Teacher already set, go straight to face scan
      setMode('face')
    } else {
      // Need to pick teacher first
      setMode('pick_teacher')
    }
  }

  const handleTeacherSelected = (t: SavedTeacher) => {
    setTeacher(t)
    setMode('face')
  }

  const handleChangeTeacher = () => {
    clearTeacher()
    setTeacher(null)
    setMode('pick_teacher')
  }

  const handleFaceRecognized = async (
    studentId: string,
    confidence: number,
    method: AttendanceMethod
  ) => {
    try {
      const student = students.find((s) => s.id === studentId)
      if (!student) return

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          date: new Date().toISOString().split('T')[0],
          type: attendanceType,
          confidence,
          method,
          service_point_id: matched?.id || null,
          teacher_name: teacher?.name || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      })

      if (!response.ok) throw new Error('Failed to record attendance')

      setSelectedStudent(student)
      setMode('success')

      setTimeout(() => {
        setMode('select')
        setSelectedStudent(null)
      }, 2000)
    } catch (error) {
      console.error('Error recording attendance:', error)
      alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง')
    }
  }

  const handleManualSelect = () => {
    setMode('manual')
  }

  const handleManualSelectStudent = async (student: Student) => {
    await handleFaceRecognized(student.id, 0, 'manual')
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
            onClick={handleChangeTeacher}
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

      {/* Pick teacher */}
      {mode === 'pick_teacher' && (
        <TeacherLogin onSelect={handleTeacherSelected} />
      )}

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
            students={students}
            type={attendanceType}
            onRecognized={handleFaceRecognized}
            onManualSelect={handleManualSelect}
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
                {students.map((student) => (
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

      {/* Success message */}
      {mode === 'success' && selectedStudent && (
        <div className="mt-4 flex-1 flex items-center">
          <Card className="w-full border-gray-200">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">บันทึกสำเร็จ!</h2>
              <p className="text-lg text-gray-700 mb-2">{selectedStudent.name}</p>
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
              <p className="text-gray-400 mt-2">
                {attendanceType === 'check_in' ? 'เช็คชื่อเข้า' : 'เช็คชื่อออก'} เรียบร้อยแล้ว
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
