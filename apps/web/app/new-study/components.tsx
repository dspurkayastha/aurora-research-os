"use client";

import type { StudySpec, SAPPlan, CRFForm, PISICFDraft, SampleSizeResult } from "@aurora/core";
import { Card } from "../../components/ui/card";
import { clsx } from "clsx";

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

export function SampleSizePanel({
  sampleSize,
  studySpec,
}: {
  sampleSize: SampleSizeResult | null;
  studySpec: StudySpec | null;
}) {
  if (!sampleSize) {
    return (
      <Card>
        <h2 className="text-xl font-semibold mb-4">Sample Size Calculation</h2>
        <p className="text-sm text-neutral-600">Compute sample size to see results here.</p>
      </Card>
    );
  }

  const statusConfig = {
    ok: {
      label: "Success",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      icon: "✓",
    },
    "incomplete-input": {
      label: "Incomplete Input",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      icon: "⚠",
    },
    "unsupported-design": {
      label: "Unsupported Design",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: "✗",
    },
    "invalid-input": {
      label: "Invalid Input",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: "✗",
    },
  };

  const config = statusConfig[sampleSize.status] || statusConfig["incomplete-input"];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Sample Size Calculation</h2>
        <div
          className={clsx(
            "px-3 py-1 rounded-full text-sm font-medium border",
            config.color,
            config.bgColor,
            config.borderColor
          )}
        >
          <span className="mr-2">{config.icon}</span>
          {config.label}
        </div>
      </div>

      {sampleSize.status === "ok" && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
          <h3 className="font-semibold text-green-900 mb-3">Calculation Successful</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {sampleSize.totalSampleSize !== undefined && (
              <div>
                <span className="text-sm text-green-700 font-medium">Total Sample Size:</span>
                <span className="ml-2 text-lg font-bold text-green-900">{sampleSize.totalSampleSize}</span>
              </div>
            )}
            {sampleSize.perGroupSampleSize !== undefined && (
              <div>
                <span className="text-sm text-green-700 font-medium">Per Group:</span>
                <span className="ml-2 text-lg font-bold text-green-900">{sampleSize.perGroupSampleSize}</span>
              </div>
            )}
            {sampleSize.eventsRequired !== undefined && (
              <div>
                <span className="text-sm text-green-700 font-medium">Events Required:</span>
                <span className="ml-2 text-lg font-bold text-green-900">{sampleSize.eventsRequired}</span>
              </div>
            )}
            {sampleSize.casesRequired !== undefined && (
              <div>
                <span className="text-sm text-green-700 font-medium">Cases Required:</span>
                <span className="ml-2 text-lg font-bold text-green-900">{sampleSize.casesRequired}</span>
              </div>
            )}
            {sampleSize.controlsRequired !== undefined && (
              <div>
                <span className="text-sm text-green-700 font-medium">Controls Required:</span>
                <span className="ml-2 text-lg font-bold text-green-900">{sampleSize.controlsRequired}</span>
              </div>
            )}
          </div>
          {sampleSize.methodId && (
            <div className="mt-3 text-sm text-green-700">
              <span className="font-medium">Method:</span> {sampleSize.description || sampleSize.methodId}
            </div>
          )}
        </div>
      )}

      {sampleSize.status === "incomplete-input" && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-2">Additional Information Required</h3>
          <p className="text-sm text-yellow-800 mb-3">
            Please provide the missing assumptions below to complete the sample size calculation.
          </p>
          {sampleSize.warnings.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-yellow-900 mb-2">Missing assumptions:</p>
              <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                {sampleSize.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(sampleSize.status === "unsupported-design" || sampleSize.status === "invalid-input") && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
          <h3 className="font-semibold text-red-900 mb-2">Calculation Not Available</h3>
          {sampleSize.warnings.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-red-800 mb-2">Reason:</p>
              <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                {sampleSize.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {sampleSize.status === "unsupported-design" && (
            <p className="text-sm text-red-800 mt-3">
              This design/endpoint combination is not supported by the automatic sample size calculator. Please consult with a statistician for manual calculation.
            </p>
          )}
        </div>
      )}

      {sampleSize.notes.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">Notes</h3>
          <ul className="list-disc list-inside text-sm text-neutral-600 space-y-1">
            {sampleSize.notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {sampleSize.assumptions && (
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">Current Assumptions</h3>
          <div className="grid gap-2 text-sm">
            <div>
              <span className="text-neutral-600">Alpha:</span>{" "}
              <span className="font-medium">{sampleSize.assumptions.alpha}</span>
            </div>
            <div>
              <span className="text-neutral-600">Power:</span>{" "}
              <span className="font-medium">{(sampleSize.assumptions.power * 100).toFixed(0)}%</span>
            </div>
            {sampleSize.assumptions.expectedControlEventRate !== undefined && (
              <div>
                <span className="text-neutral-600">Control Event Rate:</span>{" "}
                <span className="font-medium">
                  {(sampleSize.assumptions.expectedControlEventRate * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {sampleSize.assumptions.expectedTreatmentEventRate !== undefined && (
              <div>
                <span className="text-neutral-600">Treatment Event Rate:</span>{" "}
                <span className="font-medium">
                  {(sampleSize.assumptions.expectedTreatmentEventRate * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {sampleSize.assumptions.expectedMeanControl !== undefined && (
              <div>
                <span className="text-neutral-600">Control Mean:</span>{" "}
                <span className="font-medium">{sampleSize.assumptions.expectedMeanControl}</span>
              </div>
            )}
            {sampleSize.assumptions.expectedMeanTreatment !== undefined && (
              <div>
                <span className="text-neutral-600">Treatment Mean:</span>{" "}
                <span className="font-medium">{sampleSize.assumptions.expectedMeanTreatment}</span>
              </div>
            )}
            {sampleSize.assumptions.assumedSD !== undefined && (
              <div>
                <span className="text-neutral-600">Assumed SD:</span>{" "}
                <span className="font-medium">{sampleSize.assumptions.assumedSD}</span>
              </div>
            )}
            {sampleSize.assumptions.hazardRatio !== undefined && (
              <div>
                <span className="text-neutral-600">Hazard Ratio:</span>{" "}
                <span className="font-medium">{sampleSize.assumptions.hazardRatio}</span>
              </div>
            )}
            {sampleSize.assumptions.dropoutRate !== undefined && (
              <div>
                <span className="text-neutral-600">Dropout Rate:</span>{" "}
                <span className="font-medium">
                  {(sampleSize.assumptions.dropoutRate * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

