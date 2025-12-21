import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, HelpCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAvatarRefresh } from '@/hooks/useAvatarRefresh';
import { supabase } from '@/integrations/supabase/client';

interface PanelHeaderProps {
  onMenuToggle: () => void;
  headerActions?: ReactNode;
}

export default function PanelHeader({
  onMenuToggle,
  headerActions,
}: PanelHeaderProps) {
  const { profile } = useAuth();
  const avatarRefreshKey = useAvatarRefresh();

  const getAvatarUrl = () => {
    if (!profile?.avatar_url) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_url);
    // Add cache-busting timestamp when refreshKey changes
    return `${data.publicUrl}?t=${avatarRefreshKey || Date.now()}`;
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4 md:px-6 gap-4">
        {/* Left side - Menu toggle */}
        <div className="flex items-center gap-4 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="shrink-0 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {headerActions}
          
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          <ThemeToggle />

          <Avatar className="h-9 w-9 ring-2 ring-border cursor-pointer">
            <AvatarImage src={getAvatarUrl() || ''} alt={`${profile?.first_name} ${profile?.last_name}`} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
