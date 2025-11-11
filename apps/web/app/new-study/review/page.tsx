"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudy } from "../context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { canLockAndLaunch } from "@aurora/core";
import { buildBaselinePackZip } from "../../../../lib/export-baseline-pack";

export default function ReviewPage() {
  const router = useRouter();
  const { baselineResult, idea, assumptions, useAIEnhancement = true } = useStudy();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [acknowledgeCritical, setAcknowledgeCritical] = useState(false);

  if (!baselineResult) {
    return (
      <Card>
        <p className="text-neutral-700">Please complete all previous steps first.</p>
        <Button onClick={() => router.push("/new-study/documents")} className="mt-4">
          Go to Documents Step
        </Button>
      </Card>
    );
  }

  const gate = canLockAndLaunch(baselineResult);
  const criticalIssues = baselineResult.issues.filter((issue) => issue.severity === "critical");

  const handleDownload = async () => {
    if (criticalIssues.length > 0 && !acknowledgeCritical) {
      setDownloadError("Please acknowledge critical issues before downloading.");
      return;
    }

    setDownloading(true);
    setDownloadError(null);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${API_BASE_URL}/api/baseline-pack/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          assumptions,
          acknowledgeCritical,
          useAIEnhancement: useAIEnhancement ?? true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aurora-baseline-pack-${baselineResult.studySpec.title.toLowerCase().replace(/\s+/g, "-")}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold mb-4">Compliance Checklist</h2>
        <p className="text-sm text-neutral-700 mb-6">
          Review the compliance checklist before downloading your baseline pack.
        </p>

        {criticalIssues.length > 0 && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-4">
            <h3 className="font-medium text-red-900 mb-2">Critical Issues</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
              {criticalIssues.map((issue, idx) => (
                <li key={idx}>{issue.message}</li>
              ))}
            </ul>
            <label className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={acknowledgeCritical}
                onChange={(e) => setAcknowledgeCritical(e.target.checked)}
                className="rounded border-neutral-300"
              />
              <span className="text-sm text-red-800">I acknowledge these critical issues</span>
            </label>
          </div>
        )}

        {gate.blockingIssues.length === 0 && (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-4 mb-4">
            <p className="text-sm text-emerald-800">✓ No blocking issues found. Ready to download.</p>
          </div>
        )}

        <div className="mt-6">
          <Button onClick={handleDownload} isLoading={downloading} disabled={criticalIssues.length > 0 && !acknowledgeCritical}>
            {downloading ? "Preparing Download..." : "Download Baseline Pack"}
          </Button>
        </div>

        {downloadError && <p className="mt-3 text-sm text-red-600">{downloadError}</p>}
      </Card>

      <div className="flex gap-3 justify-between">
        <Button variant="outline" onClick={() => router.push("/new-study/documents")}>
          ← Back
        </Button>
      </div>
    </div>
  );
}

