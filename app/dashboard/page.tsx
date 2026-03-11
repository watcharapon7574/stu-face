'use client'

import { useState } from 'react'
import RealTimeAttendance from '@/components/dashboard/real-time-attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600">
              ศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="date" className="text-sm font-medium">
              วันที่:
            </label>
            <input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <RealTimeAttendance date={selectedDate} />

        {/* Additional info */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลระบบ</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Real-time Updates:</span>
              <span className="font-medium text-green-600">เปิดใช้งาน</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Face Recognition:</span>
              <span className="font-medium">@vladmandic/human (On-device)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Database:</span>
              <span className="font-medium">Supabase (Realtime enabled)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
