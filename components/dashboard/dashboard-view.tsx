'use client'

import { useState, useEffect } from 'react'
import RealTimeAttendance from '@/components/dashboard/real-time-attendance'
import {
  MapPin,
  ChevronDown,
  Users,
  GraduationCap,
  LogIn,
  LogOut,
  AlarmClock,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { getSavedTeacher } from '@/lib/teacher-store'
import { supabase } from '@/lib/supabase/client'
import type { AttendanceWithRelations } from '@/types/database'

interface ServicePoint {
  id: string
  name: string
  short_name: string
  is_headquarters: boolean
}

export interface TeacherAttendanceRow {
  id: string
  teacher_id: string
  teacher_name: string
  teacher_nickname: string | null
  check_in: string | null
  check_out: string | null
  service_point_id: string | null
  auto_checkout: boolean
  is_late: boolean
  late_reason: string | null
}

interface DashboardViewProps {
  initialAttendance: AttendanceWithRelations[]
  initialTeacherAttendance: TeacherAttendanceRow[]
  initialDate: string
  totalStudents: number
  totalTeachers: number
  servicePoints: ServicePoint[]
  teacherServicePointMap: Record<string, string>
  teacherProfileLookup: Record<string, { name: string; nickname: string | null }>
  managementIds: string[]
}

type Tab = 'student' | 'teacher'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DashboardView({
  initialAttendance,
  initialTeacherAttendance,
  initialDate,
  totalStudents,
  totalTeachers,
  servicePoints,
  teacherServicePointMap,
  teacherProfileLookup,
  managementIds,
}: DashboardViewProps) {
  const [tab, setTab] = useState<Tab>('student')
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedSP, setSelectedSP] = useState<string>('all')
  const [isManagement, setIsManagement] = useState(false)
  const [teacherSPId, setTeacherSPId] = useState<string | null>(null)
  const [teacherRows, setTeacherRows] =
    useState<TeacherAttendanceRow[]>(initialTeacherAttendance)

  // Realtime subscription for teacher attendance (today only)
  useEffect(() => {
    setTeacherRows(initialTeacherAttendance)

    if (selectedDate !== initialDate) return

    const channel = supabase
      .channel('teacher-attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'std_teacher_attendance',
          filter: `date=eq.${selectedDate}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id
            if (oldId) {
              setTeacherRows((prev) => prev.filter((r) => r.id !== oldId))
            }
            return
          }
          const row = payload.new as Record<string, unknown>
          const profile = teacherProfileLookup[row.teacher_id as string]
          const updated: TeacherAttendanceRow = {
            id: row.id as string,
            teacher_id: row.teacher_id as string,
            teacher_name: profile?.name || 'ไม่ทราบ',
            teacher_nickname: profile?.nickname || null,
            check_in: (row.check_in as string | null) ?? null,
            check_out: (row.check_out as string | null) ?? null,
            service_point_id: (row.service_point_id as string | null) ?? null,
            auto_checkout: !!row.auto_checkout,
            is_late: !!row.is_late,
            late_reason: (row.late_reason as string | null) ?? null,
          }
          setTeacherRows((prev) => {
            const idx = prev.findIndex((r) => r.id === updated.id)
            if (idx >= 0) {
              const copy = [...prev]
              copy[idx] = updated
              return copy
            }
            return [updated, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDate, initialDate, initialTeacherAttendance, teacherProfileLookup])

  useEffect(() => {
    const teacher = getSavedTeacher()
    if (teacher) {
      const isMgmt = managementIds.includes(teacher.id)
      setIsManagement(isMgmt)

      if (!isMgmt) {
        const spId = teacherServicePointMap[teacher.name]
        if (spId) {
          setTeacherSPId(spId)
          setSelectedSP(spId)
        }
      }
    }
  }, [managementIds, teacherServicePointMap])

  // Student filter (by teacher_name → service_point_id mapping)
  const filteredAttendance =
    selectedSP === 'all'
      ? initialAttendance
      : initialAttendance.filter((record) => {
          const teacherName = (record as any).teacher_name as string | null
          if (!teacherName) return false
          return teacherServicePointMap[teacherName] === selectedSP
        })

  // Teacher filter (by service_point_id directly on the row)
  const filteredTeacherAttendance =
    selectedSP === 'all'
      ? teacherRows
      : teacherRows.filter((r) => r.service_point_id === selectedSP)

  // Counts for service-point dropdown badges (student tab only)
  const spCounts: Record<string, number> = {}
  for (const record of initialAttendance) {
    const teacherName = (record as any).teacher_name as string | null
    if (teacherName && teacherServicePointMap[teacherName]) {
      const spId = teacherServicePointMap[teacherName]
      spCounts[spId] = (spCounts[spId] || 0) + 1
    }
  }

  const filteredTotalStudents =
    selectedSP === 'all' ? totalStudents : filteredAttendance.length

  const currentSPName =
    selectedSP === 'all'
      ? 'ทุกสถานที่'
      : servicePoints.find((sp) => sp.id === selectedSP)?.short_name || 'ไม่ทราบสถานที่'

  // Teacher stats
  const checkedInCount = filteredTeacherAttendance.filter((t) => t.check_in).length
  const checkedOutCount = filteredTeacherAttendance.filter((t) => t.check_out).length
  const lateCount = filteredTeacherAttendance.filter((t) => t.is_late).length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-400">ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี</p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('student')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'student'
              ? 'bg-white text-cyan-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          นักเรียน
          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full ml-1">
            {filteredAttendance.length}
          </span>
        </button>
        <button
          onClick={() => setTab('teacher')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'teacher'
              ? 'bg-white text-cyan-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          ครู
          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full ml-1">
            {filteredTeacherAttendance.length}
          </span>
        </button>
      </div>

      {/* Service Point Filter */}
      {servicePoints.length > 0 && (
        isManagement ? (
          <div className="relative">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-500" />
              <select
                value={selectedSP}
                onChange={(e) => setSelectedSP(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 cursor-pointer w-full"
              >
                <option value="all">
                  ทุกสถานที่ (
                  {tab === 'student'
                    ? `${initialAttendance.length} รายการ`
                    : `${teacherRows.length} ครู`}
                  )
                </option>
                {servicePoints.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.short_name}
                    {tab === 'student' && spCounts[sp.id]
                      ? ` (${spCounts[sp.id]} รายการ)`
                      : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" />
            </div>
          </div>
        ) : teacherSPId ? (
          <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-2.5">
            <MapPin className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-medium text-cyan-700">{currentSPName}</span>
            <span className="text-xs text-cyan-500 bg-cyan-100 px-2 py-0.5 rounded-full ml-auto">
              {tab === 'student'
                ? `${filteredAttendance.length} รายการ`
                : `${filteredTeacherAttendance.length} ครู`}
            </span>
          </div>
        ) : null
      )}

      {tab === 'student' ? (
        <RealTimeAttendance
          date={selectedDate}
          initialData={filteredAttendance}
          totalStudents={selectedSP === 'all' ? totalStudents : filteredTotalStudents}
          servicePointId={selectedSP === 'all' ? undefined : selectedSP}
          servicePointName={
            selectedSP === 'all'
              ? undefined
              : servicePoints.find((sp) => sp.id === selectedSP)?.short_name
          }
          isHeadquarters={
            selectedSP === 'all'
              ? true
              : servicePoints.find((sp) => sp.id === selectedSP)?.is_headquarters ?? true
          }
          teacherServicePointMap={teacherServicePointMap}
        />
      ) : (
        <TeacherAttendancePanel
          rows={filteredTeacherAttendance}
          totalTeachers={
            selectedSP === 'all' ? totalTeachers : filteredTeacherAttendance.length
          }
          checkedInCount={checkedInCount}
          checkedOutCount={checkedOutCount}
          lateCount={lateCount}
        />
      )}
    </div>
  )
}

function TeacherAttendancePanel({
  rows,
  totalTeachers,
  checkedInCount,
  checkedOutCount,
  lateCount,
}: {
  rows: TeacherAttendanceRow[]
  totalTeachers: number
  checkedInCount: number
  checkedOutCount: number
  lateCount: number
}) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalTeachers}</div>
          <div className="text-xs text-gray-400">ทั้งหมด</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{checkedInCount}</div>
          <div className="text-xs text-green-600 flex items-center justify-center gap-1">
            <LogIn className="w-3 h-3" />
            เข้างาน
          </div>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 text-center">
          <div className="text-2xl font-bold text-violet-600">{checkedOutCount}</div>
          <div className="text-xs text-violet-600 flex items-center justify-center gap-1">
            <LogOut className="w-3 h-3" />
            ออกงาน
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{lateCount}</div>
          <div className="text-xs text-amber-600 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            มาสาย
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-500" />
          <h2 className="text-base font-semibold text-gray-900">รายการลงชื่อทำงาน</h2>
        </div>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">ยังไม่มีรายการในวันนี้</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {r.teacher_nickname
                      ? `${r.teacher_name} (${r.teacher_nickname})`
                      : r.teacher_name}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {r.is_late && (
                      <span
                        className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full"
                        title={r.late_reason || undefined}
                      >
                        สาย{r.late_reason ? `: ${r.late_reason.slice(0, 30)}${r.late_reason.length > 30 ? '…' : ''}` : ''}
                      </span>
                    )}
                    {r.auto_checkout && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        <AlarmClock className="w-2.5 h-2.5" />
                        auto-out
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
                  <div className="flex items-center gap-1 text-green-600">
                    <LogIn className="w-3 h-3" />
                    {formatTime(r.check_in)}
                  </div>
                  <span className="text-gray-300">→</span>
                  <div
                    className={`flex items-center gap-1 ${
                      r.check_out ? 'text-violet-600' : 'text-gray-300'
                    }`}
                  >
                    {r.check_out ? <LogOut className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {formatTime(r.check_out)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
