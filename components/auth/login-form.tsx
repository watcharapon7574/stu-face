'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { saveTeacher, type SavedTeacher } from '@/lib/teacher-store'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

interface LoginFormProps {
  onLoggedIn: (teacher: SavedTeacher) => void
}

export default function LoginForm({ onLoggedIn }: LoginFormProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const otp = otpDigits.join('')
  const [teacherName, setTeacherName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requestOtp = async () => {
    if (phone.replace(/\D/g, '').length < 9) {
      setError('กรุณากรอกเบอร์โทรให้ถูกต้อง')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stu-request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      setTeacherName(data.name)
      setStep('otp')
    } catch {
      setError('ไม่สามารถเชื่อมต่อได้')
    }
    setLoading(false)
  }

  const verifyOtp = async () => {
    if (otp.length !== 4) {
      setError('กรุณากรอก OTP 4 หลัก')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stu-verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      const saved: SavedTeacher = {
        id: data.teacher.id,
        name: data.teacher.name,
        nickname: data.teacher.nickname,
        avatar_url: data.teacher.avatar_url,
      }
      saveTeacher(saved)
      onLoggedIn(saved)
    } catch {
      setError('ไม่สามารถเชื่อมต่อได้')
    }
    setLoading(false)
  }

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 text-lg">เข้าสู่ระบบ</CardTitle>
        <p className="text-sm text-gray-400">
          {step === 'phone'
            ? 'กรอกเบอร์โทรเพื่อรับ OTP ทาง Telegram (บอท OTP FastDoc)'
            : `ส่ง OTP ไปให้ ${teacherName} แล้ว`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'phone' ? (
          <>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="เบอร์โทร เช่น 0812345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
              maxLength={12}
            />
            <Button
              onClick={requestOtp}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ส่ง OTP
            </Button>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-green-50 rounded-full px-4 py-2 border border-green-200 mb-4">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">{teacherName}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={digit}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(-1)
                    setOtpDigits((prev) => {
                      const next = [...prev]
                      next[i] = v
                      return next
                    })
                    if (v && i < 3) otpRefs.current[i + 1]?.focus()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
                      otpRefs.current[i - 1]?.focus()
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault()
                    const pasted = e.clipboardData
                      .getData('text')
                      .replace(/\D/g, '')
                      .slice(0, 4)
                    if (!pasted) return
                    const next = ['', '', '', '']
                    for (let k = 0; k < pasted.length; k++) next[k] = pasted[k]
                    setOtpDigits(next)
                    const focusIdx = Math.min(pasted.length, 3)
                    otpRefs.current[focusIdx]?.focus()
                  }}
                  maxLength={1}
                  autoFocus={i === 0}
                  className="w-14 h-16 text-center text-2xl font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
                />
              ))}
            </div>
            <Button
              onClick={verifyOtp}
              disabled={loading || otp.length !== 4}
              className="w-full"
              size="lg"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ยืนยัน
            </Button>
            <button
              onClick={() => {
                setStep('phone')
                setOtpDigits(['', '', '', ''])
                setError('')
              }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              เปลี่ยนเบอร์ / ส่ง OTP ใหม่
            </button>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
