'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CameraCapture from '@/components/setup/camera-capture'
import type { FaceEmbedding } from '@/types/database'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'camera' | 'saving'>('form')
  const [studentName, setStudentName] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentName.trim()) {
      setError('กรุณากรอกชื่อนักเรียน')
      return
    }
    setError(null)
    setStep('camera')
  }

  const handleCaptureComplete = async (embeddings: FaceEmbedding[]) => {
    setStep('saving')
    setError(null)

    try {
      // 1. Create student record
      const createResponse = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          nickname: nickname || null,
        }),
      })

      if (!createResponse.ok) {
        throw new Error('Failed to create student')
      }

      const { student } = await createResponse.json()

      // 2. Save embeddings
      const embeddingsResponse = await fetch(
        `/api/students/${student.id}/embeddings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeddings }),
        }
      )

      if (!embeddingsResponse.ok) {
        throw new Error('Failed to save embeddings')
      }

      // Success! Redirect to home or student list
      alert(`ลงทะเบียน ${studentName} สำเร็จ!`)
      router.push('/')
    } catch (err) {
      console.error('Setup error:', err)
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองอีกครั้ง')
      setStep('camera')
    }
  }

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
              <CardDescription>
                กรอกข้อมูลพื้นฐานของนักเรียน
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium mb-2"
                  >
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="เช่น ด.ช. สมชาย ใจดี"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="nickname"
                    className="block text-sm font-medium mb-2"
                  >
                    ชื่อเล่น
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="เช่น ชาย"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
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
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
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
