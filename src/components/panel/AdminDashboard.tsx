import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PanelSidebar from './PanelSidebar';
import PanelHeader from './PanelHeader';
import AdminDashboardView from './admin/AdminDashboardView';
import AdminTasksView from './admin/AdminTasksView';
import AdminUsersView from './admin/AdminUsersView';
import AdminSmsView from './admin/AdminSmsView';
import AdminVacationView from './admin/AdminVacationView';
import AdminStatsView from './admin/AdminStatsView';
import AdminActivityView from './admin/AdminActivityView';
import AdminChatView from './admin/AdminChatView';
import AdminEvaluationsView from './admin/AdminEvaluationsView';
import { ClipboardList, Users, MessageSquare, Calendar, BarChart3, Activity, LayoutDashboard, MessageCircle, Settings, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const [activeTab, setActiveTabState] = useState(() => {
    return sessionStorage.getItem('adminActiveTab') || 'tasks';
  });
  const [pendingSmsCount, setPendingSmsCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const setActiveTab = (tab: string) => {
    sessionStorage.setItem('adminActiveTab', tab);
    setActiveTabState(tab);
  };

  // Save scroll position continuously and restore on mount/visibility change
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('adminScrollPosition');
    if (savedPosition) {
      setTimeout(() => window.scrollTo({ top: parseInt(savedPosition), behavior: 'smooth' }), 100);
    }

    const handleScroll = () => {
      sessionStorage.setItem('adminScrollPosition', window.scrollY.toString());
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const pos = sessionStorage.getItem('adminScrollPosition');
        if (pos) {
          setTimeout(() => window.scrollTo({ top: parseInt(pos), behavior: 'smooth' }), 100);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    fetchPendingSmsCount();

    const smsChannel = supabase
      .channel('admin-sms-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'sms_code_requests' 
      }, (payload) => {
        if (payload.new?.status === 'pending') {
          setPendingSmsCount(prev => prev + 1);
          toast({
            title: 'Neue SMS-Code Anfrage',
            description: 'Ein Mitarbeiter hat einen SMS-Code angefordert.',
            variant: 'default',
          });
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'sms_code_requests' 
      }, () => {
        fetchPendingSmsCount();
      })
      .subscribe();

    const notificationsChannel = supabase
      .channel('admin-task-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications'
      }, (payload) => {
        if (user && payload.new.user_id === user.id && payload.new.type === 'task_completed') {
          toast({
            title: payload.new.title,
            description: payload.new.message,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(smsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, toast]);

  const fetchPendingSmsCount = async () => {
    const { count } = await supabase
      .from('sms_code_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    setPendingSmsCount(count || 0);
  };

  const handleLogoClick = () => {
    setActiveTab('tasks');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const menuSections = [
    {
      title: 'ÜBERSICHT',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'tasks', label: 'Aufträge', icon: ClipboardList },
        { id: 'users', label: 'Mitarbeiter', icon: Users },
      ],
    },
    {
      title: 'ANFRAGEN',
      items: [
        { id: 'sms', label: 'SMS-Codes', icon: MessageSquare, badge: pendingSmsCount > 0 ? pendingSmsCount : undefined },
        { id: 'vacation', label: 'Urlaubsanträge', icon: Calendar },
      ],
    },
    {
      title: 'KOMMUNIKATION',
      items: [
        { id: 'chat', label: 'Chat', icon: MessageCircle },
        { id: 'activity', label: 'Aktivität', icon: Activity },
      ],
    },
    {
      title: 'VERWALTUNG',
      items: [
        { id: 'evaluations', label: 'Bewertungen', icon: ClipboardCheck },
        { id: 'stats', label: 'Statistiken', icon: BarChart3 },
        { id: 'settings', label: 'Einstellungen', icon: Settings },
      ],
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboardView onNavigate={setActiveTab} />;
      case 'tasks':
        return <AdminTasksView />;
      case 'users':
        return <AdminUsersView />;
      case 'activity':
        return <AdminActivityView />;
      case 'sms':
        return <AdminSmsView />;
      case 'vacation':
        return <AdminVacationView />;
      case 'stats':
        return <AdminStatsView />;
      case 'evaluations':
        return <AdminEvaluationsView />;
      case 'chat':
        return <AdminChatView />;
      case 'settings':
        return (
          <div className="text-center py-12">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Einstellungen</h2>
            <p className="text-muted-foreground">Einstellungen werden bald verfügbar sein.</p>
          </div>
        );
      default:
        return <AdminTasksView />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      <PanelSidebar
        sections={menuSections}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogoClick={handleLogoClick}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          sidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64"
        )}
      >
        <PanelHeader
          onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          showSearch={true}
          searchPlaceholder="Mitarbeiter, Aufträge suchen..."
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
          {renderContent()}
        </main>
      </div>

      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
    </div>
  );
}
