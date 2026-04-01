'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScanFace, Loader2, SwitchCamera, AlertTriangle } from 'lucide-react'

interface FaceCaptureProps {
  teacherId: string
  checkType: 'check_in' | 'check_out'
  date: string
  deviceFingerprint: string
  servicePointId?: string | null
  onSuccess: (result: VerifyResult) => void
  onError: (message: string) => void
}

export interface VerifyResult {
  matched: boolean
  confidence: number
  is_real: boolean
  anti_spoof_score: number
  spoofing_scores: number[]
  frame_results: { total: number; real: number; matched: number }
  attendance_saved: boolean
  message: string
}

const FRAME_COUNT = 3
const FRAME_INTERVAL_MS = 400

export default function FaceCapture({
  teacherId,
  checkType,
  date,
  deviceFingerprint,
  servicePointId,
  onSuccess,
  onError,
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 480 },
          height: { ideal: 640 },
        },
      })
      setStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop())
        return mediaStream
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch {
      setError('ไม่สามารถเข้าถึงกล้องได้')
    }
  }, [])

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

  const captureFrames = async (): Promise<string[]> => {
    const frames: string[] = []

    for (let i = 0; i < FRAME_COUNT; i++) {
      if (!videoRef.current || !canvasRef.current) break

      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const base64 = canvas.toDataURL('image/jpeg', 0.85)
      frames.push(base64)

      setScanProgress(((i + 1) / FRAME_COUNT) * 100)

      // Wait between frames
      if (i < FRAME_COUNT - 1) {
        await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS))
      }
    }

    return frames
  }

  const handleScan = async () => {
    setIsScanning(true)
    setError(null)
    setScanProgress(0)

    try {
      // Auto-capture 3 frames
      const frames = await captureFrames()

      if (frames.length < FRAME_COUNT) {
        setError('ไม่สามารถจับภาพได้ครบ กรุณาลองอีกครั้ง')
        setIsScanning(false)
        return
      }

      // Send to API
      setScanProgress(100)
      const res = await fetch('/api/teacher-checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          frames,
          device_fingerprint: deviceFingerprint,
          service_point_id: servicePointId || null,
          check_type: checkType,
          date,
        }),
      })

      const data: VerifyResult = await res.json()

      if (!res.ok) {
        onError(data.message || 'เกิดข้อผิดพลาด')
        setIsScanning(false)
        return
      }

      if (data.matched && data.attendance_saved) {
        stream?.getTracks().forEach((t) => t.stop())
        onSuccess(data)
      } else {
        setError(data.message)
        setIsScanning(false)
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อ API ได้')
      setIsScanning(false)
    }
  }

  const label = checkType === 'check_in' ? 'เข้างาน' : 'ออกงาน'

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ScanFace className="w-5 h-5 text-cyan-500" />
          สแกนหน้า{label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video preview */}
        <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Face guide circle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`border-2 rounded-full w-48 h-48 transition-colors duration-300 ${
                isScanning ? 'border-cyan-400 animate-pulse' : 'border-white/40'
              }`}
            />
          </div>

          {/* Switch camera */}
          {!isScanning && (
            <button
              onClick={toggleCamera}
              className="absolute top-3 right-3 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">
                    กำลังสแกน...
                  </div>
                  <div className="w-full h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Scan button */}
        <Button
          onClick={handleScan}
          disabled={isScanning}
          className="w-full"
          size="lg"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              กำลังสแกน...
            </>
          ) : (
            <>
              <ScanFace className="w-5 h-5 mr-2" />
              สแกน{label}
            </>
          )}
        </Button>

        <p className="text-xs text-center text-gray-400">
          ระบบจะจับภาพอัตโนมัติ {FRAME_COUNT} เฟรม พร้อมตรวจสอบความปลอดภัย
        </p>
      </CardContent>
    </Card>
  )
}
