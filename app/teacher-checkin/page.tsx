import Link from 'next/link'
import { Wrench } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function TeacherCheckinDisabledPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
          <Wrench className="w-6 h-6 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          ระบบลงชื่อทำงาน ปิดปรับปรุงชั่วคราว
        </h1>
        <p className="text-sm text-gray-500">
          ระบบสแกนหน้าครูถูกปิดไว้ก่อน เพื่อใช้งานเฉพาะระบบรับ-ส่งนักเรียน
        </p>
        <Link
          href="/"
          className="inline-block mt-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm rounded-xl transition-colors"
        >
          ไปหน้ารับ-ส่งนักเรียน
        </Link>
      </div>
    </main>
  )
}
