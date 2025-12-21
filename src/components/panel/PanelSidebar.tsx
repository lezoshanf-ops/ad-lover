import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, ChevronRight, PanelLeftClose, PanelLeft, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface PanelSidebarProps {
  sections: MenuSection[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogoClick?: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  verificationRequired?: boolean;
  onVerificationClick?: () => void;
}

export default function PanelSidebar({
  sections,
  activeTab,
  onTabChange,
  onLogoClick,
  collapsed,
  onCollapsedChange,
  verificationRequired = false,
  onVerificationClick,
}: PanelSidebarProps) {
  const { profile, role, signOut } = useAuth();

  const getAvatarUrl = () => {
    if (!profile?.avatar_url) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_url);
    return data.publicUrl;
  };

  const handleSignOut = async () => {
    sessionStorage.removeItem('adminActiveTab');
    sessionStorage.removeItem('adminScrollPosition');
    sessionStorage.removeItem('employeeActiveTab');
    sessionStorage.removeItem('employeeScrollPosition');
    await signOut();
    window.location.href = '/panel/login';
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-0 md:w-16" : "w-64"
        )}
      >
        {/* Logo and Toggle */}
        <div
          className={cn(
            "h-16 flex items-center border-b border-sidebar-border px-4 shrink-0",
            collapsed && "md:justify-center md:px-2"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all flex-1",
              collapsed && "md:justify-center"
            )}
            onClick={onLogoClick}
          >
            <img
              src={logo}
              alt="Fritze IT"
              className="h-10 w-auto brightness-0 invert"
            />
            {!collapsed && (
              <span className="font-bold text-lg text-sidebar-foreground">Fritze IT</span>
            )}
          </div>
          
          {/* Toggle Button - Desktop only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange(!collapsed)}
            className={cn(
              "hidden md:flex h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
              collapsed && "md:hidden"
            )}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="hidden md:flex justify-center py-2 border-b border-sidebar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onCollapsedChange(false)}
                  className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Sidebar erweitern
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              {!collapsed && (
                <h3 className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-0.5 px-2">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onTabChange(item.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 relative group",
                            activeTab === item.id
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground",
                            collapsed && "md:justify-center md:px-2"
                          )}
                        >
                          <div className="relative shrink-0">
                            <item.icon className="h-5 w-5" />
                            {item.badge && item.badge > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            )}
                          </div>
                          {!collapsed && (
                            <span className="font-medium text-sm flex-1">{item.label}</span>
                          )}
                        </button>
                      </TooltipTrigger>
                      {collapsed && (
                        <TooltipContent side="right">
                          {item.label}
                          {item.badge && item.badge > 0 && ` (${item.badge})`}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Verification required badge */}
        {verificationRequired && !collapsed && (
          <div className="mx-2 mb-4">
            <button
              onClick={onVerificationClick}
              className="w-full p-3 bg-primary/20 border border-primary/30 rounded-xl text-left transition-all hover:bg-primary/30"
            >
              <div className="flex items-center gap-2 text-primary mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-semibold">Verifizierung erforderlich</span>
              </div>
              <Button 
                size="sm" 
                className="w-full mt-2 gap-2 bg-primary hover:bg-primary/90"
              >
                <AlertTriangle className="h-4 w-4" />
                Jetzt verifizieren
              </Button>
            </button>
          </div>
        )}
        
        {verificationRequired && collapsed && (
          <div className="hidden md:flex justify-center mb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onVerificationClick}
                  className="p-2 bg-primary/20 rounded-lg text-primary hover:bg-primary/30 transition-colors"
                >
                  <AlertTriangle className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Verifizierung erforderlich
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* User info at bottom */}
        <div className="mt-auto border-t border-sidebar-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "p-3 flex items-center gap-3 hover:bg-sidebar-accent/30 transition-colors cursor-pointer",
                  collapsed && "md:justify-center md:p-2"
                )}
                onClick={() => onTabChange('profile')}
                title="Profil"
              >
                <Avatar className="h-10 w-10 ring-2 ring-sidebar-border shrink-0">
                  <AvatarImage src={getAvatarUrl() || ''} alt={`${profile?.first_name} ${profile?.last_name}`} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-sidebar-foreground">
                      {profile?.first_name} {profile?.last_name}
                    </p>
                    <p className="text-xs truncate text-sidebar-foreground/60">
                      {role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                    </p>
                  </div>
                )}
                {!collapsed && <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />}
              </div>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                {profile?.first_name} {profile?.last_name}
              </TooltipContent>
            )}
          </Tooltip>

          {/* Logout button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors border-t border-sidebar-border",
                  collapsed && "md:justify-center md:px-2"
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="font-medium text-sm">Abmelden</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                Abmelden
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
