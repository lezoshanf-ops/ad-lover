import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnimatedCopyButtonProps {
  textToCopy: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  showLabel?: boolean;
  onCopied?: () => void;
}

export function AnimatedCopyButton({
  textToCopy,
  variant = 'ghost',
  size = 'sm',
  className,
  showLabel = true,
  onCopied,
}: AnimatedCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        'relative gap-1.5 overflow-hidden transition-all duration-300',
        copied && 'text-success',
        className
      )}
      onClick={handleCopy}
    >
      <div className="relative flex items-center gap-1.5">
        {/* Copy icon with fade out */}
        <div
          className={cn(
            'transition-all duration-300',
            copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
          )}
        >
          <Copy className="h-3.5 w-3.5" />
        </div>

        {/* Animated checkmark */}
        <div
          className={cn(
            'absolute left-0 transition-all duration-300',
            copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          )}
        >
          <div className="relative">
            {/* Expanding ring effect */}
            {copied && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-success/20 animate-copy-ring" />
              </div>
            )}
            {/* Checkmark with animation */}
            <div className={cn('animate-copy-success', !copied && 'hidden')}>
              <Check className="h-3.5 w-3.5 text-success" />
            </div>
          </div>
        </div>

        {/* Label */}
        {showLabel && (
          <span
            className={cn(
              'ml-3 transition-all duration-300',
              copied ? 'text-success' : ''
            )}
          >
            {copied ? 'Kopiert!' : 'Kopieren'}
          </span>
        )}
      </div>
    </Button>
  );
}

// Inline animated copy display for SMS codes with full visual feedback
interface AnimatedSmsCopyProps {
  code: string;
  onCopied?: () => void;
  className?: string;
}

export function AnimatedSmsCopy({ code, onCopied, className }: AnimatedSmsCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'group relative flex items-center gap-3 p-3 bg-background/80 rounded-lg border transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 cursor-pointer',
        copied && 'border-success/50 bg-success/5',
        className
      )}
    >
      {/* SMS Code */}
      <p
        className={cn(
          'text-2xl sm:text-3xl font-mono font-bold tracking-[0.3em] transition-colors duration-300',
          copied ? 'text-success' : 'text-primary'
        )}
      >
        {code}
      </p>

      {/* Copy indicator */}
      <div className="relative flex items-center justify-center w-10 h-10">
        {/* Default state - Copy icon */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-300',
            copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Copy className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Copied state - Animated checkmark */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-300',
            copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          )}
        >
          {/* Expanding ring */}
          {copied && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-success/30 animate-copy-ring" />
            </div>
          )}
          
          {/* Success circle with checkmark */}
          <div
            className={cn(
              'w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center',
              copied && 'animate-copy-success'
            )}
          >
            <Check className="h-4 w-4 text-success" />
          </div>
        </div>
      </div>

      {/* Tooltip on hover */}
      <span
        className={cn(
          'absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium rounded bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap',
          copied && 'opacity-100 bg-success'
        )}
      >
        {copied ? 'Kopiert!' : 'Klicken zum Kopieren'}
      </span>
    </button>
  );
}
