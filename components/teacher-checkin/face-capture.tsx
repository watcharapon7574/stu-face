'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScanFace, Loader2, SwitchCamera, AlertTriangle, Shield } from 'lucide-react'
import { detectFaces, initializeHuman, getFaceTriangulation } from '@/lib/face-detection'

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

type ScanPhase = 'ready' | 'capturing' | 'uploading' | 'processing'

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
  const meshCanvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [phase, setPhase] = useState<ScanPhase>('ready')
  const [scanProgress, setScanProgress] = useState(0)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [error, setError] = useState<string | null>(null)

  // Face mesh state
  const [humanReady, setHumanReady] = useState(false)
  const [meshPoints, setMeshPoints] = useState<[number, number, number][]>([])
  const [triangulation, setTriangulation] = useState<number[]>([])
  const liveTrackingRef = useRef(true)

  // Initialize Human + camera
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        await initializeHuman()
        if (mounted) {
          setHumanReady(true)
          setTriangulation(getFaceTriangulation())
        }
      } catch {
        // Human init failed
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 480 },
            height: { ideal: 640 },
          },
        })
        if (mounted) {
          setStream(mediaStream)
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
          }
        }
      } catch {
        if (mounted) setError('ไม่สามารถเข้าถึงกล้องได้')
      }
    }

    init()
    return () => {
      mounted = false
      liveTrackingRef.current = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Draw mesh on canvas
  const drawMesh = useCallback((mesh: [number, number, number][], tri: number[]) => {
    const canvas = meshCanvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (tri.length > 0 && mesh.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'
      ctx.lineWidth = 0.5

      for (let i = 0; i < tri.length; i += 3) {
        const a = mesh[tri[i]]
        const b = mesh[tri[i + 1]]
        const c = mesh[tri[i + 2]]
        if (!a || !b || !c) continue
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.lineTo(c[0], c[1])
        ctx.lineTo(a[0], a[1])
      }
      ctx.stroke()

      const keyPoints = [
        33, 133, 160, 158, 153, 144,
        362, 263, 385, 387, 373, 380,
        1, 4, 5, 195,
        61, 291, 13, 14, 78, 308,
        10, 152, 234, 454, 127, 356,
      ]

      ctx.fillStyle = 'rgba(0, 255, 200, 0.6)'
      for (const idx of keyPoints) {
        const pt = mesh[idx]
        if (!pt) continue
        ctx.beginPath()
        ctx.arc(pt[0], pt[1], 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  // Live face tracking loop
  const trackFace = useCallback(async () => {
    if (!liveTrackingRef.current || !videoRef.current || !humanReady) return

    try {
      const { faces } = await detectFaces(videoRef.current)
      if (faces.length > 0 && faces[0].mesh) {
        const mesh = faces[0].mesh as [number, number, number][]
        setMeshPoints(mesh)
        drawMesh(mesh, triangulation)
      } else {
        setMeshPoints([])
        const canvas = meshCanvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          ctx?.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
    } catch {
      // ignore
    }

    if (liveTrackingRef.current) {
      setTimeout(trackFace, 42) // ~24fps
    }
  }, [humanReady, triangulation, drawMesh])

  useEffect(() => {
    if (humanReady && phase === 'ready') {
      liveTrackingRef.current = true
      trackFace()
    }
    return () => {
      liveTrackingRef.current = false
    }
  }, [humanReady, trackFace, phase])

  const toggleCamera = async () => {
    if (stream) stream.getTracks().forEach((t) => t.stop())
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newFacing)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 480 }, height: { ideal: 640 } },
      })
      setStream(mediaStream)
      if (videoRef.current) videoRef.current.srcObject = mediaStream
    } catch {
      setError('ไม่สามารถสลับกล้องได้')
    }
  }

  const handleScan = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setPhase('capturing')
    liveTrackingRef.current = false
    setError(null)
    setScanProgress(20)

    try {
      // Capture frame to canvas
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      setScanProgress(50)
      setPhase('processing')

      // Extract embedding client-side
      const { embeddings } = await detectFaces(canvas)
      if (embeddings.length === 0) {
        setError('ไม่พบใบหน้า ลองอีกครั้ง')
        setPhase('ready')
        liveTrackingRef.current = true
        trackFace()
        return
      }

      setScanProgress(70)
      setPhase('uploading')

      // Send embedding to server for matching + attendance save
      const res = await fetch('/api/teacher-checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          embedding: embeddings[0],
          device_fingerprint: deviceFingerprint,
          service_point_id: servicePointId || null,
          check_type: checkType,
          date,
        }),
      })

      setScanProgress(100)
      const data: VerifyResult = await res.json()

      if (!res.ok) {
        onError(data.message || 'เกิดข้อผิดพลาด')
        setPhase('ready')
        liveTrackingRef.current = true
        trackFace()
        return
      }

      if (data.matched && data.attendance_saved) {
        stream?.getTracks().forEach((t) => t.stop())
        onSuccess(data)
      } else {
        setError(data.message)
        setPhase('ready')
        liveTrackingRef.current = true
        trackFace()
      }
    } catch {
      setError('ไม่สามารถส่งข้อมูลได้')
      setPhase('ready')
      liveTrackingRef.current = true
      trackFace()
    }
  }

  const isScanning = phase !== 'ready'
  const label = checkType === 'check_in' ? 'เข้างาน' : 'ออกงาน'

  const phaseLabel = {
    ready: '',
    capturing: 'จับภาพใบหน้า...',
    uploading: 'กำลังบันทึก...',
    processing: 'ตรวจสอบใบหน้า...',
  }

  const phaseColor = {
    ready: 'border-cyan-400',
    capturing: 'border-yellow-400',
    uploading: 'border-blue-400',
    processing: 'border-purple-400',
  }

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ScanFace className="w-5 h-5 text-cyan-500" />
          สแกนหน้า{label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

          {meshPoints.length > 0 && phase === 'ready' && (
            <canvas
              ref={meshCanvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}

          {isScanning && (
            <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center">
              <div className={`border-4 rounded-full w-52 h-52 ${phaseColor[phase]} ${
                phase === 'capturing' ? 'animate-pulse' : 'animate-spin'
              }`} style={{
                borderStyle: phase === 'processing' ? 'dashed' : 'solid',
                animationDuration: phase === 'processing' ? '2s' : '1.5s',
              }} />

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                <div className="flex items-center gap-3 mb-3">
                  {phase === 'capturing' ? (
                    <Shield className="w-5 h-5 text-yellow-400" />
                  ) : phase === 'uploading' ? (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  ) : (
                    <ScanFace className="w-5 h-5 text-purple-400 animate-pulse" />
                  )}
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">
                      {phaseLabel[phase]}
                    </div>
                    <div className="text-white/60 text-xs mt-0.5">
                      {phase === 'capturing'
                        ? 'ถือนิ่งไว้สักครู่...'
                        : phase === 'uploading'
                        ? 'อย่าปิดหน้าจอ'
                        : 'กำลังเปรียบเทียบใบหน้า'}
                    </div>
                  </div>
                </div>

                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      phase === 'capturing'
                        ? 'bg-yellow-400'
                        : phase === 'uploading'
                        ? 'bg-blue-400'
                        : 'bg-purple-400'
                    }`}
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {phase === 'ready' && meshPoints.length > 0 && (
            <div className="absolute top-3 left-3 bg-green-500/80 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-medium">พบใบหน้า</span>
            </div>
          )}

          {phase === 'ready' && humanReady && meshPoints.length === 0 && (
            <div className="absolute top-3 left-3 bg-red-500/80 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-white text-xs font-medium">ไม่พบใบหน้า</span>
            </div>
          )}

          {phase === 'ready' && (
            <button
              onClick={toggleCamera}
              className="absolute top-3 right-3 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {!humanReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                <span className="text-white text-sm">กำลังโหลดระบบ...</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleScan}
          disabled={isScanning || !humanReady || meshPoints.length === 0}
          className="w-full"
          size="lg"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {phaseLabel[phase]}
            </>
          ) : (
            <>
              <ScanFace className="w-5 h-5 mr-2" />
              สแกน{label}
            </>
          )}
        </Button>

        {!isScanning && (
          <p className="text-xs text-center text-gray-400">
            ระบบจะตรวจใบหน้าและบันทึกการลงเวลาอัตโนมัติ
          </p>
        )}
      </CardContent>
    </Card>
  )
}
