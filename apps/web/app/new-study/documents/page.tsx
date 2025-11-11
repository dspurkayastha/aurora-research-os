"use client";

import { useRouter } from "next/navigation";
import { useStudy } from "../context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export default function DocumentsPage() {
  const router = useRouter();
  const { baselineResult } = useStudy();

  if (!baselineResult) {
    return (
      <Card>
        <p className="text-neutral-700">Please complete the Sample Size step first.</p>
        <Button onClick={() => router.push("/new-study/sample-size")} className="mt-4">
          Go to Sample Size Step
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold mb-4">Generated Documents</h2>
        <p className="text-sm text-neutral-700 mb-6">
          Review the generated documents below. All documents are drafts requiring PI and IEC review.
        </p>

        <div className="space-y-4">
          <div className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">Protocol</h3>
            <p className="text-sm text-neutral-600 mt-1">
              {baselineResult.protocol.sections.length} sections generated
            </p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">Statistical Analysis Plan (SAP)</h3>
            <p className="text-sm text-neutral-600 mt-1">
              {baselineResult.sap.endpoints.length} endpoints defined
            </p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">PIS/ICF</h3>
            <p className="text-sm text-neutral-600 mt-1">
              {baselineResult.pisIcf.sections.length} sections generated
            </p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">IEC Cover Note</h3>
            <p className="text-sm text-neutral-600 mt-1">Cover letter generated</p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">CRF Schema</h3>
            <p className="text-sm text-neutral-600 mt-1">
              {baselineResult.crf.forms.length} forms generated
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3 justify-between">
        <Button variant="outline" onClick={() => router.push("/new-study/sample-size")}>
          ← Back
        </Button>
        <Button onClick={() => router.push("/new-study/review")}>
          Continue to Review →
        </Button>
      </div>
    </div>
  );
}

