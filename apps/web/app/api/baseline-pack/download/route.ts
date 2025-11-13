import { NextResponse } from "next/server";

import {
  buildBaselinePackageFromIdea,
  buildBaselinePackageFromSpec,
  type SampleSizeAssumptionsBase,
  type StudySpec,
} from "@aurora/core";

import {
  buildBaselinePackZip,
  getBlockingIssues,
} from "../../../../lib/export-baseline-pack";

type DownloadRequest = {
  idea: string;
  studySpec?: StudySpec; // Optional: if provided, use this instead of rebuilding from idea
  assumptions?: Partial<SampleSizeAssumptionsBase>;
  acknowledgeCritical?: boolean;
  useAIEnhancement?: boolean;
};

function sanitizeAssumptions(
  raw: unknown
): Partial<SampleSizeAssumptionsBase> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const numericKeys: (keyof SampleSizeAssumptionsBase)[] = [
    "alpha",
    "power",
    "expectedControlEventRate",
    "expectedTreatmentEventRate",
    "expectedMeanControl",
    "expectedMeanTreatment",
    "assumedSD",
    "hazardRatio",
    "eventProportionDuringFollowUp",
    "expectedProportion",
    "precision",
    "dropoutRate",
    "clusterDesignEffect",
    "caseControlRatio",
    "exposurePrevInControls",
    "expectedSensitivity",
    "expectedSpecificity",
  ];

  const result: Record<string, unknown> = {};

  for (const key of numericKeys) {
    const value = input[key as string];
    if (typeof value === "number" && Number.isFinite(value)) {
      result[key as string] = value;
    }
  }

  const hypothesis = input.hypothesisType;
  if (
    hypothesis === "superiority" ||
    hypothesis === "estimation" ||
    hypothesis === "noninferiority" ||
    hypothesis === "equivalence"
  ) {
    result.hypothesisType = hypothesis;
  }

  if (typeof input.twoSided === "boolean") {
    result.twoSided = input.twoSided;
  }

  const targetMetric = input.targetMetric;
  if (
    targetMetric === "sensitivity" ||
    targetMetric === "specificity" ||
    targetMetric === "both"
  ) {
    result.targetMetric = targetMetric;
  }

  return Object.keys(result).length > 0 ? (result as Partial<SampleSizeAssumptionsBase>) : undefined;
}

function sanitiseFileName(title: string | undefined): string {
  if (!title) return "study";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "study";
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: DownloadRequest;
  try {
    payload = (await request.json()) as DownloadRequest;
  } catch (error) {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const idea = typeof payload.idea === "string" ? payload.idea.trim() : "";
  if (!idea && !payload.studySpec) {
    return NextResponse.json({ error: "idea-required" }, { status: 400 });
  }

  const assumptions = sanitizeAssumptions(payload.assumptions);
  const studySpec = payload.studySpec; // Use provided StudySpec if available (preserves clarifying questions)

  try {
    // If AI enhancement is requested, get enhanced baseline from API service
    let baseline: any;
    if (payload.useAIEnhancement) {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      try {
        const apiResponse = await fetch(`${API_BASE_URL}/preview/baseline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea: studySpec ? undefined : idea, // Don't send idea if we have studySpec
            studySpec, // Send studySpec if available
            assumptions,
            useAIEnhancement: true,
          }),
        });
        
        if (apiResponse.ok) {
          baseline = await apiResponse.json();
        } else {
          // Fallback to deterministic if API fails
          console.warn("AI enhancement failed, using deterministic baseline");
          if (studySpec) {
            baseline = buildBaselinePackageFromSpec(studySpec, assumptions);
          } else {
            baseline = buildBaselinePackageFromIdea(idea, assumptions);
          }
        }
      } catch (apiError) {
        // Fallback to deterministic if API is unavailable
        console.warn("AI enhancement unavailable, using deterministic baseline:", apiError);
        if (studySpec) {
          baseline = buildBaselinePackageFromSpec(studySpec, assumptions);
        } else {
          baseline = buildBaselinePackageFromIdea(idea, assumptions);
        }
      }
    } else {
      // Use StudySpec if available (preserves clarifying question answers), otherwise rebuild from idea
      if (studySpec) {
        baseline = buildBaselinePackageFromSpec(studySpec, assumptions);
      } else {
        baseline = buildBaselinePackageFromIdea(idea, assumptions);
      }
    }
    
    const blockingIssues = getBlockingIssues(baseline);

    if (blockingIssues.length > 0 && !payload.acknowledgeCritical) {
      return NextResponse.json(
        { error: "blocking-issues", issues: blockingIssues },
        { status: 422 }
      );
    }

    const zipData = await buildBaselinePackZip(baseline);
    const filename = `aurora-baseline-pack-${sanitiseFileName(
      baseline.studySpec.title
    )}.zip`;

    const responseBody =
      typeof Buffer !== "undefined" && typeof Buffer.from === "function"
        ? Buffer.from(zipData)
        : zipData;

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "export-failed", message: `${error}` },
      { status: 500 }
    );
  }
}

