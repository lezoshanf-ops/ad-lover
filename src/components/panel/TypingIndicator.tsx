interface TypingIndicatorProps {
  typingUsers: { id: string; name: string }[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers.map(u => u.name);
  let text = '';

  if (names.length === 1) {
    text = `${names[0]} schreibt`;
  } else if (names.length === 2) {
    text = `${names[0]} und ${names[1]} schreiben`;
  } else {
    text = `${names.length} Personen schreiben`;
  }

  return (
    <div className="flex items-center gap-3 mx-4 mb-3 px-4 py-2.5 bg-muted/40 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm animate-fade-in max-w-fit">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-primary/80 rounded-full animate-pulse" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
        <span className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
        <span className="w-2 h-2 bg-primary/40 rounded-full animate-pulse" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
      </div>
      <span className="text-sm font-medium text-muted-foreground">{text}</span>
    </div>
  );
}
