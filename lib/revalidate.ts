import { revalidatePath, revalidateTag } from 'next/cache'

// Tags used by the cached data fetchers in lib/cache.ts.
// Naming them centrally so route handlers and mutators agree.
export const CACHE_TAGS = {
  students: 'students',
  studentEmbeddings: 'students-embeddings',
} as const

// Pages that render the student roster server-side. These must be busted
// via the Next.js Router Cache so client navigation doesn't show a stale
// list. Page-level revalidation is separate from the data-cache tags above.
const STUDENT_READER_PATHS = ['/', '/attendance', '/dashboard'] as const

export function revalidateStudentReaders() {
  // Data-cache layer: any cached Supabase query tagged with these will be
  // invalidated. revalidateTag also purges the Vercel CDN/Edge Cache for
  // any Route Handler response that participates in this tag's data cache.
  revalidateTag(CACHE_TAGS.students)
  revalidateTag(CACHE_TAGS.studentEmbeddings)
  // Page-level revalidation for Server Components that read students.
  for (const path of STUDENT_READER_PATHS) {
    revalidatePath(path)
  }
}

// Dashboard is on revalidate=1800; this on-demand invalidator runs after
// every attendance write so the kiosk view stays fresh without time-based
// ISR regenerations.
const DASHBOARD_READER_PATHS = ['/dashboard'] as const

export function revalidateDashboardReaders() {
  for (const path of DASHBOARD_READER_PATHS) {
    revalidatePath(path)
  }
}
