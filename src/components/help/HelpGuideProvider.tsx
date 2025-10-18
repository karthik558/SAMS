import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { helpGuides, type HelpGuide, type HelpGuideStep } from "@/data/help-guides";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type HelpGuideContextValue = {
  guides: HelpGuide[];
  activeGuide: HelpGuide | null;
  activeStep: HelpGuideStep | null;
  stepIndex: number;
  startGuide: (id: string) => void;
  stopGuide: () => void;
  nextStep: () => void;
  previousStep: () => void;
};

const HelpGuideContext = createContext<HelpGuideContextValue | undefined>(undefined);

export function HelpGuideProvider({ children }: { children: React.ReactNode }) {
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const activeGuide = useMemo<HelpGuide | null>(
    () => (activeGuideId ? helpGuides.find((guide) => guide.id === activeGuideId) ?? null : null),
    [activeGuideId]
  );

  const activeStep = activeGuide?.steps[stepIndex] ?? null;
  const totalSteps = activeGuide?.steps.length ?? 0;

  const stopGuide = useCallback(() => {
    setActiveGuideId(null);
    setStepIndex(0);
  }, []);

  const startGuide = useCallback(
    (id: string) => {
      const guide = helpGuides.find((g) => g.id === id);
      if (!guide) return;
      if (activeGuideId === id) {
        // Already active – keep current progress.
        return;
      }
      setActiveGuideId(id);
      setStepIndex(0);
    },
    [activeGuideId]
  );

  const nextStep = useCallback(() => {
    if (!activeGuide) return;
    if (stepIndex < activeGuide.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      stopGuide();
    }
  }, [activeGuide, stepIndex, stopGuide]);

  const previousStep = useCallback(() => {
    if (!activeGuide) return;
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [activeGuide]);

  useEffect(() => {
    if (activeStep?.route && location.pathname !== activeStep.route) {
      navigate(activeStep.route);
    }
  }, [activeStep?.route, location.pathname, navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!activeGuide) return;
      if (event.key === "Escape") {
        event.preventDefault();
        stopGuide();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextStep();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousStep();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeGuide, nextStep, previousStep, stopGuide]);

  const value = useMemo<HelpGuideContextValue>(
    () => ({
      guides: helpGuides,
      activeGuide,
      activeStep,
      stepIndex,
      startGuide,
      stopGuide,
      nextStep,
      previousStep,
    }),
    [activeGuide, activeStep, stepIndex, startGuide, stopGuide, nextStep, previousStep]
  );

  return (
    <HelpGuideContext.Provider value={value}>
      {children}
      <HelpGuideOverlay
        guide={activeGuide}
        step={activeStep}
        stepIndex={stepIndex}
        onPrev={previousStep}
        onNext={nextStep}
        onClose={stopGuide}
        totalSteps={totalSteps}
      />
    </HelpGuideContext.Provider>
  );
}

export function useHelpGuide() {
  const ctx = useContext(HelpGuideContext);
  if (!ctx) throw new Error("useHelpGuide must be used within a HelpGuideProvider");
  return ctx;
}

type OverlayProps = {
  guide: HelpGuide | null;
  step: HelpGuideStep | null;
  stepIndex: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

function HelpGuideOverlay({ guide, step, stepIndex, totalSteps, onPrev, onNext, onClose }: OverlayProps) {
  if (!guide || !step) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-3 sm:bottom-6 sm:px-4">
      <Card className="w-full max-w-xl shadow-xl border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <CardHeader className="space-y-1 pb-3 sm:pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="uppercase">
                  Step {stepIndex + 1} of {totalSteps}
                </Badge>
                <span className="text-xs text-muted-foreground">{guide.title}</span>
              </div>
              <CardTitle className="text-lg leading-tight text-foreground">{step.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-destructive"
            >
              Exit
            </Button>
          </div>
          <Progress value={((stepIndex + 1) / totalSteps) * 100} className="h-1 w-full" />
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="leading-relaxed text-foreground/90">{step.description}</p>
          {step.tip ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
              {step.tip}
            </div>
          ) : null}
          {step.route ? (
            <div className="text-xs text-muted-foreground">
              You should now be on <span className="font-medium text-foreground">{step.route}</span>.
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("font-medium", "text-foreground/80")}>{guide.audience}</span>
            <span>•</span>
            <span>Use ← and → keys to move between steps.</span>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={onPrev} disabled={stepIndex === 0}>
              Back
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={onNext}>
              {stepIndex === totalSteps - 1 ? "Finish guide" : "Next"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>,
    document.body
  );
}
