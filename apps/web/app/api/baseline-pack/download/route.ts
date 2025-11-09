import { NextResponse } from "next/server";

import {
  buildBaselinePackageFromIdea,
  type SampleSizeAssumptionsBase,
} from "@aurora/core";

import {
  buildBaselinePackZip,
  getBlockingIssues,
} from "../../../../lib/export-baseline-pack";

type DownloadRequest = {
  idea: string;
  assumptions?: Partial<SampleSizeAssumptionsBase>;
  acknowledgeCritical?: boolean;
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
  if (!idea) {
    return NextResponse.json({ error: "idea-required" }, { status: 400 });
  }

  const assumptions = sanitizeAssumptions(payload.assumptions);

  try {
    const baseline = buildBaselinePackageFromIdea(idea, assumptions);
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

