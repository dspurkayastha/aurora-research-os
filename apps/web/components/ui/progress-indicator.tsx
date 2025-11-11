"use client";

import { motion } from "framer-motion";

interface Step {
  id: string;
  label: string;
  status: "pending" | "in-progress" | "completed" | "error";
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function ProgressIndicator({ steps, currentStep }: ProgressIndicatorProps) {
  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = step.status === "completed";
          const isInProgress = step.status === "in-progress";
          
          return (
            <div key={step.id} className="flex flex-col items-center flex-1 relative z-10">
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="absolute top-5 left-[60%] right-[-40%] h-1 z-0">
                  <div className="h-full bg-neutral-200 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${
                        isCompleted ? "bg-gradient-to-r from-indigo-600 to-purple-600" : "bg-neutral-200"
                      }`}
                      initial={{ width: "0%" }}
                      animate={{ width: isCompleted ? "100%" : "0%" }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
              
              {/* Step circle */}
              <motion.div
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  isActive && isInProgress
                    ? "border-indigo-600 bg-gradient-to-br from-indigo-100 to-purple-100 shadow-lg shadow-indigo-200"
                    : isCompleted
                    ? "border-emerald-600 bg-gradient-to-br from-emerald-100 to-teal-100 shadow-md"
                    : isActive
                    ? "border-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md"
                    : "border-neutral-300 bg-white"
                }`}
                whileHover={!isActive ? { scale: 1.1 } : {}}
              >
                {isCompleted ? (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </motion.svg>
                ) : isInProgress ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <span className={`text-sm font-semibold ${
                    isActive ? "text-indigo-600" : "text-neutral-500"
                  }`}>
                    {index + 1}
                  </span>
                )}
              </motion.div>
              
              {/* Step label */}
              <motion.span
                className={`mt-2 text-xs font-medium text-center max-w-[100px] ${
                  isActive ? "text-indigo-600 font-semibold" : isCompleted ? "text-emerald-600" : "text-neutral-500"
                }`}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: isActive ? 1 : 0.7 }}
              >
                {step.label}
              </motion.span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

