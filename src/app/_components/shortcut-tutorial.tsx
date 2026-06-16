"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { useSession } from "next-auth/react";

const TUTORIAL_STEPS = [
  { key: "j", label: "Press 'j' to move down" },
  { key: "k", label: "Press 'k' to move up" },
  { key: "c", label: "Press 'c' to compose an email" },
  { key: "/", label: "Press '/' to search or run commands" },
];

export function ShortcutTutorial() {
  const { data: session } = useSession();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Only show if user is logged in
    if (!session?.user) return;

    // Check if they have already completed it
    const completed = localStorage.getItem("gusion_tutorial_completed");
    if (!completed) {
      // Delay showing it so the app loads first
      const t = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, [session]);

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (currentStep < TUTORIAL_STEPS.length) {
        if (e.key.toLowerCase() === TUTORIAL_STEPS[currentStep]?.key) {
          setCurrentStep((prev) => prev + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, currentStep]);

  useEffect(() => {
    if (currentStep === TUTORIAL_STEPS.length) {
      localStorage.setItem("gusion_tutorial_completed", "true");
      const t = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [currentStep]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-80 p-5 rounded-2xl border border-indigo-500/30 bg-zinc-950/90 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 transition-all duration-500">
      <button 
        onClick={() => {
          localStorage.setItem("gusion_tutorial_completed", "true");
          setIsVisible(false);
        }}
        className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition"
      >
        <X size={16} />
      </button>

      <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        Keyboard Shortcuts
      </h3>
      
      {currentStep < TUTORIAL_STEPS.length ? (
        <>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            Gusion Mail is designed to be used without a mouse. Let&apos;s learn the basics:
          </p>
          <div className="space-y-3">
            {TUTORIAL_STEPS.map((step, idx) => {
              const isPast = idx < currentStep;
              const isActive = idx === currentStep;
              
              return (
                <div 
                  key={step.key} 
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    isPast ? "opacity-40" : isActive ? "opacity-100 transform translate-x-1" : "opacity-30"
                  }`}
                >
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold border ${
                    isPast 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" 
                      : isActive 
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                        : "bg-zinc-900 text-zinc-500 border-zinc-800"
                  }`}>
                    {isPast ? <CheckCircle2 size={12} /> : step.key}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? "text-indigo-200" : "text-zinc-400"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="text-sm font-bold text-emerald-400">You&apos;re a pro!</h4>
          <p className="text-xs text-zinc-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300">?</kbd> anytime to see all shortcuts.
          </p>
        </div>
      )}
    </div>
  );
}
