const STORAGE_KEY = 'stu-face-teacher-checkin'

interface CheckinStatus {
  teacher_id: string
  date: string // YYYY-MM-DD
  checked_in: boolean
  check_in_time?: string
  checked_out?: boolean
  check_out_time?: string
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export function getCheckinStatus(teacherId: string): CheckinStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const status: CheckinStatus = JSON.parse(raw)
    // Only valid if same teacher and same day
    if (status.teacher_id === teacherId && status.date === getToday()) {
      return status
    }
    return null
  } catch {
    return null
  }
}

export function saveCheckinStatus(status: CheckinStatus): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(status))
}

export function isTeacherCheckedInToday(teacherId: string): boolean {
  const status = getCheckinStatus(teacherId)
  return status?.checked_in === true
}
