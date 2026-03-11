'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, CheckCircle2 } from 'lucide-react'
import { detectFaces, initializeHuman } from '@/lib/face-detection'
import type { FaceEmbedding } from '@/types/database'

interface CameraCaptureProps {
  targetPhotos?: number
  onComplete: (embeddings: FaceEmbedding[]) => void
  studentName: string
}

export default function CameraCapture({
  targetPhotos = 5,
  onComplete,
  studentName,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<FaceEmbedding[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [humanReady, setHumanReady] = useState(false)

  // Initialize camera and Human library
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Initialize Human library
        await initializeHuman()
        if (mounted) setHumanReady(true)

        // Request camera access
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (mounted) {
          setStream(mediaStream)
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
          }
        }
      } catch (err) {
        if (mounted) {
          setError('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง')
          console.error('Camera error:', err)
        }
      }
    }

    init()

    return () => {
      mounted = false
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !humanReady) return

    setIsCapturing(true)
    setError(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current

      // Set canvas size to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Detect face and extract embedding
      const { embeddings, faces } = await detectFaces(canvas)

      if (embeddings.length === 0) {
        setError('ไม่พบใบหน้าในภาพ กรุณาลองอีกครั้ง')
        setIsCapturing(false)
        return
      }

      if (embeddings.length > 1) {
        setError('พบใบหน้ามากกว่า 1 คน กรุณาถ่ายรูปคนเดียว')
        setIsCapturing(false)
        return
      }

      // Add embedding to list
      const newEmbeddings = [...capturedEmbeddings, embeddings[0]]
      setCapturedEmbeddings(newEmbeddings)

      // Check if we have enough photos
      if (newEmbeddings.length >= targetPhotos) {
        onComplete(newEmbeddings)
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการถ่ายรูป กรุณาลองอีกครั้ง')
      console.error('Capture error:', err)
    } finally {
      setIsCapturing(false)
    }
  }

  const progress = (capturedEmbeddings.length / targetPhotos) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle>ลงทะเบียนใบหน้า: {studentName}</CardTitle>
        <CardDescription>
          ถ่ายรูปใบหน้า {targetPhotos} รูป ({capturedEmbeddings.length}/{targetPhotos})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Video preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay with face guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-4 border-white/50 rounded-full w-64 h-64" />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Captured photos indicator */}
        <div className="flex gap-2 justify-center">
          {Array.from({ length: targetPhotos }).map((_, i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                i < capturedEmbeddings.length
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {i < capturedEmbeddings.length ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
          ))}
        </div>

        {/* Capture button */}
        <Button
          onClick={capturePhoto}
          disabled={isCapturing || !humanReady || capturedEmbeddings.length >= targetPhotos}
          className="w-full"
          size="lg"
        >
          <Camera className="w-5 h-5 mr-2" />
          {isCapturing ? 'กำลังถ่ายรูป...' : `ถ่ายรูปที่ ${capturedEmbeddings.length + 1}`}
        </Button>

        {!humanReady && (
          <p className="text-sm text-center text-gray-500">
            กำลังโหลดระบบจดจำใบหน้า...
          </p>
        )}
      </CardContent>
    </Card>
  )
}
