'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Loader2, X, CheckCircle2, SwitchCamera } from 'lucide-react'
import { detectFaces, initializeHuman } from '@/lib/face-detection'
import type { FaceEmbedding } from '@/types/database'

interface Props {
  title: string
  subtitle?: string
  frameCount: number
  onClose: () => void
  onComplete: (embeddings: FaceEmbedding[]) => Promise<void> | void
}

export default function FaceCaptureModal({
  title,
  subtitle,
  frameCount,
  onClose,
  onComplete,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [humanReady, setHumanReady] = useState(false)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')

  const startCamera = async (f: 'user' | 'environment') => {
    if (stream) stream.getTracks().forEach((t) => t.stop())
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: f, width: { ideal: 480 }, height: { ideal: 640 } },
      })
      setStream(ms)
      if (videoRef.current) videoRef.current.srcObject = ms
    } catch {
      setError('ไม่สามารถเปิดกล้องได้')
    }
  }

  useEffect(() => {
    let mounted = true
    initializeHuman().then(() => {
      if (mounted) setHumanReady(true)
    })
    startCamera(facing)
    return () => {
      mounted = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const toggle = async () => {
    const next = facing === 'user' ? 'environment' : 'user'
    setFacing(next)
    await startCamera(next)
  }

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current || busy) return
    setBusy(true)
    setError(null)
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const { embeddings: embs } = await detectFaces(canvas)
      if (embs.length === 0) {
        setError('ไม่พบใบหน้า ลองอีกครั้ง')
        setBusy(false)
        return
      }
      if (embs.length > 1) {
        setError('พบมากกว่า 1 ใบหน้า')
        setBusy(false)
        return
      }

      const next = [...embeddings, embs[0]]
      setEmbeddings(next)

      if (next.length >= frameCount) {
        stream?.getTracks().forEach((t) => t.stop())
        setSaving(true)
        try {
          await onComplete(next)
        } catch {
          setError('บันทึกไม่สำเร็จ')
          setSaving(false)
          setEmbeddings([])
          await startCamera(facing)
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  const progress = (embeddings.length / frameCount) * 100
  const angles = ['หน้าตรง', 'เอียงซ้าย', 'เอียงขวา', 'มุมบน', 'มุมล่าง']
  const currentAngle = angles[embeddings.length] || ''

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm tabular-nums text-gray-500">
              {embeddings.length}/{frameCount}
            </span>
          </div>

          {currentAngle && embeddings.length < frameCount && (
            <div className="text-center bg-cyan-50 border border-cyan-200 rounded-xl px-3 py-2">
              <div className="text-base font-bold text-cyan-700">{currentAngle}</div>
            </div>
          )}

          {/* Video */}
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
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/40 rounded-full w-44 h-44" />
            </div>
            <button
              onClick={toggle}
              className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            {(!humanReady || saving) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                  <span className="text-white text-sm">
                    {saving ? 'กำลังบันทึก...' : 'กำลังโหลด...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center bg-red-50 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          {/* Indicators */}
          <div className="flex gap-2 justify-center">
            {Array.from({ length: frameCount }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i < embeddings.length
                    ? 'bg-green-500 text-white'
                    : i === embeddings.length
                    ? 'bg-cyan-500 text-white ring-2 ring-cyan-300'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < embeddings.length ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
            ))}
          </div>

          <Button
            onClick={capture}
            disabled={busy || saving || !humanReady || embeddings.length >= frameCount}
            className="w-full"
            size="lg"
          >
            <Camera className="w-5 h-5 mr-2" />
            {busy ? 'กำลังถ่าย...' : `ถ่าย: ${currentAngle || 'เสร็จสิ้น'}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
