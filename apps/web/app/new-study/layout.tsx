"use client";

import { StudyProvider, useStudy } from "./context";
import { ProgressIndicator } from "../../components/ui/progress-indicator";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const STEPS = [
  { id: "idea", label: "Idea", path: "/new-study/idea" },
  { id: "design", label: "Design", path: "/new-study/design" },
  { id: "sample-size", label: "Sample Size", path: "/new-study/sample-size" },
  { id: "documents", label: "Documents", path: "/new-study/documents" },
  { id: "review", label: "Review", path: "/new-study/review" },
];

function getCurrentStepIndex(pathname: string): number {
  if (pathname.includes("/idea")) return 0;
  if (pathname.includes("/design")) return 1;
  if (pathname.includes("/sample-size")) return 2;
  if (pathname.includes("/documents")) return 3;
  if (pathname.includes("/review")) return 4;
  return 0;
}

function getStepStatus(index: number, currentIndex: number, storySpec: any, baselineResult: any): "pending" | "in-progress" | "completed" | "error" {
  if (index < currentIndex) return "completed";
  if (index === 0 && storySpec) return "completed";
  if (index === 1 && storySpec) return "completed";
  if (index === 2 && baselineResult) return "completed";
  if (index === 3 && baselineResult) return "completed";
  if (index === currentIndex) return "in-progress";
  return "pending";
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { storySpec, baselineResult } = useStudy();
  const currentStepIndex = getCurrentStepIndex(pathname);

  // Redirect root /new-study to /new-study/idea
  useEffect(() => {
    if (pathname === "/new-study") {
      router.replace("/new-study/idea");
    }
  }, [pathname, router]);

  const steps = STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: getStepStatus(index, currentStepIndex, storySpec, baselineResult),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40 relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="relative z-10 mx-auto max-w-6xl space-y-10 p-8">
        <header className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
              Aurora Research OS — New Study
            </h1>
            <p className="text-base text-neutral-700 leading-relaxed max-w-3xl">
              Aurora converts clinician ideas into regulatory-compliant drafts aligned with Indian clinical research guidelines (ICMR, CTRI, Indian GCP/NDCT, ICH E6(R3)). All outputs are drafts requiring Principal Investigator and IEC review.
            </p>
          </div>
          
          <div className="pt-2">
            <ProgressIndicator steps={steps} currentStep={currentStepIndex} />
          </div>
        </header>

        <main className="relative">{children}</main>
      </div>
    </div>
  );
}

export default function NewStudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudyProvider>
      <LayoutContent>{children}</LayoutContent>
    </StudyProvider>
  );
}

