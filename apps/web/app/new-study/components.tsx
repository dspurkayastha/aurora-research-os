"use client";

import type { StudySpec, SAPPlan, CRFForm, PISICFDraft } from "@aurora/core";
import { Card } from "../../components/ui/card";

export function StudyStoryPanel({
  studySpec,
  designConfidence,
  designReasoning,
}: {
  studySpec: StudySpec;
  designConfidence?: number | null;
  designReasoning?: string | null;
}) {
  return (
    <Card>
      <h2 className="text-xl font-semibold mb-4">Study Story (Draft)</h2>
      <p className="text-sm text-neutral-700 mb-4">
        Draft interpretation generated from your idea using AI and Aurora's rulebook. Requires PI and IEC review before use.
      </p>
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Title:</span> {studySpec.title}
        </div>
        <div>
          <span className="font-medium">Design:</span> {studySpec.designLabel ?? "Needs classification"}
          {designConfidence !== null && designConfidence !== undefined && (
            <span className="ml-2 text-xs text-neutral-600">(AI confidence: {designConfidence}%)</span>
          )}
        </div>
        {designReasoning && (
          <div className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-800">
            <span className="font-medium">AI Reasoning:</span> {designReasoning}
          </div>
        )}
        <div>
          <span className="font-medium">Condition:</span> {studySpec.condition ?? "Not parsed"}
        </div>
        <div>
          <span className="font-medium">Population:</span> {studySpec.populationDescription ?? "Not parsed"}
        </div>
        {studySpec.primaryEndpoint && (
          <div>
            <span className="font-medium">Primary endpoint:</span> {studySpec.primaryEndpoint.name} ({studySpec.primaryEndpoint.type})
          </div>
        )}
      </div>
    </Card>
  );
}

