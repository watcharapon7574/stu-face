'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, CheckCircle2, SwitchCamera, Loader2, UserCheck } from 'lucide-react'

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
  const [capturedImages, setCapturedImages] = useState<string[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

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
    startCamera(facingMode)
    return () => {
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

      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.85)
      const newImages = [...capturedImages, base64]
      setCapturedImages(newImages)

      // If all 3 photos taken, send to API
      if (newImages.length >= 3) {
        stream?.getTracks().forEach((t) => t.stop())
        await enrollFace(newImages)
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
    } finally {
      setIsCapturing(false)
    }
  }

  const enrollFace = async (images: string[]) => {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/teacher-checkin/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          images,
          device_fingerprint: deviceFingerprint,
          skip_anti_spoof: true,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message || 'ลงทะเบียนไม่สำเร็จ')
        // Reset to try again
        setCapturedImages([])
        await startCamera(facingMode)
        setIsSaving(false)
        return
      }

      onComplete()
    } catch {
      setError('ไม่สามารถเชื่อมต่อ API ได้')
      setCapturedImages([])
      await startCamera(facingMode)
      setIsSaving(false)
    }
  }

  const currentStep = capturedImages.length
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
            style={{ transform: 'none' }}
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
          disabled={isCapturing || currentStep >= 3}
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
