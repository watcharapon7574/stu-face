// Map a teacher's free-text workplace to a service-point row OR classroom row.
// Used by both server (dashboard, teachers list) and client
// (attendance flow filtering, admin pages).

export interface ServicePointLike {
  id: string
  short_name: string
  name: string
  is_headquarters?: boolean
}

export interface ClassroomLike {
  id: string
  name: string
}

// Match the teacher's workplace string to a classroom by stripping the
// 'ห้อง'/'ห้องเรียน' prefix and looking for the noun substring.
// Examples:
//   workplace 'ห้องเรียนจิงโจ้'  + classroom 'ห้องจิงโจ้'  → match
//   workplace 'ห้องกระต่าย'      + classroom 'ห้องกระต่าย' → match
//   workplace 'หน่วยบริการXX'    + classroom 'ห้องสิงโต'   → no match
export function matchWorkplaceToClassroom<T extends ClassroomLike>(
  workplace: string | null | undefined,
  classrooms: T[]
): T | null {
  if (!workplace) return null
  const wp = workplace.trim()
  if (!wp) return null

  for (const c of classrooms) {
    const noun = c.name.replace(/^ห้อง(เรียน)?/, '').trim()
    if (!noun) continue
    if (wp.includes(noun)) return c
  }
  return null
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
