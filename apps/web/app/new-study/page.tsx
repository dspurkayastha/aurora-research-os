import { AURORA_RULEBOOK } from "@aurora/core";

const allowedDesigns = AURORA_RULEBOOK.studyDesigns;

const steps = [
  "Idea",
  "Design",
  "Sample Size",
  "Documents",
  "Review & Compliance",
  "Launch Workspace"
];

export default function NewStudyPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-slate-900">New study workspace</h1>
          <p className="text-slate-600">
            Share your clinical question or unmet need. Aurora will map it to the India v1 rulebook and draft a structured study
            blueprint without making regulatory claims.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-800">Workflow overview</h2>
          <ol className="mt-4 space-y-3 text-slate-600">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700" htmlFor="study-idea">
            Describe your study idea
          </label>
          <textarea
            id="study-idea"
            name="study-idea"
            placeholder="Example: Evaluate a 12-week lifestyle intervention to improve HbA1c control in adults with newly diagnosed type 2 diabetes at our urban clinic."
            className="min-h-[180px] w-full rounded-lg border border-slate-300 bg-white p-4 text-base text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <p className="text-xs text-slate-500">
            Aurora will keep the narrative intact while structuring downstream documents and compliance artifacts.
          </p>
        </div>
      </section>

      <aside className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Study story</h2>
          <p className="mt-2 text-sm text-slate-600">
            As you progress, this summary will track design choices, endpoints, and document status based on the India v1 rulebook.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Allowed study designs</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {allowedDesigns.map((design) => (
              <li key={design.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="font-medium">{design.label}</div>
                <div className="text-xs text-slate-500">Category: {design.category}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
          AI-generated drafts must be reviewed by the Principal Investigator and ethics committees. Aurora never issues regulatory approvals or IDs.
        </div>
      </aside>
    </div>
  );
}
