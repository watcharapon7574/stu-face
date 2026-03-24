'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CheckCircle2, Clock, Users, LogIn, LogOut, UserCheck, User, MapPin } from 'lucide-react'
import type { AttendanceWithRelations } from '@/types/database'

interface RealTimeAttendanceProps {
  date?: string
  initialData?: AttendanceWithRelations[]
  totalStudents?: number
  servicePointId?: string
  servicePointName?: string
  isHeadquarters?: boolean
  teacherServicePointMap?: Record<string, string>
}

export default function RealTimeAttendance({
  date = new Date().toISOString().split('T')[0],
  initialData = [],
  totalStudents = 0,
  servicePointId,
  servicePointName,
  isHeadquarters = true,
  teacherServicePointMap = {},
}: RealTimeAttendanceProps) {
  const [attendance, setAttendance] = useState<AttendanceWithRelations[]>(initialData)

  useEffect(() => {
    setAttendance(initialData)

    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'std_attendance',
          filter: `date=eq.${date}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: newRecord } = await supabase
              .from('std_attendance' as any)
              .select('*, student:student_id (*)')
              .eq('id', payload.new.id)
              .single()

            if (newRecord) {
              // Filter by service point if one is selected
              if (servicePointId) {
                const teacherName = (newRecord as any).teacher_name as string | null
                if (!teacherName || teacherServicePointMap[teacherName] !== servicePointId) {
                  return
                }
              }
              setAttendance((prev) => {
                const idx = prev.findIndex((r) => r.id === newRecord.id)
                if (idx >= 0) {
                  const updated = [...prev]
                  updated[idx] = newRecord
                  return updated
                }
                return [newRecord, ...prev]
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setAttendance((prev) => prev.filter((r) => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [date, initialData, servicePointId, teacherServicePointMap])

  const stats = {
    total: totalStudents,
    checkedIn: attendance.filter((a) => a.check_in).length,
    checkedOut: attendance.filter((a) => a.check_out).length,
    present: attendance.filter((a) => a.check_in && !a.check_out).length,
    absent: totalStudents - attendance.filter((a) => a.check_in).length,
  }

  const checkedInPct = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0
  const placeLabel = !servicePointId ? 'อยู่ในศูนย์/หน่วย' : isHeadquarters ? 'อยู่ในศูนย์' : 'อยู่ในหน่วย'

  return (
    <div className="space-y-4">
      {/* Service point name header */}
      {servicePointName && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-medium text-gray-700">{servicePointName}</span>
        </div>
      )}

      {/* Summary ring + stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="นักเรียนทั้งหมด"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={<LogIn className="w-4 h-4" />}
          label="เช็คชื่อเข้า"
          value={stats.checkedIn}
          sub={`${checkedInPct}%`}
          color="green"
        />
        <StatCard
          icon={<UserCheck className="w-4 h-4" />}
          label={placeLabel}
          value={stats.present}
          color="amber"
        />
        <StatCard
          icon={<LogOut className="w-4 h-4" />}
          label="เช็คชื่อออก"
          value={stats.checkedOut}
          color="violet"
        />
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">อัตราเช็คชื่อเข้า</span>
          <span className="text-sm font-semibold text-gray-900">{stats.checkedIn}/{stats.total}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${checkedInPct}%` }}
          />
        </div>
        {stats.absent > 0 && (
          <p className="text-xs text-gray-400 mt-2">ยังไม่เช็คชื่อ {stats.absent} คน</p>
        )}
      </div>

      {/* Attendance list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            รายการเช็คชื่อวันนี้
          </h2>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
            {attendance.length} รายการ
          </span>
        </div>

        {attendance.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">ยังไม่มีการเช็คชื่อ</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
            {attendance.map((record) => (
              <div key={record.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <User className="w-4 h-4 text-gray-400" />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {record.student?.name || 'Unknown'}
                    </span>
                    {record.student?.nickname && (
                      <span className="text-xs text-gray-400 truncate">({record.student.nickname})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {/* Teacher */}
                    {(record as any).teacher_name && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {(record as any).teacher_name}
                      </span>
                    )}
                    {/* Method badge */}
                    {record.method_in && (
                      <MethodBadge method={record.method_in} />
                    )}
                  </div>
                </div>

                {/* Time columns */}
                <div className="flex items-center gap-4 shrink-0">
                  <TimeCell
                    time={record.check_in}
                    label="เข้า"
                    color="green"
                  />
                  <TimeCell
                    time={record.check_out}
                    label="ออก"
                    color="violet"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  color: 'blue' | 'green' | 'amber' | 'violet'
}) {
  const colors = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-500', value: 'text-blue-600' },
    green: { bg: 'bg-green-50', icon: 'text-green-500', value: 'text-green-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-500', value: 'text-amber-600' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-500', value: 'text-violet-600' },
  }
  const c = colors[color]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl ${c.bg} ${c.icon} mb-3`}>
        {icon}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${c.value}`}>{value}</span>
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}

function TimeCell({
  time,
  label,
  color,
}: {
  time: string | null
  label: string
  color: 'green' | 'violet'
}) {
  const iconColor = color === 'green' ? 'text-green-500' : 'text-violet-500'

  return (
    <div className="text-right min-w-[3.5rem]">
      {time ? (
        <div className={`flex items-center gap-1 justify-end ${iconColor}`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">
            {new Date(time).toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1 justify-end text-gray-300">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs">-</span>
        </div>
      )}
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  )
}

function MethodBadge({ method }: { method: string }) {
  const styles: Record<string, string> = {
    auto: 'bg-green-50 text-green-700 border-green-200',
    suggestion: 'bg-blue-50 text-blue-700 border-blue-200',
    manual: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  const labels: Record<string, string> = {
    auto: 'อัตโนมัติ',
    suggestion: 'แนะนำ',
    manual: 'เลือกเอง',
  }

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${styles[method] || styles.manual}`}>
      {labels[method] || method}
    </span>
  )
}
