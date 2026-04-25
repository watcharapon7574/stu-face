'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Users,
  MapPin,
  Loader2,
  ArrowLeft,
  Shield,
  Save,
  ScanFace,
  Trash2,
  Pencil,
  UserPlus,
  GraduationCap,
  AlarmClock,
} from 'lucide-react'
import { getSavedTeacher } from '@/lib/teacher-store'
import FaceCaptureModal from '@/components/admin/face-capture-modal'
import StudentFormModal, {
  type StudentFormData,
} from '@/components/admin/student-form-modal'
import AddTeacherModal, {
  type CandidateProfile,
} from '@/components/admin/add-teacher-modal'
import type { FaceEmbedding } from '@/types/database'

type Tab = 'teachers' | 'students' | 'service_points'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  })
}

interface TeacherInfo {
  teacher_id: string
  name: string
  nickname: string | null
  phone: string | null
  workplace: string | null
  is_admin: boolean
  enrolled_at: string | null
  service_point_id: string | null
  embedding_count: number
  checked_in: boolean
  checked_out: boolean
  check_in_time: string | null
  check_out_time: string | null
  is_late: boolean
  late_reason: string | null
}

interface StudentInfo {
  id: string
  name: string
  nickname: string | null
  date_of_birth: string | null
  service_point_id: string | null
  is_active: boolean
  embedding_count: number
  photo_url: string | null
}

interface ServicePoint {
  id: string
  name: string
  short_name: string
  lat: number
  lng: number
  radius_meters: number
  is_active: boolean
  is_headquarters: boolean
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('teachers')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [teachers, setTeachers] = useState<TeacherInfo[]>([])
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([])
  const [candidates, setCandidates] = useState<CandidateProfile[]>([])
  const [autoCheckouts, setAutoCheckouts] = useState<
    {
      teacher_id: string
      teacher_name: string
      date: string
      check_in: string | null
      check_out: string | null
    }[]
  >([])
  const [settings, setSettings] = useState({
    geofence_enabled: 'true',
    check_in_start: '07:00',
    check_in_end: '09:30',
    check_out_start: '15:30',
    check_out_end: '22:00',
  })

  // Modals
  const [faceModal, setFaceModal] = useState<
    | { kind: 'teacher'; id: string; name: string }
    | { kind: 'student'; id: string; name: string }
    | null
  >(null)
  const [studentModal, setStudentModal] = useState<{
    mode: 'edit'
    student: StudentInfo
  } | null>(null)
  const [addTeacherOpen, setAddTeacherOpen] = useState(false)

  const teacher = getSavedTeacher()

