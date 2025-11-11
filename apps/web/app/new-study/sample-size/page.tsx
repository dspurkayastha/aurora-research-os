"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudy } from "../context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { buildBaselinePackageFromIdea } from "@aurora/core";

export default function SampleSizePage() {
  const router = useRouter();
  const { idea, storySpec, assumptions, setAssumptions, setBaselineResult } = useStudy();
  const [localAssumptions, setLocalAssumptions] = useState(assumptions);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!storySpec) {
      router.push("/new-study/idea");
    }
  }, [storySpec, router]);

  const handleCompute = () => {
    setComputing(true);
    try {
      const result = buildBaselinePackageFromIdea(idea, localAssumptions as Partial<SampleSizeAssumptionsBase>);
      setAssumptions(localAssumptions);
      setBaselineResult(result);
    } catch (error) {
      console.error("Failed to compute baseline:", error);
    } finally {
      setComputing(false);
    }
  };

  if (!storySpec) {
    return (
      <Card>
        <p className="text-neutral-700">Please complete the previous steps first.</p>
        <Button onClick={() => router.push("/new-study/idea")} className="mt-4">
          Go to Idea Step
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold mb-4">Sample Size Assumptions</h2>
        <p className="text-sm text-neutral-700 mb-6">
          Provide assumptions for sample size calculation. Research-backed defaults are provided where available.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Alpha (Type I error)"
            type="number"
            value={localAssumptions.alpha?.toString() || "0.05"}
            onChange={(e) => setLocalAssumptions({ ...localAssumptions, alpha: parseFloat(e.target.value) })}
            step="0.01"
            min="0.0001"
            max="0.2"
            helperText="Default 0.05 unless protocol specifies otherwise."
          />
          <Input
            label="Power"
            type="number"
            value={localAssumptions.power?.toString() || "0.8"}
            onChange={(e) => setLocalAssumptions({ ...localAssumptions, power: parseFloat(e.target.value) })}
            step="0.01"
            min="0.5"
            max="0.99"
            helperText="80% power is typical for initial drafts."
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={handleCompute} isLoading={computing}>
            Compute Sample Size
          </Button>
        </div>
      </Card>

      <div className="flex gap-3 justify-between">
        <Button variant="outline" onClick={() => router.push("/new-study/design")}>
          ← Back
        </Button>
        <Button onClick={() => router.push("/new-study/documents")} disabled={!baselineResult}>
          Continue to Documents →
        </Button>
      </div>
    </div>
  );
}

