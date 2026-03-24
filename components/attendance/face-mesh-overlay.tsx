'use client'

import { useRef, useEffect } from 'react'

interface FaceMeshOverlayProps {
  mesh: [number, number, number][]
  triangulation: number[]
  videoWidth: number
  videoHeight: number
}

export default function FaceMeshOverlay({
  mesh,
  triangulation,
  videoWidth,
  videoHeight,
}: FaceMeshOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || mesh.length === 0 || !videoWidth || !videoHeight) return

    // Canvas matches video pixel dimensions exactly
    canvas.width = videoWidth
    canvas.height = videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, videoWidth, videoHeight)

    // Draw tessellation mesh — single beginPath, very fast
    if (triangulation.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)'
      ctx.lineWidth = 0.5

      for (let i = 0; i < triangulation.length; i += 3) {
        const a = mesh[triangulation[i]]
        const b = mesh[triangulation[i + 1]]
        const c = mesh[triangulation[i + 2]]
        if (!a || !b || !c) continue

        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.lineTo(c[0], c[1])
        ctx.lineTo(a[0], a[1])
      }

      ctx.stroke()
    }
  }, [mesh, triangulation, videoWidth, videoHeight])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
    />
  )
}
