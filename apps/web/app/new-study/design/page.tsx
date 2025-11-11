"use client";

import { useRouter } from "next/navigation";
import { useStudy } from "../context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { StudyStoryPanel } from "../components";

export default function DesignPage() {
  const router = useRouter();
  const { storySpec, designConfidence, designReasoning } = useStudy();

  if (!storySpec) {
    return (
      <Card>
        <p className="text-neutral-700">Please complete the Idea step first.</p>
        <Button onClick={() => router.push("/new-study/idea")} className="mt-4">
          Go to Idea Step
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StudyStoryPanel studySpec={storySpec} designConfidence={designConfidence} designReasoning={designReasoning} />

      <div className="flex gap-3 justify-between">
        <Button variant="outline" onClick={() => router.push("/new-study/idea")}>
          ← Back
        </Button>
        <Button onClick={() => router.push("/new-study/sample-size")}>
          Continue to Sample Size →
        </Button>
      </div>
    </div>
  );
}