  useEffect(() => {
    if (!teacher) {
      setError('กรุณาล็อกอินก่อน')
      setLoading(false)
      return
    }
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/teacher-checkin/admin?teacher_id=${teacher!.id}`)
      if (res.status === 403) {
        setError('ไม่มีสิทธิ์เข้าถึงหน้า Admin')
        setLoading(false)
        return
      }
      const data = await res.json()
      setSettings((prev) => ({ ...prev, ...data.settings }))
      setTeachers(data.teachers || [])
      setStudents(data.students || [])
      setServicePoints(data.service_points || [])
      setCandidates(data.candidate_profiles || [])
      setAutoCheckouts(data.auto_checkouts || [])
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้')
    }
    setLoading(false)
  }

  const handleSaveSettings = async () => {
    if (!teacher) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/teacher-checkin/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacher.id,
          settings,
          service_points: servicePoints.map((sp) => ({
            id: sp.id,
            radius_meters: sp.radius_meters,
          })),
          teacher_admins: teachers.map((t) => ({
            teacher_id: t.teacher_id,
            is_admin: t.is_admin,
          })),
        }),
      })
      setSaveMsg(res.ok ? 'บันทึกสำเร็จ' : 'บันทึกไม่สำเร็จ')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  // --- Teacher actions ---
  const handleTeacherFaceUpdate = async (
    teacherId: string,
    embeddings: FaceEmbedding[]
  ) => {
    const res = await fetch('/api/teacher-checkin/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_id: teacherId, embeddings }),
    })
    if (!res.ok) throw new Error('failed')
    setFaceModal(null)
    await fetchData()
  }

  const handleTeacherDelete = async (t: TeacherInfo) => {
    if (!confirm(`ยืนยันลบ ${t.name || t.nickname} ออกจากระบบครู?`)) return
    const res = await fetch(`/api/teacher-checkin/teachers/${t.teacher_id}`, {
      method: 'DELETE',
    })
    if (res.ok) await fetchData()
  }

  const handleAddTeacher = async (profile: CandidateProfile) => {
    const res = await fetch(`/api/teacher-checkin/teachers/${profile.id}`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error('failed')
    setAddTeacherOpen(false)
    await fetchData()
  }

  // --- Student actions ---
  const handleStudentSave = async (data: StudentFormData) => {
    if (!studentModal) return
    const res = await fetch(`/api/students/${studentModal.student.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('failed')
    setStudentModal(null)
    await fetchData()
  }

  const handleStudentFaceUpdate = async (
    studentId: string,
    embeddings: FaceEmbedding[]
  ) => {
    const res = await fetch(`/api/students/${studentId}/embeddings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeddings }),
    })
    if (!res.ok) throw new Error('failed')
    setFaceModal(null)
    await fetchData()
  }

  const handleStudentDelete = async (s: StudentInfo) => {
    if (!confirm(`ยืนยันลบ ${s.name || s.nickname}?`)) return
    const res = await fetch(`/api/students/${s.id}`, { method: 'DELETE' })
    if (res.ok) await fetchData()
  }

  // --- Renders ---

  if (loading) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{error}</h1>
          <a
            href="/teacher-checkin"
            className="text-sm text-cyan-600 hover:underline"
          >
            กลับหน้าสแกนเข้างาน
          </a>
        </div>
      </main>
    )
  }

  const checkedInCount = teachers.filter((t) => t.checked_in).length
  const checkedOutCount = teachers.filter((t) => t.checked_out).length

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <a
            href="/teacher-checkin"
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="text-lg font-bold text-gray-900">จัดการระบบ</h1>
            <p className="text-xs text-gray-400">Admin</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {[
            { id: 'teachers' as Tab, label: 'ครู', icon: Users },
            { id: 'students' as Tab, label: 'นักเรียน', icon: GraduationCap },
            { id: 'service_points' as Tab, label: 'หน่วย', icon: MapPin },
          ].map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-white text-cyan-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Teachers Tab */}
        {tab === 'teachers' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-gray-200">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{teachers.length}</div>
                  <div className="text-xs text-gray-400">ทั้งหมด</div>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{checkedInCount}</div>
                  <div className="text-xs text-green-600">เข้างาน</div>
                </CardContent>
              </Card>
              <Card className="border-violet-200 bg-violet-50/50">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold text-violet-600">{checkedOutCount}</div>
                  <div className="text-xs text-violet-600">ออกงาน</div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-gray-200">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-500" />
                  รายชื่อครู ({teachers.length})
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setAddTeacherOpen(true)}
                  disabled={candidates.length === 0}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  เพิ่มครู
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teachers.map((t) => (
                    <div
                      key={t.teacher_id}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {t.nickname ? `${t.name} (${t.nickname})` : t.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <button
                            onClick={() => {
                              setTeachers((arr) =>
                                arr.map((x) =>
                                  x.teacher_id === t.teacher_id
                                    ? { ...x, is_admin: !x.is_admin }
                                    : x
                                )
                              )
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full transition ${
                              t.is_admin
                                ? 'bg-cyan-100 text-cyan-700'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            Admin {t.is_admin ? '✓' : ''}
                          </button>
                          {t.embedding_count === 0 ? (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                              รอลงทะเบียน
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              {t.embedding_count} ใบหน้า
                            </span>
                          )}
                          <span
                            className={`text-[10px] tabular-nums ${
                              t.check_in_time
                                ? 'text-gray-600'
                                : 'text-gray-300'
                            }`}
                          >
                            {formatTime(t.check_in_time)} → {formatTime(t.check_out_time)}
                          </span>
                          {t.is_late && (
                            <span
                              className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full"
                              title={t.late_reason || ''}
                            >
                              สาย
                            </span>
                          )}
                        </div>
                        {t.is_late && t.late_reason && (
                          <div className="text-[11px] text-amber-700/80 mt-1 italic truncate">
                            “{t.late_reason}”
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() =>
                            setFaceModal({
                              kind: 'teacher',
                              id: t.teacher_id,
                              name: t.name || t.nickname || '',
                            })
                          }
                          className="ml-1 p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg"
                          title="อัปเดตใบหน้า"
                        >
                          <ScanFace className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTeacherDelete(t)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {teachers.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      ยังไม่มีครูลงทะเบียน
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Forgot-checkout list (last 14 days) */}
            {autoCheckouts.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlarmClock className="w-4 h-4 text-amber-500" />
                    ลืมออกงาน ({autoCheckouts.length} ครั้ง / 14 วัน)
                  </CardTitle>
                  <p className="text-[11px] text-amber-700 mt-1">
                    ระบบ auto-checkout ตามเวลา check_out_end ที่ตั้งไว้
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {autoCheckouts.map((a, idx) => (
                      <div
                        key={`${a.teacher_id}-${a.date}-${idx}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-amber-100"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {a.teacher_name}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(a.date).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                              timeZone: 'Asia/Bangkok',
                            })}
                          </div>
                        </div>
                        <div className="text-[10px] tabular-nums text-gray-500 text-right shrink-0">
                          {formatTime(a.check_in)} → {formatTime(a.check_out)}
                          <div className="text-[9px] text-amber-600">auto</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Settings card (moved from settings tab) */}
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyan-500" />
                  ตั้งค่าระบบ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Geofence</div>
                    <div className="text-xs text-gray-400">
                      บังคับสแกนในรัศมีหน่วยบริการ
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        geofence_enabled:
                          s.geofence_enabled === 'true' ? 'false' : 'true',
                      }))
                    }
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      settings.geofence_enabled === 'true'
                        ? 'bg-cyan-500'
                        : 'bg-gray-200'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        settings.geofence_enabled === 'true'
                          ? 'translate-x-5'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      เข้างาน เริ่ม
                    </label>
                    <input
                      type="time"
                      value={settings.check_in_start}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          check_in_start: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      เข้างาน สิ้นสุด
                    </label>
                    <input
                      type="time"
                      value={settings.check_in_end}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, check_in_end: e.target.value }))
                      }
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      ออกงาน เริ่ม
                    </label>
                    <input
                      type="time"
                      value={settings.check_out_start}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          check_out_start: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      ออกงาน สิ้นสุด
                    </label>
                    <input
                      type="time"
                      value={settings.check_out_end}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          check_out_end: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  บันทึกการตั้งค่า
                </Button>

                {saveMsg && (
                  <p
                    className={`text-sm text-center ${
                      saveMsg.includes('สำเร็จ') ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {saveMsg}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Students Tab */}
        {tab === 'students' && (
          <Card className="border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-cyan-500" />
                รายชื่อนักเรียน ({students.length})
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">
                เพิ่มนักเรียนใหม่ที่หน้า{' '}
                <a href="/setup" className="text-cyan-600 hover:underline">
                  /setup
                </a>
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {students.map((s) => {
                  const sp = servicePoints.find((p) => p.id === s.service_point_id)
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {s.nickname ? `${s.name} (${s.nickname})` : s.name}
                          {!s.is_active && (
                            <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                              ปิดใช้งาน
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-400">
                            {s.embedding_count} ใบหน้า
                          </span>
                          {sp && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {sp.short_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => setStudentModal({ mode: 'edit', student: s })}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="แก้ไข"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setFaceModal({
                              kind: 'student',
                              id: s.id,
                              name: s.name || s.nickname || '',
                            })
                          }
                          className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg"
                          title="อัปเดตใบหน้า"
                        >
                          <ScanFace className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStudentDelete(s)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {students.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    ยังไม่มีนักเรียน
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service Points Tab */}
        {tab === 'service_points' && (() => {
          const hqList = servicePoints.filter((sp) => sp.is_headquarters)
          const branchList = servicePoints.filter((sp) => !sp.is_headquarters)
          const updateRadius = (id: string, radius: number) => {
            setServicePoints((prev) =>
              prev.map((p) => (p.id === id ? { ...p, radius_meters: radius } : p))
            )
          }
          const renderItem = (sp: ServicePoint) => (
            <div key={sp.id} className="p-3 bg-gray-50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {sp.short_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {sp.lat.toFixed(4)}, {sp.lng.toFixed(4)}
                  </div>
                </div>
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    sp.is_active ? 'bg-green-400' : 'bg-gray-300'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap">
                  รัศมี (m)
                </label>
                <input
                  type="number"
                  value={sp.radius_meters}
                  onChange={(e) =>
                    updateRadius(sp.id, parseInt(e.target.value) || 50)
                  }
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  min="50"
                  max="5000"
                />
              </div>
            </div>
          )
          return (
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-500" />
                  หน่วยบริการ ({branchList.length}) · ศูนย์ ({hqList.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hqList.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">
                      ศูนย์ ({hqList.length})
                    </div>
                    {hqList.map(renderItem)}
                  </div>
                )}

                {branchList.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      หน่วยบริการ ({branchList.length})
                    </div>
                    {branchList.map(renderItem)}
                  </div>
                )}

                <Button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  บันทึกรัศมี
                </Button>
                {saveMsg && (
                  <p
                    className={`text-sm text-center ${
                      saveMsg.includes('สำเร็จ') ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {saveMsg}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })()}
      </div>

      {/* Modals */}
      {faceModal && (
        <FaceCaptureModal
          title={`อัปเดตใบหน้า: ${faceModal.name}`}
          subtitle={
            faceModal.kind === 'teacher' ? 'ถ่ายรูป 3 มุม' : 'ถ่ายรูป 5 มุม'
          }
          frameCount={faceModal.kind === 'teacher' ? 3 : 5}
          onClose={() => setFaceModal(null)}
          onComplete={async (embs) => {
            if (faceModal.kind === 'teacher') {
              await handleTeacherFaceUpdate(faceModal.id, embs)
            } else {
              await handleStudentFaceUpdate(faceModal.id, embs)
            }
          }}
        />
      )}

      {studentModal && (
        <StudentFormModal
          mode="edit"
          initial={studentModal.student}
          servicePoints={servicePoints}
          onClose={() => setStudentModal(null)}
          onSave={handleStudentSave}
        />
      )}

      {addTeacherOpen && (
        <AddTeacherModal
          candidates={candidates}
          onClose={() => setAddTeacherOpen(false)}
          onAdd={handleAddTeacher}
        />
      )}
    </main>
  )
}
