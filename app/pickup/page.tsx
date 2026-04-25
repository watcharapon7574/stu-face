import { Bus, Construction } from 'lucide-react'

export default function PickupPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-50 flex items-center justify-center">
          <Bus className="w-8 h-8 text-cyan-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          รับ-ส่ง นักเรียน
        </h1>
        <p className="text-sm text-gray-400 mb-4 flex items-center justify-center gap-1.5">
          <Construction className="w-4 h-4" />
          อยู่ระหว่างพัฒนา
        </p>
        <a
          href="/"
          className="text-sm text-cyan-600 hover:underline"
        >
          กลับหน้าแรก
        </a>
      </div>
    </main>
  )
}
