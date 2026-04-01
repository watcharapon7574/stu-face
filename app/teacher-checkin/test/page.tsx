'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  Database,
  ScanFace,
  Shield,
  Fingerprint,
  Camera,
} from 'lucide-react'
import { getDeviceFingerprint } from '@/lib/device-fingerprint'

type TestStatus = 'idle' | 'loading' | 'pass' | 'fail'

interface TestResult {
  status: TestStatus
  message: string
  detail?: string
}

export default function TestPage() {
  const [tests, setTests] = useState<Record<string, TestResult>>({
    api: { status: 'idle', message: 'Python API เชื่อมต่อได้' },
    db: { status: 'idle', message: 'Supabase DB เชื่อมต่อได้' },
    fingerprint: { status: 'idle', message: 'Device Fingerprint' },
    camera: { status: 'idle', message: 'กล้องทำงานได้' },
    enroll: { status: 'idle', message: 'Enrollment API' },
    antispoof: { status: 'idle', message: 'Anti-Spoofing' },
  })
  const [running, setRunning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)

  const updateTest = (key: string, result: Partial<TestResult>) => {
    setTests((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...result },
    }))
  }

  // Test 1: Python API health check (via proxy)
  const testApi = async () => {
    updateTest('api', { status: 'loading' })
    try {
      const res = await fetch('/api/teacher-checkin/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: 'test', images: [] }),
      })
      // 400 = API reachable but bad request (expected)
      // 502 = proxy can't reach API
      if (res.status === 502) {
        const data = await res.json()
        updateTest('api', {
          status: 'fail',
          message: 'Python API เชื่อมต่อไม่ได้',
          detail: data.message,
        })
      } else {
        updateTest('api', {
          status: 'pass',
          message: 'Python API เชื่อมต่อได้',
          detail: `Status: ${res.status}`,
        })
      }
    } catch (e) {
      updateTest('api', {
        status: 'fail',
        message: 'Python API เชื่อมต่อไม่ได้',
        detail: String(e),
      })
    }
  }

  // Test 2: Supabase DB
  const testDb = async () => {
    updateTest('db', { status: 'loading' })
    try {
      const res = await fetch('/api/teacher-checkin/status?teacher_id=test&date=2024-01-01')
      const data = await res.json()
      if (res.ok) {
        updateTest('db', {
          status: 'pass',
          message: 'Supabase DB เชื่อมต่อได้',
          detail: `enrolled: ${data.enrolled}, checked_in: ${data.checked_in}`,
        })
      } else {
        updateTest('db', {
          status: 'fail',
          message: 'Supabase DB มีปัญหา',
          detail: data.error,
        })
      }
    } catch (e) {
      updateTest('db', { status: 'fail', message: 'DB เชื่อมต่อไม่ได้', detail: String(e) })
    }
  }

  // Test 3: Device Fingerprint
  const testFingerprint = async () => {
    updateTest('fingerprint', { status: 'loading' })
    try {
      const fp = await getDeviceFingerprint()
      if (fp && fp.length === 64) {
        updateTest('fingerprint', {
          status: 'pass',
          message: 'Device Fingerprint',
          detail: `${fp.slice(0, 16)}...${fp.slice(-8)}`,
        })
      } else {
        updateTest('fingerprint', {
          status: 'fail',
          message: 'Fingerprint ผิดรูปแบบ',
          detail: `Length: ${fp?.length}`,
        })
      }
    } catch (e) {
      updateTest('fingerprint', { status: 'fail', message: 'สร้าง Fingerprint ไม่ได้', detail: String(e) })
    }
  }

  // Test 4: Camera
  const testCamera = async () => {
    updateTest('camera', { status: 'loading' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      updateTest('camera', {
        status: 'pass',
        message: 'กล้องทำงานได้',
        detail: `${stream.getVideoTracks()[0].getSettings().width}x${stream.getVideoTracks()[0].getSettings().height}`,
      })
    } catch (e) {
      updateTest('camera', { status: 'fail', message: 'เข้าถึงกล้องไม่ได้', detail: String(e) })
    }
  }

  // Capture frame from video
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  // Test 5: Enrollment API (dry run — ส่งรูปจริง 1 รูป)
  const testEnroll = async () => {
    updateTest('enroll', { status: 'loading' })
    const frame = captureFrame()
    if (!frame) {
      updateTest('enroll', { status: 'fail', message: 'ยังไม่ได้เปิดกล้อง', detail: 'กดทดสอบกล้องก่อน' })
      return
    }
    setCapturedFrame(frame)
    try {
      const res = await fetch('/api/teacher-checkin/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: '00000000-0000-0000-0000-000000000000',
          images: [frame, frame, frame],
        }),
      })
      const data = await res.json()
      updateTest('enroll', {
        status: res.status === 502 ? 'fail' : 'pass',
        message: res.status === 502 ? 'API เชื่อมต่อไม่ได้' : 'Enrollment API ตอบกลับแล้ว',
        detail: data.message || JSON.stringify(data).slice(0, 100),
      })
    } catch (e) {
      updateTest('enroll', { status: 'fail', message: 'Enrollment ผิดพลาด', detail: String(e) })
    }
  }

  // Test 6: Anti-Spoofing (ส่ง 3 เฟรมจริง)
  const testAntispoof = async () => {
    updateTest('antispoof', { status: 'loading' })
    const frames: string[] = []
    for (let i = 0; i < 3; i++) {
      const f = captureFrame()
      if (f) frames.push(f)
      await new Promise((r) => setTimeout(r, 300))
    }
    if (frames.length < 3) {
      updateTest('antispoof', { status: 'fail', message: 'จับภาพไม่ได้', detail: 'กดทดสอบกล้องก่อน' })
      return
    }
    try {
      const res = await fetch('/api/teacher-checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: '00000000-0000-0000-0000-000000000000',
          frames,
          check_type: 'check_in',
          date: '2024-01-01',
        }),
      })
      const data = await res.json()
      updateTest('antispoof', {
        status: res.status === 502 ? 'fail' : 'pass',
        message: res.status === 502 ? 'API เชื่อมต่อไม่ได้' : `Anti-Spoofing: ${data.is_real ? 'ใบหน้าจริง' : 'ตรวจพบรูป/วิดีโอ'}`,
        detail: data.message || `confidence: ${data.confidence}, spoof_scores: ${JSON.stringify(data.spoofing_scores)}`,
      })
    } catch (e) {
      updateTest('antispoof', { status: 'fail', message: 'Anti-Spoofing ผิดพลาด', detail: String(e) })
    }
  }

  const runAll = async () => {
    setRunning(true)
    await testApi()
    await testDb()
    await testFingerprint()
    await testCamera()
    // Wait a moment for camera to initialize
    await new Promise((r) => setTimeout(r, 1000))
    await testEnroll()
    await testAntispoof()
    setRunning(false)
  }

  const statusIcon = (s: TestStatus) => {
    switch (s) {
      case 'loading':
        return <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
    }
  }

  const testIcons: Record<string, React.ReactNode> = {
    api: <Wifi className="w-4 h-4" />,
    db: <Database className="w-4 h-4" />,
    fingerprint: <Fingerprint className="w-4 h-4" />,
    camera: <Camera className="w-4 h-4" />,
    enroll: <ScanFace className="w-4 h-4" />,
    antispoof: <Shield className="w-4 h-4" />,
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-center gap-3">
          <img src="/std2.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div className="text-left">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">ทดสอบระบบ</h1>
            <p className="text-xs text-gray-400">Teacher Face Check-in System</p>
          </div>
        </div>

        {/* Test results */}
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ผลการทดสอบ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(tests).map(([key, test]) => (
              <div
                key={key}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  test.status === 'pass'
                    ? 'bg-green-50 border-green-200'
                    : test.status === 'fail'
                    ? 'bg-red-50 border-red-200'
                    : test.status === 'loading'
                    ? 'bg-cyan-50 border-cyan-200'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                {statusIcon(test.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{testIcons[key]}</span>
                    <span className="text-sm font-medium text-gray-900">{test.message}</span>
                  </div>
                  {test.detail && (
                    <p className="text-xs text-gray-500 mt-1 break-all">{test.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Camera preview */}
        <Card className="border-gray-200">
          <CardContent className="pt-4">
            <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-white/30 rounded-full w-48 h-48" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Captured frame preview */}
        {capturedFrame && (
          <Card className="border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">เฟรมที่ส่งทดสอบ</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={capturedFrame}
                alt="Captured"
                className="w-full rounded-xl"
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={runAll} disabled={running} className="flex-1" size="lg">
            {running ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                กำลังทดสอบ...
              </>
            ) : (
              'ทดสอบทั้งหมด'
            )}
          </Button>
        </div>

        {/* Individual test buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={testApi} disabled={running}>
            API
          </Button>
          <Button variant="outline" size="sm" onClick={testDb} disabled={running}>
            DB
          </Button>
          <Button variant="outline" size="sm" onClick={testFingerprint} disabled={running}>
            FP
          </Button>
          <Button variant="outline" size="sm" onClick={testCamera} disabled={running}>
            Camera
          </Button>
          <Button variant="outline" size="sm" onClick={testEnroll} disabled={running}>
            Enroll
          </Button>
          <Button variant="outline" size="sm" onClick={testAntispoof} disabled={running}>
            Spoof
          </Button>
        </div>

        <div className="text-center pb-4">
          <a href="/teacher-checkin" className="text-sm text-gray-400 hover:text-cyan-600 transition-colors">
            ไปหน้าสแกนเข้างานจริง
          </a>
        </div>
      </div>
    </main>
  )
}
