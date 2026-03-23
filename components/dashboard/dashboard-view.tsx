'use client'

import { useState, useEffect } from 'react'
import RealTimeAttendance from '@/components/dashboard/real-time-attendance'
import { MapPin, ChevronDown } from 'lucide-react'
import { getSavedTeacher } from '@/lib/teacher-store'
import type { AttendanceWithRelations } from '@/types/database'

interface ServicePoint {
  id: string
  name: string
  short_name: string
  is_headquarters: boolean
}

interface DashboardViewProps {
  initialAttendance: AttendanceWithRelations[]
  initialDate: string
  totalStudents: number
  servicePoints: ServicePoint[]
  teacherServicePointMap: Record<string, string>
  managementIds: string[]
}

export default function DashboardView({
  initialAttendance,
  initialDate,
  totalStudents,
  servicePoints,
  teacherServicePointMap,
  managementIds,
}: DashboardViewProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedSP, setSelectedSP] = useState<string>('all')
  const [isManagement, setIsManagement] = useState(false)
  const [teacherSPId, setTeacherSPId] = useState<string | null>(null)

  // Check if current user is management
  useEffect(() => {
    const teacher = getSavedTeacher()
    if (teacher) {
      const isMgmt = managementIds.includes(teacher.id)
      setIsManagement(isMgmt)

      if (!isMgmt) {
        // Find this teacher's service point by name
        const spId = teacherServicePointMap[teacher.name]
        if (spId) {
          setTeacherSPId(spId)
          setSelectedSP(spId)
        }
      }
    }
  }, [managementIds, teacherServicePointMap])

  // Filter attendance by selected service point
  const filteredAttendance =
    selectedSP === 'all'
      ? initialAttendance
      : initialAttendance.filter((record) => {
          const teacherName = (record as any).teacher_name as string | null
          if (!teacherName) return false
          return teacherServicePointMap[teacherName] === selectedSP
        })

  // Count attendance per service point for badges
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

  // Get current service point name
  const currentSPName =
    selectedSP === 'all'
      ? 'ทุกสถานที่'
      : servicePoints.find((sp) => sp.id === selectedSP)?.short_name || 'ไม่ทราบสถานที่'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
        />
      </div>

      {/* Service Point Filter */}
      {servicePoints.length > 0 && (
        isManagement ? (
          /* Management: Dropdown to select service point */
          <div className="relative">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-500" />
              <select
                value={selectedSP}
                onChange={(e) => setSelectedSP(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 cursor-pointer w-full"
              >
                <option value="all">
                  ทุกสถานที่ ({initialAttendance.length} รายการ)
                </option>
                {servicePoints.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.short_name}
                    {spCounts[sp.id] ? ` (${spCounts[sp.id]} รายการ)` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" />
            </div>
          </div>
        ) : teacherSPId ? (
          /* Regular teacher: Show their location as a badge */
          <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-2.5">
            <MapPin className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-medium text-cyan-700">{currentSPName}</span>
            <span className="text-xs text-cyan-500 bg-cyan-100 px-2 py-0.5 rounded-full ml-auto">
              {filteredAttendance.length} รายการ
            </span>
          </div>
        ) : null
      )}

      <RealTimeAttendance
        date={selectedDate}
        initialData={filteredAttendance}
        totalStudents={selectedSP === 'all' ? totalStudents : filteredTotalStudents}
        servicePointId={selectedSP === 'all' ? undefined : selectedSP}
        teacherServicePointMap={teacherServicePointMap}
      />
    </div>
  )
}
