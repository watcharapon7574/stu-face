'use client'

import { useRef, useEffect } from 'react'

interface FaceMeshOverlayProps {
  mesh: [number, number, number][]
  triangulation: number[]
  videoWidth: number
  videoHeight: number
  containerWidth: number
  containerHeight: number
}

export default function FaceMeshOverlay({
  mesh,
  triangulation,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
}: FaceMeshOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || mesh.length === 0) return

    canvas.width = containerWidth
    canvas.height = containerHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scaleX = containerWidth / videoWidth
    const scaleY = containerHeight / videoHeight

    ctx.clearRect(0, 0, containerWidth, containerHeight)

    // Draw tessellation mesh — single beginPath(), very fast
    if (triangulation.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'
      ctx.lineWidth = 0.5

      for (let i = 0; i < triangulation.length; i += 3) {
        const a = mesh[triangulation[i]]
        const b = mesh[triangulation[i + 1]]
        const c = mesh[triangulation[i + 2]]
        if (!a || !b || !c) continue

        const ax = a[0] * scaleX, ay = a[1] * scaleY
        const bx = b[0] * scaleX, by = b[1] * scaleY
        const cx = c[0] * scaleX, cy = c[1] * scaleY

        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.lineTo(cx, cy)
        ctx.lineTo(ax, ay)
      }

      ctx.stroke()
    }

    // HUD text
    ctx.font = '11px monospace'
    ctx.fillStyle = 'rgba(0, 255, 200, 0.7)'
    ctx.fillText(`MESH: ${mesh.length} pts`, 10, 20)
  }, [mesh, triangulation, videoWidth, videoHeight, containerWidth, containerHeight])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
    />
  )
}
