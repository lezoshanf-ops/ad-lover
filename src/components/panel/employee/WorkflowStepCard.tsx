import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';

// Import workflow step images
import step1Image from '@/assets/workflow/step-1-website.jpg';
import step2Image from '@/assets/workflow/step-2-rating.jpg';
import step3Image from '@/assets/workflow/step-3-decision.jpg';
import step4Image from '@/assets/workflow/step-4-kyc.jpg';
import step5Image from '@/assets/workflow/step-4-data.jpg';
import step6Image from '@/assets/workflow/step-5-videochat.jpg';
import step7Image from '@/assets/workflow/step-6-documents.jpg';
import step8Image from '@/assets/workflow/step-7-upload.jpg';
import step9Image from '@/assets/workflow/step-8-complete.jpg';

const TOTAL_STEPS = 9;

const stepImages: Record<number, string> = {
  1: step1Image,
  2: step2Image,
  3: step3Image,
  4: step4Image,
  5: step5Image,
  6: step6Image,
  7: step7Image,
  8: step8Image,
  9: step9Image,
};

const stepColors: Record<number, { bg: string; accent: string; glow: string }> = {
  1: { bg: 'from-blue-500/10 to-blue-600/5', accent: 'text-blue-500', glow: 'shadow-blue-500/20' },
  2: { bg: 'from-purple-500/10 to-purple-600/5', accent: 'text-purple-500', glow: 'shadow-purple-500/20' },
  3: { bg: 'from-emerald-500/10 to-emerald-600/5', accent: 'text-emerald-500', glow: 'shadow-emerald-500/20' },
  4: { bg: 'from-amber-500/10 to-amber-600/5', accent: 'text-amber-500', glow: 'shadow-amber-500/20' },
  5: { bg: 'from-orange-500/10 to-orange-600/5', accent: 'text-orange-500', glow: 'shadow-orange-500/20' },
  6: { bg: 'from-cyan-500/10 to-cyan-600/5', accent: 'text-cyan-500', glow: 'shadow-cyan-500/20' },
  7: { bg: 'from-teal-500/10 to-teal-600/5', accent: 'text-teal-500', glow: 'shadow-teal-500/20' },
  8: { bg: 'from-indigo-500/10 to-indigo-600/5', accent: 'text-indigo-500', glow: 'shadow-indigo-500/20' },
  9: { bg: 'from-green-500/10 to-green-600/5', accent: 'text-green-500', glow: 'shadow-green-500/20' },
};

const motivationalMessages: Record<number, string> = {
  1: 'Los geht\'s! Nimm dir Zeit für eine gründliche Analyse.',
  2: 'Deine Meinung zählt! Teile deine ehrliche Einschätzung.',
  3: 'Fast geschafft mit der Vorarbeit! Nur noch die Entscheidung.',
  4: 'Wichtiger Schritt! Lade deine Ausweisdokumente hoch.',
  5: 'Super Fortschritt! Die Demo-Daten kommen gleich.',
  6: 'Du machst das großartig! Der Videochat ist der Höhepunkt.',
  7: 'Entspann dich kurz! Die Unterlagen sind unterwegs.',
  8: 'Letzter Schritt! Lade deine Nachweise hoch.',
  9: 'Fantastisch! Du hast es fast geschafft! 🎉',
};

interface WorkflowStepCardProps {
  step: {
    number: number;
    title: string;
    description: string;
  };
  currentStep: number;
  isExpanded?: boolean;
  onClick?: () => void;
}

export default function WorkflowStepCard({ 
  step, 
  currentStep, 
  isExpanded = false,
  onClick 
}: WorkflowStepCardProps) {
  const isDone = step.number < currentStep;
  const isActive = step.number === currentStep;
  const colors = stepColors[step.number] || stepColors[1];
  const stepImage = stepImages[step.number];

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border transition-all duration-500 cursor-pointer overflow-hidden group',
        isActive
          ? `bg-gradient-to-br ${colors.bg} border-primary/30 shadow-lg ${colors.glow}`
          : isDone
            ? 'bg-muted/30 border-primary/20 hover:bg-muted/50'
            : 'bg-muted/20 border-border/50 hover:bg-muted/30 opacity-60'
      )}
    >
      {/* Animated background for active step */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 animate-pulse" />
      )}

      <div className="relative p-4">
        <div className="flex gap-4">
          {/* Step number indicator */}
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold transition-all duration-300',
              isDone
                ? 'bg-primary text-primary-foreground shadow-md'
                : isActive
                  ? `bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg ${colors.glow}`
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {isDone ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : isActive ? (
              <Sparkles className="h-5 w-5 animate-pulse" />
            ) : (
              step.number
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={cn(
                'font-semibold text-base',
                isActive && colors.accent,
                isDone && 'text-primary'
              )}>
                {step.title}
              </h4>
              {isDone && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  Erledigt
                </span>
              )}
            </div>
            
            <p className={cn(
              'text-sm leading-relaxed',
              isActive ? 'text-foreground/80' : 'text-muted-foreground'
            )}>
              {step.description}
            </p>

            {/* Motivational message for active step */}
            {isActive && motivationalMessages[step.number] && (
              <div className="mt-3 flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse', 
                  step.number <= 2 ? 'bg-blue-500' :
                  step.number <= 4 ? 'bg-amber-500' :
                  step.number <= 7 ? 'bg-cyan-500' : 'bg-green-500'
                )} />
                <p className="text-xs font-medium text-muted-foreground italic">
                  {motivationalMessages[step.number]}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Expanded view with image */}
        {(isExpanded || isActive) && stepImage && (
          <div className="mt-4 rounded-xl overflow-hidden border border-border/50 shadow-inner">
            <img
              src={stepImage}
              alt={`Illustration für ${step.title}`}
              className="w-full h-32 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute bottom-4 right-4 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-lg text-xs font-medium text-muted-foreground">
              Schritt {step.number} von {TOTAL_STEPS}
            </div>
          </div>
        )}
      </div>

      {/* Progress line connector */}
      {step.number < TOTAL_STEPS && (
        <div className={cn(
          'absolute left-9 top-[4.5rem] w-0.5 h-6 -translate-x-1/2',
          isDone ? 'bg-primary' : 'bg-border'
        )} />
      )}
    </div>
  );
}
