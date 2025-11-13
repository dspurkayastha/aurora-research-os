"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudy } from "../context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/input";
import { checkAIAvailability, parseIdeaWithAI, getClarifyingQuestions, selectDesignWithAI } from "../../../lib/ai-service";
import { buildBaselineSpec } from "@aurora/core";
import { clsx } from "clsx";

export default function IdeaPage() {
  const router = useRouter();
  const {
    idea,
    setIdea,
    setStorySpec,
    setClarifyingQuestions,
    clarifyingQuestions,
    currentPreSpec,
    setCurrentPreSpec,
    setDesignConfidence,
    setDesignReasoning,
  } = useStudy();

  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAI() {
      const status = await checkAIAvailability();
      setAiAvailable(status.available);
    }
    checkAI();
  }, []);

  const handleAnswerQuestion = (questionId: string, answer: string) => {
    setClarifyingQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, answer, skipped: false } : q))
    );
  };

  const handleSkipQuestion = (questionId: string) => {
    setClarifyingQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, skipped: true, answer: undefined } : q))
    );
  };

  const proceedWithDesignSelection = async (preSpec: any) => {
    setParsing(true);
    try {
      const designResult = await selectDesignWithAI(preSpec, idea);
      setDesignConfidence(designResult.confidence);
      setDesignReasoning(designResult.reasoning);

      const spec = buildBaselineSpec(preSpec, designResult.designId as any);
      setStorySpec(spec);
      setShowQuestions(false);
      router.push("/new-study/design");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select study design");
    } finally {
      setParsing(false);
    }
  };

  const handleGenerateStory = async () => {
    if (!idea.trim()) {
      setError("Please describe your study idea first.");
      return;
    }

    if (aiAvailable === false) {
      setError("AI service is required but unavailable. Please check your API configuration.");
      return;
    }

    setError(null);
    setParsing(true);

    try {
      const preSpec = await parseIdeaWithAI(idea);
      setCurrentPreSpec(preSpec);

      const questions = await getClarifyingQuestions(preSpec, idea);
      if (questions.length > 0) {
        setClarifyingQuestions(questions.map((q) => ({ ...q, answer: undefined, skipped: false })));
        setShowQuestions(true);
        setParsing(false);
        return;
      }

      await proceedWithDesignSelection(preSpec);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse study idea with AI");
      setParsing(false);
    }
  };

  const handleSubmitAnswers = async () => {
    if (!currentPreSpec) return;

    const updatedPreSpec = { ...currentPreSpec };
    const answeredQuestions = clarifyingQuestions.filter((q) => q.answer && !q.skipped);

    answeredQuestions.forEach((q) => {
      if (q.field === "selectedLanguages") {
        const languages = q.answer?.split(",").map((l) => l.trim()).filter(Boolean) || [];
        updatedPreSpec.selectedLanguages = languages;
      } else if (q.field && q.answer) {
        (updatedPreSpec as any)[q.field] = q.answer;
      }
    });

    updatedPreSpec.clarifyingQuestions = clarifyingQuestions;
    setCurrentPreSpec(updatedPreSpec);
    await proceedWithDesignSelection(updatedPreSpec);
  };

  return (
    <div className="space-y-8 w-full">
      {aiAvailable === false && (
        <Card variant="highlighted" className="border-red-400/60 bg-gradient-to-br from-red-50/90 to-orange-50/90">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm">
              !
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-red-900 mb-2">AI Service Unavailable (Required)</h2>
              <p className="text-sm text-red-800 leading-relaxed">
                Aurora Research OS requires AI to function. Please configure your GEMINI_API_KEY.
              </p>
            </div>
          </div>
        </Card>
      )}

      {aiAvailable === true && (
        <Card variant="highlighted" className="border-emerald-400/60 bg-gradient-to-br from-emerald-50/90 to-teal-50/90">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
              ✓
            </div>
            <p className="text-sm font-semibold text-emerald-800">AI service available and ready</p>
          </div>
        </Card>
      )}

      <Card variant="highlighted">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Describe Your Study Idea
            </h2>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Provide a detailed description of your research idea. The AI will help clarify any missing information.
            </p>
          </div>
          
          <div className="space-y-2">
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={10}
              placeholder="Example: We want to study 30-day mortality after emergency laparotomy in adults admitted to our tertiary care hospital..."
              helperText="Be as detailed as possible. Include information about the population, intervention, comparison, and outcomes if known."
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
            <Button
              onClick={handleGenerateStory}
              disabled={parsing || (aiAvailable === false) || !idea.trim()}
              isLoading={parsing}
              size="lg"
              className="w-full sm:w-auto"
            >
              {parsing ? "Parsing with AI..." : "Parse with AI"}
            </Button>
            {error && (
              <div className="flex-1 w-full sm:w-auto rounded-lg bg-red-50/80 border border-red-200/60 px-4 py-2.5">
                <p className="text-sm font-medium text-red-700 flex items-start gap-2">
                  <span className="text-red-600 flex-shrink-0">⚠</span>
                  <span className="whitespace-pre-wrap break-words">{error}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {showQuestions && clarifyingQuestions.length > 0 && (
        <Card variant="highlighted">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full text-base font-bold bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                  ?
                </span>
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Please Help Us Clarify Your Study Idea
                </span>
              </h2>
              <p className="text-sm text-neutral-700 ml-[52px] leading-relaxed">
                To better understand your study and select the most appropriate design, we need a few clarifications:
              </p>
            </div>

            <div className="space-y-5">
            {(() => {
              // Separate primary endpoint questions from others
              const endpointQuestions = clarifyingQuestions.filter((q) => q.field === "primaryOutcomeHint" || q.field === "timeframe");
              const otherQuestions = clarifyingQuestions.filter((q) => q.field !== "primaryOutcomeHint" && q.field !== "timeframe");
              
              return (
                <>
                  {endpointQuestions.length > 0 && (
                    <div className="mb-6 p-5 rounded-xl border-2 border-red-400/60 bg-gradient-to-br from-red-50/90 to-orange-50/90 shadow-[0_4px_12px_0_rgba(239,68,68,0.15)]">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">🎯</span>
                        <h3 className="text-lg font-bold text-red-900">Primary Endpoint Formulation</h3>
                      </div>
                      <p className="text-sm text-red-800 mb-4 leading-relaxed">
                        The primary endpoint is the most important outcome your study will measure. Please provide specific details to help us formulate it correctly.
                      </p>
                      <div className="mb-4 p-3 rounded-lg bg-white/80 border border-red-200/60">
                        <p className="text-xs font-semibold text-red-900 mb-2">Examples of well-formulated primary endpoints:</p>
                        <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                          <li>Binary: "30-day mortality", "Incidence of diabetes", "Response rate"</li>
                          <li>Continuous: "Change in systolic blood pressure (mmHg)", "HbA1c levels (%)", "Length of hospital stay (days)"</li>
                          <li>Time-to-event: "Time to disease progression", "Overall survival", "Time to first cardiovascular event"</li>
                        </ul>
                      </div>
                      <div className="space-y-4">
                        {endpointQuestions.map((q) => {
                          const isCritical = q.priority === "critical";
                          const isAnswered = q.answer && q.answer.trim().length > 0;
                          const isSkipped = q.skipped;

                          return (
                            <div
                              key={q.id}
                              className={clsx(
                                "rounded-xl border-2 p-5 transition-all duration-300 bg-white/90",
                                isCritical
                                  ? "border-red-500/60 shadow-[0_2px_8px_0_rgba(239,68,68,0.2)]"
                                  : "border-red-300/60 shadow-[0_2px_8px_0_rgba(239,68,68,0.1)]"
                              )}
                            >
                              <div className="flex items-center gap-2.5 mb-3">
                                <span
                                  className={clsx(
                                    "text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wide",
                                    isCritical
                                      ? "bg-red-600 text-white shadow-md"
                                      : "bg-red-400 text-white shadow-sm"
                                  )}
                                >
                                  {isCritical ? "Required" : "Recommended"}
                                </span>
                                {isCritical && <span className="text-sm text-red-600 font-bold">*</span>}
                              </div>
                              <p className="text-base font-semibold text-neutral-900 mb-4 leading-relaxed">{q.question}</p>
                              <Textarea
                                value={q.answer || ""}
                                onChange={(e) => handleAnswerQuestion(q.id, e.target.value)}
                                rows={3}
                                placeholder={isCritical ? "This field is required..." : "Your answer (optional)..."}
                              />
                              {!isCritical && (
                                <button
                                  type="button"
                                  onClick={() => handleSkipQuestion(q.id)}
                                  className="mt-3 text-xs font-medium text-neutral-500 hover:text-neutral-700 underline transition-colors"
                                >
                                  Skip this question
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {otherQuestions.map((q) => {
                    const isCritical = q.priority === "critical";
                    const isAnswered = q.answer && q.answer.trim().length > 0;
                    const isSkipped = q.skipped;

              return (
                <div
                  key={q.id}
                  className={clsx(
                    "rounded-xl border-2 p-5 transition-all duration-300",
                    isCritical
                      ? "border-red-400/60 bg-gradient-to-br from-red-50/90 to-orange-50/90 shadow-[0_2px_8px_0_rgba(239,68,68,0.1)]"
                      : q.priority === "important"
                      ? "border-amber-400/60 bg-gradient-to-br from-amber-50/90 to-yellow-50/90 shadow-[0_2px_8px_0_rgba(245,158,11,0.1)]"
                      : "border-neutral-300/60 bg-white/80 shadow-[0_2px_8px_0_rgba(0,0,0,0.05)]"
                  )}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <span
                      className={clsx(
                        "text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wide",
                        isCritical
                          ? "bg-red-500 text-white shadow-md"
                          : q.priority === "important"
                          ? "bg-amber-500 text-white shadow-md"
                          : "bg-neutral-400 text-white shadow-sm"
                      )}
                    >
                      {q.priority === "critical" ? "Required" : q.priority === "important" ? "Recommended" : "Optional"}
                    </span>
                    {isCritical && <span className="text-sm text-red-600 font-bold">*</span>}
                  </div>
                  <p className="text-base font-semibold text-neutral-900 mb-4 leading-relaxed">{q.question}</p>

                  {q.field === "selectedLanguages" ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Hindi", "Bengali", "Telugu", "Marathi", "Tamil", "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi", "Assamese", "Urdu", "English"].map(
                        (lang) => {
                          const isSelected = q.answer?.includes(lang);
                          return (
                            <label
                              key={lang}
                              className={clsx(
                                "flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200",
                                isSelected
                                  ? "border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md shadow-indigo-500/20"
                                  : "border-neutral-300/60 bg-white/80 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const current = q.answer?.split(",").map((l) => l.trim()).filter(Boolean) || [];
                                  if (e.target.checked) {
                                    handleAnswerQuestion(q.id, [...current, lang].join(", "));
                                  } else {
                                    handleAnswerQuestion(q.id, current.filter((l) => l !== lang).join(", "));
                                  }
                                }}
                                className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                              />
                              <span className="text-sm font-medium text-neutral-700">{lang}</span>
                            </label>
                          );
                        }
                      )}
                    </div>
                  ) : (
                    <Textarea
                      value={q.answer || ""}
                      onChange={(e) => handleAnswerQuestion(q.id, e.target.value)}
                      rows={3}
                      placeholder={isCritical ? "This field is required..." : "Your answer (optional)..."}
                    />
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-200/60">
                    {!isCritical && (
                      <button
                        type="button"
                        onClick={() => handleSkipQuestion(q.id)}
                        className="text-xs font-medium text-neutral-500 hover:text-neutral-700 underline transition-colors"
                      >
                        Skip this question
                      </button>
                    )}
                    {(isAnswered || isSkipped) && (
                      <div className={clsx(
                        "text-xs font-semibold px-2.5 py-1 rounded-lg",
                        isAnswered ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                      )}>
                        {isAnswered ? "✓ Answered" : "⊘ Skipped"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
                </>
              );
            })()}
            </div>

            <div className="flex items-center gap-4 justify-end pt-4 border-t border-neutral-200/60">
              <Button variant="outline" onClick={() => setShowQuestions(false)} size="md">
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAnswers}
                disabled={clarifyingQuestions.some((q) => q.priority === "critical" && !q.answer && !q.skipped) || parsing}
                isLoading={parsing}
                size="md"
              >
                Submit Answers & Continue
              </Button>
            </div>

            {clarifyingQuestions.some((q) => q.priority === "critical" && !q.answer && !q.skipped) && (
              <div className="rounded-lg bg-red-50/80 border border-red-200/60 px-4 py-3">
                <p className="text-sm font-medium text-red-700 flex items-center gap-2">
                  <span className="text-red-600">⚠</span>
                  <span>Please answer all required questions (marked with *) before continuing.</span>
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

