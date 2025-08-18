export default function SafeLanding() {
  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Hortitrack — Safe Mode</h1>
      <p className="mt-2">
        The app is running in <strong>Safe Build</strong> while we restore truncated files.
      </p>
      <ul className="list-disc pl-6 mt-4 space-y-2">
        <li>Admin SDK initialized on the server.</li>
        <li>Batch number allocator is available.</li>
        <li>Minimal batches API: <code>GET/POST /api/batches</code>.</li>
      </ul>
      <p className="mt-6 text-sm opacity-70">
        Switch off safe mode by unsetting <code>NEXT_PUBLIC_SAFE_BUILD=1</code> when type checks are green.
      </p>
    </main>
  );
}
