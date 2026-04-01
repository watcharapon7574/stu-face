'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Users,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Shield,
  Clock,
  Save,
} from 'lucide-react'
import { getSavedTeacher } from '@/lib/teacher-store'

interface TeacherInfo {
  teacher_id: string
  name: string
  nickname: string | null
  is_admin: boolean
  enrolled_at: string | null
  service_point_id: string | null
  checked_in: boolean
  checked_out: boolean
  check_in_time: string | null
  check_out_time: string | null
}

interface ServicePoint {
  id: string
  name: string
  short_name: string
  lat: number
  lng: number
  radius_meters: number
  is_active: boolean
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<TeacherInfo[]>([])
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([])
  const [settings, setSettings] = useState({
    geofence_enabled: 'true',
    geofence_radius: '200',
    check_in_start: '07:00',
    check_in_end: '09:30',
    check_out_start: '15:30',
    check_out_end: '22:00',
  })

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
      setServicePoints(data.service_points || [])
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้')
    }
    setLoading(false)
  }

  const handleSave = async () => {
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
        }),
      })

      if (res.ok) {
        setSaveMsg('บันทึกสำเร็จ')
        setTimeout(() => setSaveMsg(null), 3000)
      } else {
        setSaveMsg('บันทึกไม่สำเร็จ')
      }
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

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
          <a href="/teacher-checkin" className="text-sm text-cyan-600 hover:underline">
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
            <p className="text-xs text-gray-400">Teacher Check-in Admin</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-gray-200">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{teachers.length}</div>
              <div className="text-xs text-gray-400">ครูทั้งหมด</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-green-600">{checkedInCount}</div>
              <div className="text-xs text-green-600">เข้างานแล้ว</div>
            </CardContent>
          </Card>
          <Card className="border-violet-200 bg-violet-50/50">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-violet-600">{checkedOutCount}</div>
              <div className="text-xs text-violet-600">ออกงานแล้ว</div>
            </CardContent>
          </Card>
        </div>

        {/* Settings */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-500" />
              ตั้งค่าระบบ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Geofence toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Geofence</div>
                <div className="text-xs text-gray-400">บังคับสแกนในรัศมีหน่วยบริการ</div>
              </div>
              <button
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    geofence_enabled: s.geofence_enabled === 'true' ? 'false' : 'true',
                  }))
                }
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  settings.geofence_enabled === 'true' ? 'bg-cyan-500' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    settings.geofence_enabled === 'true' ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Geofence radius */}
            {settings.geofence_enabled === 'true' && (
              <div>
                <label className="text-sm font-medium text-gray-900">
                  รัศมี Geofence (เมตร)
                </label>
                <input
                  type="number"
                  value={settings.geofence_radius}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, geofence_radius: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
                  min="50"
                  max="5000"
                />
                <p className="text-xs text-gray-400 mt-1">
                  ระยะทางสูงสุดจากหน่วยบริการที่อนุญาตให้สแกน
                </p>
              </div>
            )}

            {/* Time settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">เข้างาน เริ่ม</label>
                <input
                  type="time"
                  value={settings.check_in_start}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, check_in_start: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">เข้างาน สิ้นสุด</label>
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
                <label className="text-xs font-medium text-gray-500">ออกงาน เริ่ม</label>
                <input
                  type="time"
                  value={settings.check_out_start}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, check_out_start: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">ออกงาน สิ้นสุด</label>
                <input
                  type="time"
                  value={settings.check_out_end}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, check_out_end: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
            </div>

            {/* Save button */}
            <Button onClick={handleSave} disabled={saving} className="w-full">
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

        {/* Teachers list */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" />
              ครูที่ลงทะเบียน ({teachers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teachers.map((t) => (
                <div
                  key={t.teacher_id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {t.nickname ? `${t.name} (${t.nickname})` : t.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.is_admin && (
                        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full">
                          Admin
                        </span>
                      )}
                      {t.check_in_time && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(t.check_in_time).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.checked_in ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300" />
                    )}
                    {t.checked_out ? (
                      <CheckCircle2 className="w-5 h-5 text-violet-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                </div>
              ))}
              {teachers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีครูลงทะเบียน</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service points */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-500" />
              หน่วยบริการ ({servicePoints.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {servicePoints.map((sp, idx) => (
                <div
                  key={sp.id}
                  className="p-3 bg-gray-50 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{sp.short_name}</div>
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
                    <label className="text-xs text-gray-500 whitespace-nowrap">รัศมี (m)</label>
                    <input
                      type="number"
                      value={sp.radius_meters}
                      onChange={(e) => {
                        const updated = [...servicePoints]
                        updated[idx] = { ...sp, radius_meters: parseInt(e.target.value) || 50 }
                        setServicePoints(updated)
                      }}
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                      min="50"
                      max="5000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
