import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, UserPlus, BarChart3 } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            ระบบเช็คชื่อศูนย์การศึกษาพิเศษ
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            เขต 6 ลพบุรี
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Face Recognition System powered by AI
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Attendance */}
          <Link href="/attendance" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <Camera className="w-12 h-12 mb-2 text-blue-600" />
                <CardTitle>เช็คชื่อ</CardTitle>
                <CardDescription>
                  เช็คชื่อเข้า-ออกด้วย Face Recognition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">เริ่มเช็คชื่อ</Button>
              </CardContent>
            </Card>
          </Link>

          {/* Setup */}
          <Link href="/setup" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <UserPlus className="w-12 h-12 mb-2 text-green-600" />
                <CardTitle>ลงทะเบียน</CardTitle>
                <CardDescription>
                  ลงทะเบียนนักเรียนใหม่ในระบบ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full">
                  เพิ่มนักเรียน
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Dashboard */}
          <Link href="/dashboard" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <BarChart3 className="w-12 h-12 mb-2 text-purple-600" />
                <CardTitle>Dashboard</CardTitle>
                <CardDescription>
                  สรุปและรายงานการเข้าเรียน
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  ดู Dashboard
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>คุณสมบัติของระบบ</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>
                  <strong>Face Recognition บน Browser:</strong> ใช้ @vladmandic/human ประมวลผลบนอุปกรณ์ ไม่ต้องส่งข้อมูลไปยัง Cloud
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>
                  <strong>Rolling Embedding Update:</strong> ระบบเรียนรู้ใบหน้าที่เปลี่ยนไปตามเวลาอัตโนมัติ
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>
                  <strong>Real-time Dashboard:</strong> ดูสถานะการเข้าเรียนแบบ real-time ด้วย Supabase Realtime
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>
                  <strong>PWA Support:</strong> ติดตั้งเป็นแอพบนมือถือได้
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>
                  <strong>3-tier Confidence:</strong> อัตโนมัติ (85%+) / แนะนำ (60-85%) / เลือกเอง (&lt;60%)
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
