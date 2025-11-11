"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { StudySpec, SampleSizeAssumptionsBase, BaselineBuildResult } from "@aurora/core";

interface StudyContextType {
  idea: string;
  setIdea: (idea: string) => void;
  storySpec: StudySpec | null;
  setStorySpec: (spec: StudySpec | null) => void;
  assumptions: Partial<SampleSizeAssumptionsBase>;
  setAssumptions: (assumptions: Partial<SampleSizeAssumptionsBase>) => void;
  baselineResult: BaselineBuildResult | null;
  setBaselineResult: (result: BaselineBuildResult | null) => void;
  clarifyingQuestions: Array<{
    id: string;
    question: string;
    priority: "critical" | "important" | "optional";
    field?: string;
    answer?: string;
    skipped?: boolean;
  }>;
  setClarifyingQuestions: (questions: Array<{
    id: string;
    question: string;
    priority: "critical" | "important" | "optional";
    field?: string;
    answer?: string;
    skipped?: boolean;
  }>) => void;
  currentPreSpec: any;
  setCurrentPreSpec: (preSpec: any) => void;
  designConfidence: number | null;
  setDesignConfidence: (confidence: number | null) => void;
  designReasoning: string | null;
  setDesignReasoning: (reasoning: string | null) => void;
  useAIEnhancement: boolean;
  setUseAIEnhancement: (enabled: boolean) => void;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [idea, setIdea] = useState("");
  const [storySpec, setStorySpec] = useState<StudySpec | null>(null);
  const [assumptions, setAssumptions] = useState<Partial<SampleSizeAssumptionsBase>>({});
  const [baselineResult, setBaselineResult] = useState<BaselineBuildResult | null>(null);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<Array<{
    id: string;
    question: string;
    priority: "critical" | "important" | "optional";
    field?: string;
    answer?: string;
    skipped?: boolean;
  }>>([]);
  const [currentPreSpec, setCurrentPreSpec] = useState<any>(null);
  const [designConfidence, setDesignConfidence] = useState<number | null>(null);
  const [designReasoning, setDesignReasoning] = useState<string | null>(null);
  const [useAIEnhancement, setUseAIEnhancement] = useState(true);

  return (
    <StudyContext.Provider
      value={{
        idea,
        setIdea,
        storySpec,
        setStorySpec,
        assumptions,
        setAssumptions,
        baselineResult,
        setBaselineResult,
        clarifyingQuestions,
        setClarifyingQuestions,
        currentPreSpec,
        setCurrentPreSpec,
        designConfidence,
        setDesignConfidence,
        designReasoning,
        setDesignReasoning,
        useAIEnhancement,
        setUseAIEnhancement,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (context === undefined) {
    throw new Error("useStudy must be used within a StudyProvider");
  }
  return context;
}

