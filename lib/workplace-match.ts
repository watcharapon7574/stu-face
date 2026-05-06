// Map a teacher's free-text workplace to a service-point row.
// Used by both server (dashboard, teachers list) and client
// (attendance flow filtering, admin pages).

export interface ServicePointLike {
  id: string
  short_name: string
  name: string
  is_headquarters?: boolean
}

const HQ_KEYWORDS = ['ห้อง', 'ห้องเรียน', 'Admin', 'ศูนย์การศึกษา']

export function matchWorkplaceToServicePoint<T extends ServicePointLike>(
  workplace: string | null | undefined,
  servicePoints: T[]
): T | null {
  if (!workplace) return null

  const isHQ = HQ_KEYWORDS.some((kw) => workplace.includes(kw))
  if (isHQ) {
    const hq = servicePoints.find((sp) => sp.is_headquarters)
    if (hq) return hq
  }

  for (const sp of servicePoints) {
    const parts = [
      sp.short_name,
      sp.name,
      sp.name.replace(/หน่วยบริการอำเภอ|หน่วยบริการ|หน่วยฯ\s*/g, '').trim(),
    ]
    for (const part of parts) {
      if (!part) continue
      if (
        workplace.includes(part) ||
        part.includes(workplace.replace(/หน่วยบริการ/g, '').trim())
      ) {
        return sp
      }
    }
  }

  return null
}
