'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, LogIn, LogOut, Trash2 } from 'lucide-react'
import type { AttendanceWithRelations } from '@/types/database'

interface Props {
  record: AttendanceWithRelations
  submitting: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

// Card-based confirm for deleting an attendance row. We avoid native
// confirm()/alert() because the kiosk runs on touch displays where native
// dialogs look broken and inconsistent with the rest of the app.
export default function DeleteAttendanceModal({
  record,
  submitting,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const name = record.student?.nickname
    ? `${record.student.name} (${record.student.nickname})`
    : record.student?.name || 'รายการนี้'

  const formatTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Bangkok',
        })
      : null

  const checkInStr = formatTime(record.check_in)
  const checkOutStr = formatTime(record.check_out)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-md border-gray-200">
        <CardHeader className="pb-2">
          <div className="-mx-6 -mt-6 mb-2 px-5 py-4 rounded-t-lg border-b bg-gradient-to-br from-red-50 to-white border-red-200">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              ยืนยันการลบ
            </p>
            <p className="text-2xl font-bold text-gray-900 leading-tight break-words">
              {name}
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5">
              ⚠️ บันทึกการเช็คชื่อจะถูกลบถาวร
            </p>
          </div>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            รายการที่จะลบ
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
            {checkInStr && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <LogIn className="w-4 h-4 text-green-600" />
                <span>เช็คชื่อเข้า</span>
                <span className="ml-auto font-medium tabular-nums">{checkInStr}</span>
              </div>
            )}
            {checkOutStr && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <LogOut className="w-4 h-4 text-violet-600" />
                <span>เช็คชื่อออก</span>
                <span className="ml-auto font-medium tabular-nums">{checkOutStr}</span>
              </div>
            )}
            {!checkInStr && !checkOutStr && (
              <div className="text-sm text-gray-500">ไม่มีเวลาเช็คชื่อในระบบ</div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs text-center">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={onConfirm}
              disabled={submitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              ลบบันทึก
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
