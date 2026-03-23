'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CameraCapture from '@/components/setup/camera-capture'
import { MapPin, Building2 } from 'lucide-react'
import type { FaceEmbedding } from '@/types/database'

interface ServicePointOption {
  id: string
  name: string
  short_name: string
  district: string | null
  is_headquarters: boolean
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'camera' | 'saving'>('form')
  const [studentName, setStudentName] = useState('')
  const [nickname, setNickname] = useState('')
  const [servicePointId, setServicePointId] = useState('')
  const [servicePoints, setServicePoints] = useState<ServicePointOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/service-points')
      .then((r) => r.json())
      .then((data) => setServicePoints(data.service_points || []))
      .catch(() => {})
  }, [])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentName.trim()) {
      setError('กรุณากรอกชื่อนักเรียน')
      return
    }
    if (!servicePointId) {
      setError('กรุณาเลือกห้อง/หน่วยบริการ')
      return
    }
    setError(null)
    setStep('camera')
  }

  const handleCaptureComplete = async (embeddings: FaceEmbedding[]) => {
    setStep('saving')
    setError(null)

    try {
      const sp = servicePoints.find((s) => s.id === servicePointId)

      const createResponse = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          nickname: nickname || null,
          service_point: sp?.short_name || null,
        }),
      })

      if (!createResponse.ok) throw new Error('Failed to create student')

      const { student } = await createResponse.json()

      const embeddingsResponse = await fetch(
        `/api/students/${student.id}/embeddings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeddings }),
        }
      )

      if (!embeddingsResponse.ok) throw new Error('Failed to save embeddings')

      alert(`ลงทะเบียน ${studentName} สำเร็จ!`)
      router.push('/')
    } catch (err) {
      console.error('Setup error:', err)
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองอีกครั้ง')
      setStep('camera')
    }
  }

  // Group: headquarters first, then by district
  const hqPoints = servicePoints.filter((sp) => sp.is_headquarters)
  const otherPoints = servicePoints.filter((sp) => !sp.is_headquarters)

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">ลงทะเบียนนักเรียนใหม่</h1>
          <p className="text-gray-600">
            กรอกข้อมูลและถ่ายรูปใบหน้า 5 รูปเพื่อลงทะเบียนในระบบ
          </p>
        </div>

        {/* Step 1: Form */}
        {step === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลนักเรียน</CardTitle>
              <CardDescription>กรอกข้อมูลพื้นฐานของนักเรียน</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
                    placeholder="เช่น ด.ช. สมชาย ใจดี"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium mb-2">
                    ชื่อเล่น
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
                    placeholder="เช่น ชาย"
                  />
                </div>

                {/* Service point selector */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    ห้อง / หน่วยบริการ <span className="text-red-500">*</span>
                  </label>

                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-2">
                    {/* Headquarters */}
                    {hqPoints.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">ศูนย์หลัก</span>
                        </div>
                        {hqPoints.map((sp) => (
                          <label
                            key={sp.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              servicePointId === sp.id
                                ? 'bg-cyan-50 border border-cyan-200'
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}
                          >
                            <input
                              type="radio"
                              name="service_point"
                              value={sp.id}
                              checked={servicePointId === sp.id}
                              onChange={(e) => setServicePointId(e.target.value)}
                              className="accent-cyan-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{sp.short_name}</div>
                              <div className="text-xs text-gray-400 truncate">{sp.name}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Other service points */}
                    {otherPoints.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 px-2 py-1 mt-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">หน่วยบริการ</span>
                        </div>
                        {otherPoints.map((sp) => (
                          <label
                            key={sp.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              servicePointId === sp.id
                                ? 'bg-violet-50 border border-violet-200'
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}
                          >
                            <input
                              type="radio"
                              name="service_point"
                              value={sp.id}
                              checked={servicePointId === sp.id}
                              onChange={(e) => setServicePointId(e.target.value)}
                              className="accent-violet-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{sp.short_name}</div>
                              {sp.district && (
                                <div className="text-xs text-gray-400">อ.{sp.district}</div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg">
                  ถัดไป: ถ่ายรูปใบหน้า
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Camera Capture */}
        {step === 'camera' && (
          <CameraCapture
            studentName={studentName}
            onComplete={handleCaptureComplete}
            targetPhotos={5}
          />
        )}

        {/* Step 3: Saving */}
        {step === 'saving' && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium">กำลังบันทึกข้อมูล...</p>
            </CardContent>
          </Card>
        )}

        {error && step === 'camera' && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Back button */}
        {step !== 'saving' && (
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'camera') {
                setStep('form')
              } else {
                router.push('/')
              }
            }}
            className="w-full"
          >
            ย้อนกลับ
          </Button>
        )}
      </div>
    </main>
  )
}
