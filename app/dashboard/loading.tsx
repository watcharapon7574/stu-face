// Streamed instantly while the server component runs its 6 Supabase
// queries; Next.js swaps in the real page once the data resolves.
export default function DashboardLoading() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        {/* Header: title + date picker */}
        <div>
          <div className="h-8 w-40 bg-gray-200 rounded-md" />
          <div className="flex items-center justify-between mt-2">
            <div className="h-4 w-56 bg-gray-100 rounded" />
            <div className="h-9 w-36 bg-gray-100 rounded-xl" />
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <div className="flex-1 h-9 bg-white rounded-lg shadow-sm" />
          <div className="flex-1 h-9 bg-transparent rounded-lg" />
        </div>

        {/* Service-point filter */}
        <div className="h-11 w-full bg-gray-100 rounded-xl" />

        {/* Stats grid (mirrors the teacher tab's 4-card row; the student
            tab has a similar-shaped header so it works for both) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-3 text-center space-y-2"
            >
              <div className="h-7 w-12 mx-auto bg-gray-200 rounded" />
              <div className="h-3 w-16 mx-auto bg-gray-100 rounded" />
            </div>
          ))}
        </div>

        {/* List rows */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="h-4 w-32 bg-gray-100 rounded" />
          </div>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 bg-gray-200 rounded" />
                  <div className="h-3 w-1/3 bg-gray-100 rounded" />
                </div>
                <div className="h-6 w-16 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
