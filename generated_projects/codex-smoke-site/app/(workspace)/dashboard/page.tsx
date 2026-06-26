export default function DashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <section className="rounded-2xl border border-white/10 p-6">
        <h2 className="text-2xl font-semibold">Execution Workspace</h2>
        <p className="mt-3 text-sm text-zinc-400">
          Track architecture decisions, build phases, and QA readiness in one view.
        </p>
      </section>
    </div>
  );
}
