'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, CheckCircle2, XCircle } from 'lucide-react'
import { detectFaces, initializeHuman, findBestMatches } from '@/lib/face-detection'
import { CONFIDENCE_THRESHOLD } from '@/types/database'
import type { Student, AttendanceMethod } from '@/types/database'

interface FaceRecognitionProps {
  students: Student[]
  type: 'check_in' | 'check_out'
  onRecognized: (studentId: string, confidence: number, method: AttendanceMethod) => void
  onManualSelect: () => void
}

export default function FaceRecognition({
  students,
  type,
  onRecognized,
  onManualSelect,
}: FaceRecognitionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [humanReady, setHumanReady] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{
    student: Student
    confidence: number
  }> | null>(null)

  // Initialize camera and Human library
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        await initializeHuman()
        if (mounted) setHumanReady(true)

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
          setError('ไม่สามารถเข้าถึงกล้องได้')
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

  const scanFace = async () => {
    if (!videoRef.current || !canvasRef.current || !humanReady) return

    setIsScanning(true)
    setError(null)
    setSuggestions(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Detect face
      const { embeddings } = await detectFaces(canvas)

      if (embeddings.length === 0) {
        setError('ไม่พบใบหน้า กรุณาลองอีกครั้ง')
        setIsScanning(false)
        return
      }

      if (embeddings.length > 1) {
        setError('พบใบหน้ามากกว่า 1 คน กรุณาให้นักเรียนคนเดียวอยู่ในกรอบ')
        setIsScanning(false)
        return
      }

      // Find matches
      const matches = findBestMatches(embeddings[0], students, 3)

      if (matches.length === 0) {
        setError('ไม่พบข้อมูลนักเรียนในระบบ')
        setIsScanning(false)
        return
      }

      const topMatch = matches[0]

      // Automatic recognition (confidence > 0.85)
      if (topMatch.confidence >= CONFIDENCE_THRESHOLD.AUTO) {
        onRecognized(topMatch.student.id, topMatch.confidence, 'auto')
        setIsScanning(false)
        return
      }

      // Show suggestions (0.6 - 0.85)
      if (topMatch.confidence >= CONFIDENCE_THRESHOLD.SUGGESTION) {
        setSuggestions(matches)
        setIsScanning(false)
        return
      }

      // Low confidence - ask for manual selection
      setError('ไม่มั่นใจในการจดจำ กรุณาเลือกนักเรียนเอง')
      setIsScanning(false)
      setTimeout(() => {
        onManualSelect()
      }, 1500)
    } catch (err) {
      setError('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
      console.error('Scan error:', err)
      setIsScanning(false)
    }
  }

  const selectSuggestion = (studentId: string, confidence: number) => {
    onRecognized(studentId, confidence, 'suggestion')
    setSuggestions(null)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          {/* Video preview */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-white/50 rounded-full w-48 h-48 md:w-64 md:h-64" />
            </div>

            {/* Status indicator */}
            {isScanning && (
              <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                กำลังสแกน...
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Scan button */}
          <Button
            onClick={scanFace}
            disabled={isScanning || !humanReady}
            className="w-full"
            size="lg"
          >
            <Camera className="w-5 h-5 mr-2" />
            {isScanning ? 'กำลังจดจำใบหน้า...' : `สแกนใบหน้า${type === 'check_in' ? 'เข้า' : 'ออก'}`}
          </Button>

          {!humanReady && (
            <p className="text-sm text-center text-gray-500 mt-2">
              กำลังโหลดระบบจดจำใบหน้า...
            </p>
          )}

          {/* Manual select button */}
          <Button
            onClick={onManualSelect}
            variant="outline"
            className="w-full mt-2"
          >
            เลือกนักเรียนเอง
          </Button>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">เลือกนักเรียนที่ถูกต้อง</h3>
            <div className="space-y-2">
              {suggestions.map((match) => (
                <button
                  key={match.student.id}
                  onClick={() => selectSuggestion(match.student.id, match.confidence)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{match.student.name}</div>
                    {match.student.nickname && (
                      <div className="text-sm text-gray-500">
                        ({match.student.nickname})
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {(match.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">ความมั่นใจ</div>
                  </div>
                </button>
              ))}
            </div>

            <Button
              onClick={onManualSelect}
              variant="outline"
              className="w-full mt-3"
            >
              ไม่มีในรายการ - เลือกเอง
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
