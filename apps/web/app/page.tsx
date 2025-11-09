import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">
          Turn clinician ideas into compliant research blueprints
        </h1>
        <p className="text-lg text-slate-600">
          Aurora interprets your study concept and drafts baseline protocols, sample size notes, and consent packages aligned
          with the India v1 regulatory profile.
        </p>
        <p className="text-slate-600">
          Start with a narrative idea, review the suggested design, and progress through sample size, documents, compliance,
          and launch planning — all guided by the Aurora Rulebook.
        </p>
      </div>
      <div>
        <Link
          href="/new-study"
          className="inline-flex items-center rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          Start a new study workspace
        </Link>
      </div>
    </section>
  );
}
