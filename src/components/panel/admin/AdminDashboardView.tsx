import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  ClipboardList, 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Calendar,
  MessageSquare,
  ArrowRight,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  totalEmployees: number;
  pendingVacations: number;
  pendingSmsRequests: number;
}

interface RecentActivity {
  id: string;
  type: string;
  message: string;
  time: string;
}

interface AdminDashboardViewProps {
  onNavigate: (tab: string) => void;
}

export default function AdminDashboardView({ onNavigate }: AdminDashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    totalEmployees: 0,
    pendingVacations: 0,
    pendingSmsRequests: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch tasks stats
      const { data: tasks } = await supabase.from('tasks').select('status');
      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
      const activeTasks = tasks?.filter(t => ['assigned', 'in_progress', 'sms_requested'].includes(t.status)).length || 0;

      // Fetch employees count
      const { count: employeesCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'employee');

      // Fetch pending vacation requests
      const { count: vacationsCount } = await supabase
        .from('vacation_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch pending SMS requests
      const { count: smsCount } = await supabase
        .from('sms_code_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch recent activity logs
      const { data: activities } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalTasks,
        completedTasks,
        activeTasks,
        totalEmployees: employeesCount || 0,
        pendingVacations: vacationsCount || 0,
        pendingSmsRequests: smsCount || 0,
      });

      setRecentActivities(
        (activities || []).map(a => ({
          id: a.id,
          type: a.activity_type,
          message: getActivityMessage(a.activity_type, a.metadata),
          time: format(new Date(a.created_at), 'dd.MM.yyyy HH:mm', { locale: de }),
        }))
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityMessage = (type: string, metadata: any): string => {
    switch (type) {
      case 'check_in':
        return 'Mitarbeiter hat sich eingestempelt';
      case 'check_out':
        return 'Mitarbeiter hat sich ausgestempelt';
      case 'task_completed':
        return 'Auftrag wurde abgeschlossen';
      case 'task_accepted':
        return 'Auftrag wurde angenommen';
      default:
        return type;
    }
  };

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  const quickActions = [
    { label: 'Neuer Auftrag', icon: ClipboardList, tab: 'tasks', color: 'bg-primary' },
    { label: 'SMS-Codes', icon: MessageSquare, tab: 'sms', badge: stats.pendingSmsRequests, color: 'bg-orange-500' },
    { label: 'Urlaubsanträge', icon: Calendar, tab: 'vacation', badge: stats.pendingVacations, color: 'bg-blue-500' },
    { label: 'Mitarbeiter', icon: Users, tab: 'users', color: 'bg-green-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Willkommen zurück! Hier ist Ihre Übersicht.</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('tasks')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gesamt Aufträge</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.totalTasks}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('tasks')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aktive Aufträge</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.activeTasks}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('stats')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Abgeschlossen</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.completedTasks}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {completionRate}% Erfolgsrate
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('users')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mitarbeiter</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.totalEmployees}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schnellaktionen</CardTitle>
            <CardDescription>Häufig verwendete Aktionen</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.tab}
                variant="outline"
                className="h-auto py-4 px-4 flex flex-col items-center gap-2 relative hover:border-primary/50"
                onClick={() => onNavigate(action.tab)}
              >
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white", action.color)}>
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
                {action.badge && action.badge > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2">
                    {action.badge}
                  </Badge>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Letzte Aktivitäten</CardTitle>
              <CardDescription>Neueste Ereignisse im System</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('activity')}>
              Alle anzeigen
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Aktivitäten vorhanden</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Alert */}
      {(stats.pendingSmsRequests > 0 || stats.pendingVacations > 0) && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-orange-800 dark:text-orange-200">Ausstehende Anfragen</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {stats.pendingSmsRequests > 0 && `${stats.pendingSmsRequests} SMS-Code Anfrage${stats.pendingSmsRequests > 1 ? 'n' : ''}`}
                  {stats.pendingSmsRequests > 0 && stats.pendingVacations > 0 && ' und '}
                  {stats.pendingVacations > 0 && `${stats.pendingVacations} Urlaubsantrag${stats.pendingVacations > 1 ? 'e' : ''}`}
                </p>
              </div>
              <div className="flex gap-2">
                {stats.pendingSmsRequests > 0 && (
                  <Button size="sm" variant="outline" onClick={() => onNavigate('sms')}>
                    SMS-Codes
                  </Button>
                )}
                {stats.pendingVacations > 0 && (
                  <Button size="sm" variant="outline" onClick={() => onNavigate('vacation')}>
                    Urlaub
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}