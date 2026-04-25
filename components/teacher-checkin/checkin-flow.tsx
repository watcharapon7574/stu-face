'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  Sun,
  Moon,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  Shield,
  Settings,
  MapPinOff,
} from 'lucide-react'
import { getSavedTeacher, saveTeacher, clearTeacher, type SavedTeacher } from '@/lib/teacher-store'
import { getDeviceFingerprint } from '@/lib/device-fingerprint'
import { saveCheckinStatus, getCheckinStatus } from '@/lib/teacher-checkin-store'
import { getCurrentPosition } from '@/lib/geolocation'
import TeacherEnrollment from './teacher-enrollment'
import FaceCapture, { type VerifyResult } from './face-capture'

type FlowState =
  | 'loading'
  | 'not_logged_in'
  | 'not_enrolled'
  | 'select_type'
  | 'enter_late_reason'
  | 'scanning'
  | 'success'

type LocationStatus = 'loading' | 'in_range' | 'out_of_range' | 'error' | 'disabled'

interface ServicePointInfo {
  id: string
  name: string
  short_name: string
  lat: number
  lng: number
  radius_meters: number
}

interface CheckinFlowProps {
  loginComponent: React.ReactNode
}

// Haversine distance
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function CheckinFlow({ loginComponent }: CheckinFlowProps) {
  const [state, setState] = useState<FlowState>('loading')
  const [teacher, setTeacher] = useState<SavedTeacher | null>(null)
  const [deviceFP, setDeviceFP] = useState('')
  const [checkType, setCheckType] = useState<'check_in' | 'check_out'>('check_in')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [fpWarning, setFpWarning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Geofencing
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading')
  const [nearestPoint, setNearestPoint] = useState<ServicePointInfo | null>(null)
  const [distanceToNearest, setDistanceToNearest] = useState<number | null>(null)
  const [geofenceEnabled, setGeofenceEnabled] = useState(true)
  const [servicePoints, setServicePoints] = useState<ServicePointInfo[]>([])

  // Time windows (from settings)
  const [timeSettings, setTimeSettings] = useState({
    check_in_start: '07:00',
    check_in_end: '09:30',
    check_out_start: '15:30',
    check_out_end: '22:00',
  })

  // Late reason flow
  const [lateReason, setLateReason] = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    initFlow()
  }, [])

  const initFlow = async () => {
    const saved = getSavedTeacher()
    if (!saved) {
      setState('not_logged_in')
      return
    }
    setTeacher(saved)

    const fp = await getDeviceFingerprint()
    setDeviceFP(fp)

    try {
      const res = await fetch(
        `/api/teacher-checkin/status?teacher_id=${saved.id}&date=${today}`
      )
      const data = await res.json()

      // Device fingerprint check
      if (data.device_fingerprint && data.device_fingerprint !== fp) {
        setFpWarning(true)
      }

      // Admin
      setIsAdmin(data.is_admin || false)

      // Settings
      if (data.settings) {
        setGeofenceEnabled(data.settings.geofence_enabled)
        setTimeSettings({
          check_in_start: data.settings.check_in_start,
          check_in_end: data.settings.check_in_end,
          check_out_start: data.settings.check_out_start,
          check_out_end: data.settings.check_out_end,
        })
      }

      // Service points
      if (data.service_points) {
        setServicePoints(data.service_points)
      }

      // Geofencing check
      if (data.settings?.geofence_enabled && data.service_points?.length > 0) {
        checkGeofence(data.service_points)
      } else {
        setLocationStatus('disabled')
      }

      if (!data.enrolled) {
        setState('not_enrolled')
        return
      }

      if (!saved.face_enrolled) {
        saveTeacher({ ...saved, face_enrolled: true })
      }

      const localStatus = getCheckinStatus(saved.id)
      if (localStatus?.checked_in || data.checked_in) {
        if (data.checked_out) {
          setResult({
            matched: true,
            confidence: 0,
            is_real: true,
            anti_spoof_score: 0,
            spoofing_scores: [],
            frame_results: { total: 0, real: 0, matched: 0 },
            attendance_saved: true,
            message: 'สแกนเข้า-ออกงานครบแล้ววันนี้',
          })
          setState('success')
          return
        }
        setCheckType('check_out')
      }

      setState('select_type')
    } catch {
      setState('select_type')
    }
  }

  const checkGeofence = async (points: ServicePointInfo[]) => {
    setLocationStatus('loading')
    try {
      const pos = await getCurrentPosition()
      const { latitude, longitude } = pos.coords

      // Find nearest service point
      let nearest: ServicePointInfo | null = null
      let minDist = Infinity

      for (const sp of points) {
        const dist = haversineDistance(latitude, longitude, sp.lat, sp.lng)
        if (dist < minDist) {
          minDist = dist
          nearest = sp
        }
      }

      setNearestPoint(nearest)
      setDistanceToNearest(Math.round(minDist))

      if (nearest && minDist <= nearest.radius_meters) {
        setLocationStatus('in_range')
      } else {
        setLocationStatus('out_of_range')
      }
    } catch {
      setLocationStatus('error')
    }
  }

  const handleTypeSelect = (type: 'check_in' | 'check_out') => {
    // Block if out of range and geofence enabled
    if (geofenceEnabled && locationStatus === 'out_of_range') {
      setError(
        `อยู่นอกรัศมี${nearestPoint?.short_name || 'หน่วยบริการ'} (${distanceToNearest}m / ${nearestPoint?.radius_meters ?? 0}m) ไม่สามารถสแกนได้`
      )
      return
    }

    // Time-window check for check_in
    if (type === 'check_in') {
      const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      const now = new Date()
      const nowM = now.getHours() * 60 + now.getMinutes()
      const startM = toMin(timeSettings.check_in_start)
      const endM = toMin(timeSettings.check_in_end)
      const cutoffM = toMin(timeSettings.check_out_start)

      if (nowM < startM) {
        setError(`ยังไม่ถึงเวลาเข้างาน (เริ่ม ${timeSettings.check_in_start})`)
        return
      }
      if (nowM >= cutoffM) {
        setError(`เลยเวลาเข้างานแล้ว (ปิดรับเวลา ${timeSettings.check_out_start})`)
        return
      }
      if (nowM > endM) {
        // Late — collect reason before scanning
        setCheckType(type)
        setLateReason('')
        setError(null)
        setState('enter_late_reason')
        return
      }
    }

    setCheckType(type)
    setLateReason('')
    setError(null)
    setState('scanning')
  }

  const handleLateReasonSubmit = () => {
    if (!lateReason.trim()) {
      setError('กรุณาระบุเหตุผลที่มาสาย')
      return
    }
    setError(null)
    setState('scanning')
  }

  const handleScanSuccess = (res: VerifyResult) => {
    setResult(res)
    if (teacher) {
      saveCheckinStatus({
        teacher_id: teacher.id,
        date: today,
        checked_in: true,
        check_in_time:
          checkType === 'check_in'
            ? new Date().toISOString()
            : getCheckinStatus(teacher.id)?.check_in_time,
        checked_out: checkType === 'check_out',
        check_out_time:
          checkType === 'check_out' ? new Date().toISOString() : undefined,
      })
    }
    setState('success')
  }

  const handleScanError = (message: string) => {
    setError(message)
  }

  const handleEnrollmentComplete = () => {
    if (teacher) {
      saveTeacher({ ...teacher, face_enrolled: true })
    }
    setState('select_type')
  }

  const handleLogout = () => {
    clearTeacher()
    setTeacher(null)
    setState('not_logged_in')
  }

  // --- Renders ---

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    )
  }

  if (state === 'not_logged_in') {
    return <>{loginComponent}</>
  }

  const hours = new Date().getHours()
  const isAfternoon = hours >= 12

  return (
    <div className="space-y-4">
      {/* Teacher info bar */}
      {teacher && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {teacher.nickname || teacher.name}
              </div>
              <div className="text-xs text-gray-400">
                ครูผู้สอน {isAdmin && <span className="text-cyan-500">(Admin)</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <a
                href="/teacher-checkin/admin"
                className="p-2 text-gray-400 hover:text-cyan-600 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      )}

      {/* Location badge */}
      {geofenceEnabled && (
        <div className="flex justify-center">
          {locationStatus === 'loading' && (
            <div className="inline-flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100">
              <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
              <span className="text-xs text-gray-400">ระบุตำแหน่ง...</span>
            </div>
          )}
          {locationStatus === 'in_range' && nearestPoint && (
            <div className="inline-flex items-center gap-2 bg-green-50 rounded-full px-3 py-1.5 border border-green-200">
              <MapPin className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs text-green-700 font-medium">
                {nearestPoint.short_name} ({distanceToNearest}m)
              </span>
            </div>
          )}
          {locationStatus === 'out_of_range' && nearestPoint && (
            <div className="inline-flex items-center gap-2 bg-red-50 rounded-full px-3 py-1.5 border border-red-200">
              <MapPinOff className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs text-red-700">
                ห่างจาก {nearestPoint.short_name} {distanceToNearest}m (เกิน {nearestPoint.radius_meters}m)
              </span>
            </div>
          )}
          {locationStatus === 'error' && (
            <div className="inline-flex items-center gap-2 bg-amber-50 rounded-full px-3 py-1.5 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-700">ไม่สามารถระบุตำแหน่งได้</span>
            </div>
          )}
        </div>
      )}

      {/* Device fingerprint warning */}
      {fpWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 font-medium">อุปกรณ์ไม่ตรงกัน</p>
            <p className="text-xs text-amber-600 mt-0.5">กรุณาใช้อุปกรณ์เดิมที่ลงทะเบียนไว้</p>
          </div>
        </div>
      )}

      {/* Enrollment */}
      {state === 'not_enrolled' && teacher && (
        <TeacherEnrollment
          teacherId={teacher.id}
          teacherName={teacher.nickname || teacher.name}
          deviceFingerprint={deviceFP}
          onComplete={handleEnrollmentComplete}
        />
      )}

      {/* Select check-in or check-out */}
      {state === 'select_type' && (
        <>
          <TypeSelect isAfternoon={isAfternoon} onSelect={handleTypeSelect} />
          {/* Error from geofence */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
        </>
      )}

      {/* Late reason input */}
      {state === 'enter_late_reason' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-amber-900">มาสาย</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  เลยเวลาเข้างานปกติ ({timeSettings.check_in_end}) — กรุณาระบุเหตุผล
                </p>
              </div>
            </div>
            <textarea
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder="เช่น รถติด, มีนัดหมอ, ส่งลูกที่โรงเรียน..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 bg-white"
              maxLength={300}
            />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm text-center">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setLateReason('')
                  setError(null)
                  setState('select_type')
                }}
                variant="outline"
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button onClick={handleLateReasonSubmit} className="flex-1">
                ดำเนินการต่อ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Face scanning */}
      {state === 'scanning' && teacher && (
        <>
          <FaceCapture
            teacherId={teacher.id}
            checkType={checkType}
            date={today}
            deviceFingerprint={deviceFP}
            servicePointId={nearestPoint?.id}
            lateReason={lateReason || null}
            onSuccess={handleScanSuccess}
            onError={handleScanError}
          />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          <Button onClick={() => setState('select_type')} variant="outline" className="w-full">
            ยกเลิก
          </Button>
        </>
      )}

      {/* Success */}
      {state === 'success' && result && (
        <Card className="border-gray-200">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{result.message}</h2>
            {teacher && (
              <p className="text-lg text-gray-700 mb-1">{teacher.nickname || teacher.name}</p>
            )}
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mt-3 flex-wrap">
              {nearestPoint && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {nearestPoint.short_name}
                </span>
              )}
              {result.confidence > 0 && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  {(result.confidence * 100).toFixed(0)}%
                </span>
              )}
              {result.is_real && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ใบหน้าจริง
                </span>
              )}
              {result.is_late && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  มาสาย
                </span>
              )}
            </div>

            {checkType === 'check_in' && (
              <Button
                onClick={() => handleTypeSelect('check_out')}
                variant="outline"
                className="mt-6"
                disabled={!isAfternoon}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isAfternoon ? 'สแกนออกงาน' : 'รอช่วงบ่ายเพื่อสแกนออก'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// --- Type Selection Sub-component ---
function TypeSelect({
  isAfternoon,
  onSelect,
}: {
  isAfternoon: boolean
  onSelect: (type: 'check_in' | 'check_out') => void
}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!now) {
    return <div className="flex flex-col flex-1" aria-hidden />
  }

  const hours = now.getHours()
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const greeting =
    hours < 12 ? 'สวัสดีตอนเช้า' : hours < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'

  return (
    <div className="flex flex-col flex-1">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 border border-gray-100">
          {hours < 17 ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
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
          {!isAfternoon && (
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-cyan-50 opacity-60" />
          )}
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              isAfternoon ? 'bg-gray-100' : 'bg-gradient-to-br from-cyan-100 to-cyan-50 shadow-sm'
            }`}
          >
            <LogIn className={`w-6 h-6 ${isAfternoon ? 'text-gray-300' : 'text-cyan-600'}`} />
          </div>
          <div className="relative flex-1 text-left">
            <div className={`text-2xl font-bold ${isAfternoon ? 'text-gray-300' : 'text-gray-900'}`}>
              เข้างาน
            </div>
            <div className={`text-sm ${isAfternoon ? 'text-gray-200' : 'text-gray-400'}`}>
              Check in
            </div>
          </div>
          {!isAfternoon && (
            <div className="relative mr-2">
              <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                <LogIn className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
        </button>

        <button
          onClick={() => onSelect('check_out')}
          disabled={!isAfternoon}
          className={`group relative flex-1 rounded-3xl p-6 flex items-center gap-5 transition-all active:scale-[0.97] disabled:pointer-events-none overflow-hidden ${
            !isAfternoon
              ? 'bg-gray-50/80 border border-gray-100'
              : 'bg-white border border-violet-200 shadow-[0_2px_20px_rgba(130,80,220,0.10)] hover:shadow-[0_8px_32px_rgba(130,80,220,0.18)] hover:border-violet-300'
          }`}
        >
          {isAfternoon && (
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-violet-50 opacity-60" />
          )}
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              !isAfternoon ? 'bg-gray-100' : 'bg-gradient-to-br from-violet-100 to-violet-50 shadow-sm'
            }`}
          >
            <LogOut className={`w-6 h-6 ${!isAfternoon ? 'text-gray-300' : 'text-violet-600'}`} />
          </div>
          <div className="relative flex-1 text-left">
            <div className={`text-2xl font-bold ${!isAfternoon ? 'text-gray-300' : 'text-gray-900'}`}>
              ออกงาน
            </div>
            <div className={`text-sm ${!isAfternoon ? 'text-gray-200' : 'text-gray-400'}`}>
              Check out
            </div>
          </div>
          {isAfternoon && (
            <div className="relative mr-2">
              <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
                <LogOut className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 mt-4 mb-2">
        <Clock className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-xs text-gray-300">
          {isAfternoon ? 'ช่วงบ่าย — สแกนออกงาน' : 'ช่วงเช้า — สแกนเข้างาน'}
        </span>
      </div>
    </div>
  )
}
