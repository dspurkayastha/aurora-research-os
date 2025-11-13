"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudy } from "../context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { SampleSizePanel } from "../components";
import { buildBaselinePackageFromSpec, type SampleSizeAssumptionsBase } from "@aurora/core";

export default function SampleSizePage() {
  const router = useRouter();
  const { idea, storySpec, assumptions, setAssumptions, baselineResult, setBaselineResult } = useStudy();
  const [localAssumptions, setLocalAssumptions] = useState(assumptions);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!storySpec) {
      router.push("/new-study/idea");
    }
  }, [storySpec, router]);

  useEffect(() => {
    if (baselineResult?.sampleSize) {
      // Update local assumptions with any defaults from the calculation
      setLocalAssumptions((prev) => ({
        ...prev,
        ...baselineResult.sampleSize.assumptions,
      }));
    }
  }, [baselineResult]);

  const handleCompute = () => {
    if (!storySpec) {
      console.error("Study spec is required for sample size calculation");
      return;
    }
    
    setComputing(true);
    try {
      // Use buildBaselinePackageFromSpec to preserve clarifying question answers
      const result = buildBaselinePackageFromSpec(storySpec, localAssumptions as Partial<SampleSizeAssumptionsBase>);
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

  const endpointType = storySpec.primaryEndpoint?.type;
  const needsBinaryInputs = endpointType === "binary";
  const needsContinuousInputs = endpointType === "continuous";
  const needsTimeToEventInputs = endpointType === "time-to-event";

  return (
    <div className="space-y-6">
      <SampleSizePanel sampleSize={baselineResult?.sampleSize || null} studySpec={storySpec} />

      <Card>
        <h2 className="text-xl font-semibold mb-4">Sample Size Assumptions</h2>
        <p className="text-sm text-neutral-700 mb-6">
          Provide assumptions for sample size calculation. Research-backed defaults are provided where available.
        </p>

        <div className="space-y-6">
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

          {needsBinaryInputs && (
            <div className="pt-4 border-t border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-700 mb-4">Binary Endpoint Assumptions</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Control Event Rate (%)"
                  type="number"
                  value={
                    localAssumptions.expectedControlEventRate
                      ? (localAssumptions.expectedControlEventRate * 100).toString()
                      : ""
                  }
                  onChange={(e) =>
                    setLocalAssumptions({
                      ...localAssumptions,
                      expectedControlEventRate: parseFloat(e.target.value) / 100,
                    })
                  }
                  step="0.1"
                  min="0"
                  max="100"
                  helperText="Expected proportion in control group (e.g., 20 for 20%)"
                />
                <Input
                  label="Treatment Event Rate (%)"
                  type="number"
                  value={
                    localAssumptions.expectedTreatmentEventRate
                      ? (localAssumptions.expectedTreatmentEventRate * 100).toString()
                      : ""
                  }
                  onChange={(e) =>
                    setLocalAssumptions({
                      ...localAssumptions,
                      expectedTreatmentEventRate: parseFloat(e.target.value) / 100,
                    })
                  }
                  step="0.1"
                  min="0"
                  max="100"
                  helperText="Expected proportion in treatment group (e.g., 15 for 15%)"
                />
              </div>
            </div>
          )}

          {needsContinuousInputs && (
            <div className="pt-4 border-t border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-700 mb-4">Continuous Endpoint Assumptions</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Control Mean"
                  type="number"
                  value={localAssumptions.expectedMeanControl?.toString() || ""}
                  onChange={(e) =>
                    setLocalAssumptions({
                      ...localAssumptions,
                      expectedMeanControl: parseFloat(e.target.value),
                    })
                  }
                  step="0.1"
                  helperText="Expected mean value in control group"
                />
                <Input
                  label="Treatment Mean"
                  type="number"
                  value={localAssumptions.expectedMeanTreatment?.toString() || ""}
                  onChange={(e) =>
                    setLocalAssumptions({
                      ...localAssumptions,
                      expectedMeanTreatment: parseFloat(e.target.value),
                    })
                  }
                  step="0.1"
                  helperText="Expected mean value in treatment group"
                />
                <Input
                  label="Assumed Standard Deviation"
                  type="number"
                  value={localAssumptions.assumedSD?.toString() || ""}
                  onChange={(e) =>
                    setLocalAssumptions({
                      ...localAssumptions,
                      assumedSD: parseFloat(e.target.value),
                    })
                  }
                  step="0.1"
                  min="0"
                  helperText="Common SD assumed for both groups"
                />
              </div>
            </div>
          )}

          {needsTimeToEventInputs && (
            <div className="pt-4 border-t border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-700 mb-4">Time-to-Event Endpoint Assumptions</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Hazard Ratio"
                  type="number"
                  value={localAssumptions.hazardRatio?.toString() || ""}
                  onChange={(e) =>
                    setLocalAssumptions({
                      ...localAssumptions,
                      hazardRatio: parseFloat(e.target.value),
                    })
                  }
                  step="0.01"
                  min="0"
                  helperText="Expected hazard ratio (treatment vs control)"
                />
                <Input
                  label="Event Proportion During Follow-up (%)"
                  type="number"
                  value={
                    localAssumptions.eventProportionDuringFollowUp
                      ? (localAssumptions.eventProportionDuringFollowUp * 100).toString()
                      : ""
                  }
                  onChange={(e) =>
                    setLocalAssumptions({
                      ...localAssumptions,
                      eventProportionDuringFollowUp: parseFloat(e.target.value) / 100,
                    })
                  }
                  step="0.1"
                  min="0"
                  max="100"
                  helperText="Expected proportion of events during follow-up period"
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">Additional Assumptions</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Dropout Rate (%)"
                type="number"
                value={localAssumptions.dropoutRate ? (localAssumptions.dropoutRate * 100).toString() : ""}
                onChange={(e) =>
                  setLocalAssumptions({
                    ...localAssumptions,
                    dropoutRate: parseFloat(e.target.value) / 100,
                  })
                }
                step="0.1"
                min="0"
                max="50"
                helperText="Expected dropout/loss to follow-up rate"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={handleCompute} isLoading={computing}>
            {baselineResult?.sampleSize ? "Recalculate Sample Size" : "Compute Sample Size"}
          </Button>
        </div>
      </Card>

      <div className="flex gap-3 justify-between">
        <Button variant="outline" onClick={() => router.push("/new-study/design")}>
          ← Back
        </Button>
        <Button
          onClick={() => router.push("/new-study/documents")}
          disabled={!baselineResult || computing || (baselineResult.sampleSize?.status !== "ok")}
        >
          Continue to Documents →
        </Button>
      </div>
    </div>
  );
}

