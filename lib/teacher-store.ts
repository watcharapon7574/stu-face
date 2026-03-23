const STORAGE_KEY = 'stu-face-teacher'

export interface SavedTeacher {
  id: string
  name: string
  nickname: string | null
  avatar_url?: string | null
}

export function getSavedTeacher(): SavedTeacher | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTeacher(teacher: SavedTeacher): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teacher))
}

export function clearTeacher(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
