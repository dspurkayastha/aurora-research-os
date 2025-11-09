"use client";

import { useMemo, useState } from "react";

import {
  AURORA_RULEBOOK,
  buildBaselineSpec,
  chooseDesign,
  parseIdeaToPreSpec
} from "@aurora/core";

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
  const [idea, setIdea] = useState("");
  const [storyRequested, setStoryRequested] = useState(false);

  const story = useMemo(() => {
    if (!storyRequested || !idea.trim()) {
      return null;
    }

    const preSpec = parseIdeaToPreSpec(idea);
    const designId = chooseDesign(preSpec);
    const studySpec = buildBaselineSpec(preSpec, designId);

    return {
      preSpec,
      designId,
      studySpec,
      designKnown: Boolean(designId)
    };
  }, [idea, storyRequested]);

  const handleGenerate = () => {
    setStoryRequested(true);
    if (!idea.trim()) {
      return;
    }
  };

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
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Example: Evaluate a 12-week lifestyle intervention to improve HbA1c control in adults with newly diagnosed type 2 diabetes at our urban clinic."
            className="min-h-[180px] w-full rounded-lg border border-slate-300 bg-white p-4 text-base text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Generate study story
            </button>
            {!idea.trim() && storyRequested ? (
              <span className="text-xs text-red-600">Add your idea to generate a study story.</span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            Aurora will keep the narrative intact while structuring downstream documents and compliance artifacts.
          </p>
        </div>
      </section>

      <aside className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Study story</h2>
          <p className="mt-2 text-sm text-slate-600">
            Deterministic interpretation powered by the India v1 rulebook. Review every element before progressing.
          </p>
        </div>

        {story ? (
          <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposed title</h3>
              <p className="mt-1 text-slate-800">{story.studySpec.title}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Design</h3>
              <p className="mt-1 text-slate-800">
                {story.designKnown ? story.studySpec.designLabel : "Needs clarification"}
              </p>
              {!story.designKnown && (
                <p className="text-xs text-amber-600">
                  Design suggestion is uncertain; please refine your idea or consult a methodologist.
                </p>
              )}
            </div>
            {story.studySpec.condition ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condition focus</h3>
                <p className="mt-1 text-slate-800">{story.studySpec.condition}</p>
              </div>
            ) : null}
            {story.studySpec.populationDescription ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Population</h3>
                <p className="mt-1 text-slate-800">{story.studySpec.populationDescription}</p>
              </div>
            ) : null}
            {story.studySpec.setting ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Setting</h3>
                <p className="mt-1 text-slate-800">{story.studySpec.setting}</p>
              </div>
            ) : null}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary endpoint</h3>
              {story.studySpec.primaryEndpoint ? (
                <div className="mt-1 space-y-1">
                  <p className="text-slate-800">{story.studySpec.primaryEndpoint.name}</p>
                  <p className="text-xs text-slate-500">Type: {story.studySpec.primaryEndpoint.type}</p>
                  {story.studySpec.primaryEndpoint.timeframe ? (
                    <p className="text-xs text-slate-500">Timeframe: {story.studySpec.primaryEndpoint.timeframe}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-xs text-amber-600">Primary endpoint not clearly identified; please define it.</p>
              )}
            </div>
            {story.studySpec.notes.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h3>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
                  {story.studySpec.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Enter your idea and generate to see the structured story.
          </div>
        )}

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
          Draft interpretation generated from your idea using Aurora’s rulebook. This is not a final protocol and requires expert review.
        </div>
      </aside>
    </div>
  );
}
