import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

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
}

export default function PanelSidebar({
  sections,
  activeTab,
  onTabChange,
  onLogoClick,
  collapsed,
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
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-0 md:w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-sidebar-border px-4 shrink-0",
          collapsed && "md:justify-center md:px-2"
        )}
      >
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
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
      </div>

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
                      <>
                        <span className="font-medium text-sm flex-1">{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="mt-auto border-t border-sidebar-border">
        <div
          className={cn(
            "p-3 flex items-center gap-3 hover:bg-sidebar-accent/30 transition-colors cursor-pointer",
            collapsed && "md:justify-center md:p-2"
          )}
          onClick={handleSignOut}
          title="Abmelden"
        >
          <Avatar className="h-10 w-10 ring-2 ring-sidebar-border shrink-0">
            <AvatarImage src={getAvatarUrl() || ''} alt={`${profile?.first_name} ${profile?.last_name}`} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm font-semibold">
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

        {/* Logout button */}
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
      </div>
    </aside>
  );
}
