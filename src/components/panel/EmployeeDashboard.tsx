import { useState, createContext, useContext, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PanelSidebar from './PanelSidebar';
import PanelHeader from './PanelHeader';
import { ClipboardList, Clock, FileText, Calendar, User, Bell, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import EmployeeDashboardView from './employee/EmployeeDashboardView';
import EmployeeTasksView from './employee/EmployeeTasksView';
import EmployeeTimeView from './employee/EmployeeTimeView';
import EmployeeDocumentsView from './employee/EmployeeDocumentsView';
import EmployeeVacationView from './employee/EmployeeVacationView';
import EmployeeProfileView from './employee/EmployeeProfileView';
import EmployeeNotificationsView from './employee/EmployeeNotificationsView';
import { NotificationSettings } from './employee/NotificationSettings';
import { cn } from '@/lib/utils';

// Context to share tab navigation with optional pending task
interface TabContextValue {
  setActiveTab: (tab: string) => void;
  pendingTaskId: string | null;
  setPendingTaskId: (taskId: string | null) => void;
}
export const TabContext = createContext<TabContextValue | null>(null);
export const useTabContext = () => useContext(TabContext);

export default function EmployeeDashboard() {
  const [activeTab, setActiveTabState] = useState(() => {
    return sessionStorage.getItem('employeeActiveTab') || 'tasks';
  });
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const setActiveTab = (tab: string) => {
    sessionStorage.setItem('employeeActiveTab', tab);
    setActiveTabState(tab);
  };

  // Save scroll position continuously and restore on mount/visibility change
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('employeeScrollPosition');
    if (savedPosition) {
      setTimeout(() => window.scrollTo({ top: parseInt(savedPosition), behavior: 'smooth' }), 100);
    }

    const handleScroll = () => {
      sessionStorage.setItem('employeeScrollPosition', window.scrollY.toString());
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const pos = sessionStorage.getItem('employeeScrollPosition');
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

  // Fetch unread notifications count and listen for new status requests
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      
      setUnreadNotifications(count || 0);
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('notification-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchUnreadCount)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications'
      }, (payload) => {
        if (payload.new.user_id === user.id && payload.new.type === 'status_request') {
          toast({
            title: payload.new.title,
            description: 'Bitte gehe zum Auftrag und trage deinen Fortschritt ein.',
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveTab('tasks');
  };

  const menuSections = [
    {
      title: 'NAVIGATION',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'tasks', label: 'Meine Aufträge', icon: ClipboardList },
        { id: 'documents', label: 'Meine Verträge', icon: FileText },
      ],
    },
    {
      title: 'VERWALTUNG',
      items: [
        { id: 'time', label: 'Zeiterfassung', icon: Clock },
        { id: 'vacation', label: 'Urlaub', icon: Calendar },
        { id: 'notifications', label: 'Benachrichtigungen', icon: Bell, badge: unreadNotifications > 0 ? unreadNotifications : undefined },
        { id: 'profile', label: 'Profil', icon: User },
      ],
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <EmployeeDashboardView onNavigate={setActiveTab} />;
      case 'tasks':
        return <EmployeeTasksView />;
      case 'time':
        return <EmployeeTimeView />;
      case 'documents':
        return <EmployeeDocumentsView />;
      case 'vacation':
        return <EmployeeVacationView />;
      case 'notifications':
        return <EmployeeNotificationsView />;
      case 'profile':
        return <EmployeeProfileView />;
      default:
        return <EmployeeTasksView />;
    }
  };

  return (
    <TabContext.Provider value={{ setActiveTab, pendingTaskId, setPendingTaskId }}>
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
            searchPlaceholder="Suchen..."
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            headerActions={<NotificationSettings />}
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
    </TabContext.Provider>
  );
}
