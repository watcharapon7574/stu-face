'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, CheckCircle2, SwitchCamera, Loader2, UserCheck } from 'lucide-react'
import { detectFaces, initializeHuman } from '@/lib/face-detection'
import type { FaceEmbedding } from '@/types/database'

const ANGLE_GUIDES = [
  { label: 'หน้าตรง', desc: 'มองตรงกล้อง' },
  { label: 'เอียงซ้าย', desc: 'หันหน้าไปทางซ้ายเล็กน้อย' },
  { label: 'เอียงขวา', desc: 'หันหน้าไปทางขวาเล็กน้อย' },
]

interface TeacherEnrollmentProps {
  teacherId: string
  teacherName: string
  deviceFingerprint: string
  onComplete: () => void
}

export default function TeacherEnrollment({
  teacherId,
  teacherName,
  deviceFingerprint,
  onComplete,
}: TeacherEnrollmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<FaceEmbedding[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [humanReady, setHumanReady] = useState(false)

  const startCamera = async (facing: 'user' | 'environment') => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 480 },
          height: { ideal: 640 },
        },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch {
      setError('ไม่สามารถเข้าถึงกล้องได้')
    }
  }

  useEffect(() => {
    let mounted = true
    initializeHuman()
      .then(() => {
        if (mounted) setHumanReady(true)
      })
      .catch(() => {
        if (mounted) setError('โหลดระบบไม่สำเร็จ')
      })
    startCamera(facingMode)
    return () => {
      mounted = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const toggleCamera = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newFacing)
    await startCamera(newFacing)
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setIsCapturing(true)
    setError(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Extract embedding client-side
      const { embeddings } = await detectFaces(canvas)
      if (embeddings.length === 0) {
        setError('ไม่พบใบหน้า ลองอีกครั้ง')
        setIsCapturing(false)
        return
      }
      if (embeddings.length > 1) {
        setError('พบมากกว่า 1 ใบหน้า')
        setIsCapturing(false)
        return
      }

      const newEmbeddings = [...capturedEmbeddings, embeddings[0]]
      setCapturedEmbeddings(newEmbeddings)

      if (newEmbeddings.length >= 3) {
        stream?.getTracks().forEach((t) => t.stop())
        await saveEmbeddings(newEmbeddings)
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
    } finally {
      setIsCapturing(false)
    }
  }

  const saveEmbeddings = async (embeddings: FaceEmbedding[]) => {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/teacher-checkin/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          embeddings,
          device_fingerprint: deviceFingerprint,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message || 'ลงทะเบียนไม่สำเร็จ')
        setCapturedEmbeddings([])
        await startCamera(facingMode)
        setIsSaving(false)
        return
      }

      onComplete()
    } catch {
      setError('ไม่สามารถบันทึกได้')
      setCapturedEmbeddings([])
      await startCamera(facingMode)
      setIsSaving(false)
    }
  }

  const currentStep = capturedEmbeddings.length
  const guide = ANGLE_GUIDES[currentStep] || ANGLE_GUIDES[0]
  const progress = (currentStep / 3) * 100

  if (isSaving) {
    return (
      <Card className="border-gray-200">
        <CardContent className="py-16 text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-bold text-gray-900">กำลังลงทะเบียนใบหน้า...</h3>
          <p className="text-sm text-gray-400 mt-1">กรุณารอสักครู่</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-cyan-500" />
          ลงทะเบียนใบหน้า
        </CardTitle>
        <CardDescription>
          {teacherName} — ถ่ายรูป 3 มุม ({currentStep}/3)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Angle guide */}
        {currentStep < 3 && (
          <div className="text-center bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3">
            <div className="text-lg font-bold text-cyan-700">{guide.label}</div>
            <div className="text-sm text-cyan-600">{guide.desc}</div>
          </div>
        )}

        {/* Video preview */}
        <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Face guide circle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-white/40 rounded-full w-48 h-48" />
          </div>

          {/* Switch camera */}
          <button
            onClick={toggleCamera}
            className="absolute top-3 right-3 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>

          {!humanReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                <span className="text-white text-sm">กำลังโหลดระบบ...</span>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {/* Step indicators */}
        <div className="flex gap-2 justify-center">
          {ANGLE_GUIDES.map((a, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 ${
                i === currentStep ? 'scale-110' : ''
              } transition-transform`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium ${
                  i < currentStep
                    ? 'bg-green-500 text-white'
                    : i === currentStep
                    ? 'bg-cyan-500 text-white ring-2 ring-cyan-300'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < currentStep ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[9px] ${
                  i === currentStep ? 'text-cyan-600 font-medium' : 'text-gray-400'
                }`}
              >
                {a.label}
              </span>
            </div>
          ))}
        </div>

        {/* Capture button */}
        <Button
          onClick={capturePhoto}
          disabled={isCapturing || currentStep >= 3 || !humanReady}
          className="w-full"
          size="lg"
        >
          <Camera className="w-5 h-5 mr-2" />
          {isCapturing ? 'กำลังถ่ายรูป...' : `ถ่าย: ${guide.label}`}
        </Button>
      </CardContent>
    </Card>
  )
}
