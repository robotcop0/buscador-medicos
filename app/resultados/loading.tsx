export default function Loading() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="w-full max-w-2xl mx-auto">

        {/* Nav skeleton */}
        <div className="flex items-center justify-between mb-10">
          <div className="text-xs text-gray-400">← Nueva búsqueda</div>
          <span className="text-xs tracking-widest text-gray-300 uppercase">Buscador de Médicos</span>
        </div>

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">Buscando</span>
            <span className="inline-flex gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:120ms]" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:240ms]" />
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Consultando directorios médicos en tiempo real
          </p>
        </header>

        {/* Skeleton cards */}
        <div className="bg-white rounded-2xl border border-gray-200 px-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="py-5 border-b border-gray-200 last:border-b-0 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex justify-between gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-3">
                    <div className="h-3.5 bg-gray-100 rounded-full w-36" />
                    <div className="h-3.5 bg-gray-100 rounded-full w-20" />
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full w-48" />
                  <div className="flex gap-1 mt-1">
                    <div className="h-5 bg-gray-100 rounded-full w-14" />
                    <div className="h-5 bg-gray-100 rounded-full w-16" />
                  </div>
                </div>
                <div className="flex-shrink-0 space-y-1.5 flex flex-col items-end">
                  <div className="h-4 bg-gray-100 rounded-full w-10" />
                  <div className="h-3 bg-gray-100 rounded-full w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
