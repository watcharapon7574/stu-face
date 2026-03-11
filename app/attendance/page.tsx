'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import FaceRecognition from '@/components/attendance/face-recognition'
import { CheckCircle2 } from 'lucide-react'
import type { Student, AttendanceMethod } from '@/types/database'

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'select' | 'face' | 'manual' | 'success'>('select')
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out'>('check_in')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  // Fetch students
  useEffect(() => {
    async function fetchStudents() {
      try {
        const response = await fetch('/api/students?is_active=true')
        if (!response.ok) throw new Error('Failed to fetch students')

        const data = await response.json()
        setStudents(data.students || [])
      } catch (error) {
        console.error('Error fetching students:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [])

  const handleAttendanceTypeSelect = (type: 'check_in' | 'check_out') => {
    setAttendanceType(type)
    setMode('face')
  }

  const handleFaceRecognized = async (
    studentId: string,
    confidence: number,
    method: AttendanceMethod
  ) => {
    try {
      const student = students.find((s) => s.id === studentId)
      if (!student) return

      // Record attendance
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          date: new Date().toISOString().split('T')[0],
          type: attendanceType,
          confidence,
          method,
        }),
      })

      if (!response.ok) throw new Error('Failed to record attendance')

      // If successful, add embedding for rolling update
      if (method === 'auto' && confidence >= 0.85) {
        // This would be done in the background
        // For now, we'll skip it to keep the flow simple
      }

      setSelectedStudent(student)
      setMode('success')

      // Auto-reset after 2 seconds
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
          <p>กำลังโหลด...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">เช็คชื่อนักเรียน</h1>
          <p className="text-gray-600">
            ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี
          </p>
        </div>

        {/* Select attendance type */}
        {mode === 'select' && (
          <Card>
            <CardHeader>
              <CardTitle>เลือกประเภทการเช็คชื่อ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => handleAttendanceTypeSelect('check_in')}
                className="w-full"
                size="lg"
                variant="default"
              >
                เช็คชื่อเข้า (เช้า)
              </Button>
              <Button
                onClick={() => handleAttendanceTypeSelect('check_out')}
                className="w-full"
                size="lg"
                variant="secondary"
              >
                เช็คชื่อออก (เย็น)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Face recognition mode */}
        {mode === 'face' && (
          <>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
              <strong>โหมด:</strong> {attendanceType === 'check_in' ? 'เช็คชื่อเข้า' : 'เช็คชื่อออก'}
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
          </>
        )}

        {/* Manual selection mode */}
        {mode === 'manual' && (
          <Card>
            <CardHeader>
              <CardTitle>เลือกนักเรียน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleManualSelectStudent(student)}
                    className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left"
                  >
                    <div className="font-medium">{student.name}</div>
                    {student.nickname && (
                      <div className="text-sm text-gray-500">
                        ({student.nickname})
                      </div>
                    )}
                  </button>
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
        )}

        {/* Success message */}
        {mode === 'success' && selectedStudent && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">บันทึกสำเร็จ!</h2>
              <p className="text-lg mb-4">{selectedStudent.name}</p>
              <p className="text-gray-600">
                {attendanceType === 'check_in' ? 'เช็คชื่อเข้า' : 'เช็คชื่อออก'} เรียบร้อยแล้ว
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
