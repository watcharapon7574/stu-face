'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { AttendanceWithRelations } from '@/types/database'

interface RealTimeAttendanceProps {
  date?: string
  servicePointId?: string
}

export default function RealTimeAttendance({
  date = new Date().toISOString().split('T')[0],
  servicePointId,
}: RealTimeAttendanceProps) {
  const [attendance, setAttendance] = useState<AttendanceWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch initial data
    async function fetchAttendance() {
      try {
        const url = new URL('/api/attendance', window.location.origin)
        url.searchParams.set('date', date)
        if (servicePointId) {
          url.searchParams.set('service_point_id', servicePointId)
        }

        const response = await fetch(url.toString())
        if (!response.ok) throw new Error('Failed to fetch attendance')

        const data = await response.json()
        setAttendance(data.attendance || [])
      } catch (error) {
        console.error('Error fetching attendance:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `date=eq.${date}`,
        },
        async (payload) => {
          console.log('Real-time update:', payload)

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch the complete record with relations
            const { data: newRecord } = await supabase
              .from('attendance')
              .select(`
                *,
                student:student_id (*),
                teacher:teacher_id (*)
              `)
              .eq('id', payload.new.id)
              .single()

            if (newRecord) {
              setAttendance((prev) => {
                const existing = prev.findIndex((r) => r.id === newRecord.id)
                if (existing >= 0) {
                  // Update existing
                  const updated = [...prev]
                  updated[existing] = newRecord
                  return updated
                } else {
                  // Add new
                  return [newRecord, ...prev]
                }
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setAttendance((prev) => prev.filter((r) => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [date, servicePointId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p>กำลังโหลดข้อมูล...</p>
        </CardContent>
      </Card>
    )
  }

  const stats = {
    total: attendance.length,
    checkedIn: attendance.filter((a) => a.check_in).length,
    checkedOut: attendance.filter((a) => a.check_out).length,
    present: attendance.filter((a) => a.check_in && !a.check_out).length,
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">นักเรียนทั้งหมด</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.checkedIn}
            </div>
            <div className="text-sm text-gray-600">เช็คชื่อเข้า</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats.present}
            </div>
            <div className="text-sm text-gray-600">อยู่ในศูนย์</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats.checkedOut}
            </div>
            <div className="text-sm text-gray-600">เช็คชื่อออก</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance list */}
      <Card>
        <CardHeader>
          <CardTitle>รายการเช็คชื่อวันนี้</CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              ยังไม่มีการเช็คชื่อ
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {attendance.map((record) => (
                <div
                  key={record.id}
                  className="border rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {record.student?.name || 'Unknown'}
                    </div>
                    {record.student?.nickname && (
                      <div className="text-sm text-gray-500">
                        ({record.student.nickname})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Check-in status */}
                    <div className="text-right">
                      {record.check_in ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">
                            {new Date(record.check_in).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">-</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-500">เข้า</div>
                    </div>

                    {/* Check-out status */}
                    <div className="text-right">
                      {record.check_out ? (
                        <div className="flex items-center gap-1 text-purple-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">
                            {new Date(record.check_out).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">-</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-500">ออก</div>
                    </div>

                    {/* Method indicator */}
                    {record.method_in && (
                      <div className="text-xs">
                        {record.method_in === 'auto' && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            อัตโนมัติ
                          </span>
                        )}
                        {record.method_in === 'suggestion' && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            แนะนำ
                          </span>
                        )}
                        {record.method_in === 'manual' && (
                          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            เลือกเอง
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
