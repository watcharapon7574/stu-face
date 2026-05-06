'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, SwitchCamera } from 'lucide-react'
import { detectFaces, initializeHuman, findBestMatches, getFaceTriangulation } from '@/lib/face-detection'
import { CONFIDENCE_THRESHOLD } from '@/types/database'
import type { Student, AttendanceMethod } from '@/types/database'
import FaceMeshOverlay from './face-mesh-overlay'

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
  const [meshPoints, setMeshPoints] = useState<[number, number, number][]>([])
  const [videoDimensions, setVideoDimensions] = useState({ w: 480, h: 640 })
  const [triangulation, setTriangulation] = useState<number[]>([])
  const [isLiveTracking, setIsLiveTracking] = useState(true)
  const liveTrackingRef = useRef(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  // Track stream in a ref so cleanup actually stops the latest stream
  // (closure-based cleanup with deps=[] would always see the initial null).
  const streamRef = useRef<MediaStream | null>(null)

  // Initialize camera and Human library
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Request camera FIRST while the user-gesture context is fresh.
        // Older iOS Safari in standalone PWA mode silently drops the
        // camera request if too much async work runs before getUserMedia.
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 480 },
            height: { ideal: 640 },
          },
        })

        if (!mounted) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = mediaStream
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          // iOS standalone PWA sometimes ignores the autoPlay attribute
          // after a state-driven mount — call play() explicitly so the
          // video element actually drives the camera.
          try {
            await videoRef.current.play()
          } catch {
            // ignore autoplay rejection; user can tap to retry
          }
        }

        // Yield to the event loop so the camera can start producing frames
        // before we hog the main thread loading the Human/TF.js models.
        // Without this iOS may decide the video has stalled and tear down
        // the camera stream.
        await new Promise((r) => setTimeout(r, 0))

        await initializeHuman()
        if (mounted) {
          setHumanReady(true)
          setTriangulation(getFaceTriangulation())
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
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const switchCamera = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newFacing)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 480 }, height: { ideal: 640 } },
      })
      streamRef.current = mediaStream
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        try { await videoRef.current.play() } catch {}
      }
    } catch (err) {
      console.error('Switch camera error:', err)
    }
  }

  // Update video dimensions when metadata loads
  const handleVideoMetadata = () => {
    if (videoRef.current) {
      setVideoDimensions({
        w: videoRef.current.videoWidth,
        h: videoRef.current.videoHeight,
      })
    }
  }

  // Live face tracking loop
  const trackFace = useCallback(async () => {
    if (!liveTrackingRef.current || !videoRef.current || !humanReady) return

    try {
      const video = videoRef.current
      const { faces } = await detectFaces(video)

      if (faces.length > 0 && faces[0].mesh) {
        setMeshPoints(faces[0].mesh as [number, number, number][])
      } else {
        setMeshPoints([])
      }
    } catch {
      // ignore tracking errors
    }

    if (liveTrackingRef.current) {
      setTimeout(trackFace, 42) // ~24fps
    }
  }, [humanReady])

  // Start/stop live tracking
  useEffect(() => {
    liveTrackingRef.current = isLiveTracking
    if (isLiveTracking && humanReady) {
      trackFace()
    }
    if (!isLiveTracking) {
      setMeshPoints([])
    }
  }, [isLiveTracking, humanReady, trackFace])

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
      const { embeddings, faces } = await detectFaces(canvas)

      // Show mesh from scan result
      if (faces.length > 0 && faces[0].mesh) {
        setMeshPoints(faces[0].mesh as [number, number, number][])
      }

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
      <Card className="bg-gray-950 border-cyan-900/50">
        <CardContent className="p-4">
          {/* Video preview */}
          <div
            className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden mb-4 border border-cyan-900/30"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onLoadedMetadata={handleVideoMetadata}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Face mesh overlay */}
            {meshPoints.length > 0 && (
              <FaceMeshOverlay
                mesh={meshPoints}
                triangulation={triangulation}
                videoWidth={videoDimensions.w}
                videoHeight={videoDimensions.h}
              />
            )}

            {/* Switch camera button */}
            <button
              onClick={switchCamera}
              className="absolute top-3 left-3 z-10 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>

            {/* Corner brackets (HUD style) */}
            <div className="absolute inset-4 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/60" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/60" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/60" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/60" />
            </div>

            {/* Status indicator */}
            {isScanning && (
              <div className="absolute top-4 right-12 bg-cyan-500/90 text-white px-3 py-1 rounded-full text-sm font-mono animate-pulse">
                SCANNING...
              </div>
            )}

            {isLiveTracking && !isScanning && (
              <div className="absolute top-4 right-12 flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-mono border border-green-500/40">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                LIVE
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-950/50 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-4 font-mono text-sm">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              onClick={scanFace}
              disabled={isScanning || !humanReady}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
              size="lg"
            >
              <Camera className="w-5 h-5 mr-2" />
              {isScanning ? 'กำลังจดจำ...' : `สแกน${type === 'check_in' ? 'เข้า' : 'ออก'}`}
            </Button>

            <Button
              onClick={() => setIsLiveTracking(!isLiveTracking)}
              variant={isLiveTracking ? 'default' : 'outline'}
              className={isLiveTracking
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'border-cyan-700 text-cyan-400 hover:bg-cyan-950'
              }
              size="lg"
              disabled={!humanReady}
            >
              {isLiveTracking ? 'LIVE ON' : 'LIVE'}
            </Button>
          </div>

          {!humanReady && (
            <p className="text-sm text-center text-cyan-500/70 mt-2 font-mono">
              Loading face recognition engine...
            </p>
          )}

          {/* Manual select button */}
          <Button
            onClick={onManualSelect}
            variant="outline"
            className="w-full mt-2 border-gray-700 text-gray-400 hover:bg-gray-900"
          >
            เลือกนักเรียนเอง
          </Button>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card className="bg-gray-950 border-cyan-900/50">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 text-cyan-400 font-mono">เลือกนักเรียนที่ถูกต้อง</h3>
            <div className="space-y-2">
              {suggestions.map((match) => (
                <button
                  key={match.student.id}
                  onClick={() => selectSuggestion(match.student.id, match.confidence)}
                  className="w-full p-3 border border-cyan-900/40 rounded-lg hover:bg-cyan-950/50 text-left flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-medium text-white">{match.student.name}</div>
                    {match.student.nickname && (
                      <div className="text-sm text-gray-500">
                        ({match.student.nickname})
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-bold text-cyan-400">
                      {(match.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">confidence</div>
                  </div>
                </button>
              ))}
            </div>

            <Button
              onClick={onManualSelect}
              variant="outline"
              className="w-full mt-3 border-gray-700 text-gray-400 hover:bg-gray-900"
            >
              ไม่มีในรายการ - เลือกเอง
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
