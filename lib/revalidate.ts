import { revalidatePath } from 'next/cache'

// Pages that render the student list. Any mutation to std_students must
// invalidate these so client navigation doesn't show stale rosters from the
// Next.js Router Cache.
const STUDENT_READER_PATHS = ['/', '/attendance'] as const

export function revalidateStudentReaders() {
  for (const path of STUDENT_READER_PATHS) {
    revalidatePath(path)
  }
}
