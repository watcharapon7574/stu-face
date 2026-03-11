import * as human from '@vladmandic/human'
import type { FaceEmbedding } from '@/types/database'

// Human configuration optimized for face recognition on mobile
const humanConfig: Partial<human.Config> = {
  backend: 'webgl',
  modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
  face: {
    enabled: true,
    detector: {
      enabled: true,
      rotation: true,
      return: true,
      maxDetected: 5,
    },
    mesh: {
      enabled: true,
    },
    iris: {
      enabled: false, // ไม่จำเป็นสำหรับการจดจำ
    },
    description: {
      enabled: true, // สร้าง face embeddings
    },
    emotion: {
      enabled: false,
    },
    antispoof: {
      enabled: false, // ไม่ต้องการ liveness detection
    },
    liveness: {
      enabled: false,
    },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
}

let humanInstance: human.Human | null = null

/**
 * Initialize Human library (singleton)
 */
export async function initializeHuman(): Promise<human.Human> {
  if (!humanInstance) {
    humanInstance = new human.Human(humanConfig)
    await humanInstance.load()
    await humanInstance.warmup()
  }
  return humanInstance
}

/**
 * Detect faces and extract embeddings from an image
 * @param imageElement - HTML Image or Video element
 * @returns Array of face embeddings
 */
export async function detectFaces(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<{
  embeddings: FaceEmbedding[]
  faces: human.FaceResult[]
}> {
  const h = await initializeHuman()
  const result = await h.detect(imageElement)

  if (!result.face || result.face.length === 0) {
    return { embeddings: [], faces: [] }
  }

  // Extract embeddings from detected faces
  const embeddings = result.face
    .filter((face) => face.embedding && face.embedding.length > 0)
    .map((face) => face.embedding as FaceEmbedding)

  return { embeddings, faces: result.face }
}

/**
 * Calculate similarity between two face embeddings using cosine similarity
 * @param embedding1 - First face embedding
 * @param embedding2 - Second face embedding
 * @returns Similarity score (0-1, higher is more similar)
 */
export function calculateSimilarity(
  embedding1: FaceEmbedding,
  embedding2: FaceEmbedding
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length')
  }

  // Cosine similarity
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i]
    norm1 += embedding1[i] * embedding1[i]
    norm2 += embedding2[i] * embedding2[i]
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))

  // Normalize to 0-1 range (cosine similarity is -1 to 1)
  return (similarity + 1) / 2
}

/**
 * Compare a face embedding against a list of stored embeddings
 * @param faceEmbedding - The face embedding to compare
 * @param storedEmbeddings - Array of stored embeddings to compare against
 * @returns Highest similarity score
 */
export function compareEmbeddings(
  faceEmbedding: FaceEmbedding,
  storedEmbeddings: FaceEmbedding[]
): number {
  if (storedEmbeddings.length === 0) {
    return 0
  }

  const similarities = storedEmbeddings.map((stored) =>
    calculateSimilarity(faceEmbedding, stored)
  )

  return Math.max(...similarities)
}

/**
 * Find best matches from a list of students
 * @param faceEmbedding - The detected face embedding
 * @param students - Array of students with their embeddings
 * @param topN - Number of top matches to return
 * @returns Array of student matches with confidence scores
 */
export function findBestMatches<T extends { id: string; embeddings: FaceEmbedding[] }>(
  faceEmbedding: FaceEmbedding,
  students: T[],
  topN: number = 3
): Array<{ student: T; confidence: number }> {
  const matches = students
    .map((student) => ({
      student,
      confidence: compareEmbeddings(faceEmbedding, student.embeddings),
    }))
    .filter((match) => match.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topN)

  return matches
}

/**
 * Capture image from video stream
 * @param video - Video element
 * @returns Canvas with captured frame
 */
export function captureFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Convert canvas to blob
 * @param canvas - Canvas element
 * @param type - Image type (default: image/jpeg)
 * @param quality - Image quality (0-1, default: 0.9)
 * @returns Promise<Blob>
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to blob'))
        }
      },
      type,
      quality
    )
  })
}
