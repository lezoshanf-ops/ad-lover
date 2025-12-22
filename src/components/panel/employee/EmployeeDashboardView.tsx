import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Bell,
  ArrowRight,
  FileText,
  Play,
  User,
  AlertTriangle,
  XCircle,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInHours, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { de } from 'date-fns/locale';

interface DashboardStats {
  assignedTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  unreadNotifications: number;
  todayWorkHours: number;
  todayWorkMinutes: number;
  isCheckedIn: boolean;
}

interface ActiveTask {
  id: string;
  title: string;
  customer_name: string;
  status: string;
  priority: string;
}

interface KycStatus {
  pendingCount: number;
  rejectedCount: number;
  rejectedDocs: { fileName: string; reviewNotes: string | null }[];
}

interface EmployeeDashboardViewProps {
  onNavigate: (tab: string) => void;
}

export default function EmployeeDashboardView({ onNavigate }: EmployeeDashboardViewProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    assignedTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    unreadNotifications: 0,
    todayWorkHours: 0,
    todayWorkMinutes: 0,
    isCheckedIn: false,
  });
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [kycStatus, setKycStatus] = useState<KycStatus>({ pendingCount: 0, rejectedCount: 0, rejectedDocs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch assigned tasks
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select(`
          task_id,
          status,
          tasks (
            id,
            title,
            customer_name,
            status,
            priority
          )
        `)
        .eq('user_id', user.id);

      const assignedTasks = assignments?.length || 0;
      const completedTasks = assignments?.filter(a => a.tasks?.status === 'completed').length || 0;
      const inProgressTasks = assignments?.filter(a => ['in_progress', 'sms_requested'].includes(a.tasks?.status || '')).length || 0;

      // Get active tasks for quick access
      const activeTasksList = assignments
        ?.filter(a => ['assigned', 'in_progress', 'sms_requested'].includes(a.tasks?.status || ''))
        .slice(0, 3)
        .map(a => ({
          id: a.tasks?.id || '',
          title: a.tasks?.title || '',
          customer_name: a.tasks?.customer_name || '',
          status: a.tasks?.status || '',
          priority: a.tasks?.priority || 'medium',
        })) || [];

      // Fetch unread notifications
      const { count: notificationsCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);

      // Fetch today's time entries
      const today = new Date();
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', startOfDay(today).toISOString())
        .lte('timestamp', endOfDay(today).toISOString())
        .order('timestamp', { ascending: true });

      // Calculate work hours
      let totalMinutes = 0;
      let isCheckedIn = false;
      let lastCheckIn: Date | null = null;

      timeEntries?.forEach((entry) => {
        const entryTime = new Date(entry.timestamp);
        if (entry.entry_type === 'check_in') {
          lastCheckIn = entryTime;
          isCheckedIn = true;
        } else if (entry.entry_type === 'check_out' && lastCheckIn) {
          totalMinutes += differenceInMinutes(entryTime, lastCheckIn);
          lastCheckIn = null;
          isCheckedIn = false;
        }
      });

      // Add current time if still checked in
      if (isCheckedIn && lastCheckIn) {
        totalMinutes += differenceInMinutes(new Date(), lastCheckIn);
      }

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      setStats({
        assignedTasks,
        completedTasks,
        inProgressTasks,
        unreadNotifications: notificationsCount || 0,
        todayWorkHours: hours,
        todayWorkMinutes: minutes,
        isCheckedIn,
      });

      setActiveTasks(activeTasksList);

      // Fetch KYC document status
      const { data: kycDocs } = await supabase
        .from('documents')
        .select('id, file_name, status, review_notes, document_type')
        .eq('user_id', user.id)
        .in('document_type', ['id_card', 'passport']);

      const pendingDocs = kycDocs?.filter(d => d.status === 'pending') || [];
      const rejectedDocs = kycDocs?.filter(d => d.status === 'rejected') || [];

      setKycStatus({
        pendingCount: pendingDocs.length,
        rejectedCount: rejectedDocs.length,
        rejectedDocs: rejectedDocs.map(d => ({
          fileName: d.file_name,
          reviewNotes: d.review_notes
        }))
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const completionRate = stats.assignedTasks > 0 
    ? Math.round((stats.completedTasks / stats.assignedTasks) * 100) 
    : 0;

  const statusColors: Record<string, string> = {
    assigned: 'bg-blue-500',
    in_progress: 'bg-orange-500',
    sms_requested: 'bg-purple-500',
  };

  const statusLabels: Record<string, string> = {
    assigned: 'Zugewiesen',
    in_progress: 'In Bearbeitung',
    sms_requested: 'SMS angefordert',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

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
          <p className="text-muted-foreground">Willkommen zurück! Hier ist deine Übersicht.</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.isCheckedIn ? (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              <Clock className="h-3 w-3 mr-1" />
              Eingestempelt
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              Nicht eingestempelt
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          </span>
        </div>
      </div>

      {/* KYC Status Alerts */}
      {kycStatus.rejectedCount > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            KYC-Dokumente abgelehnt
            <Badge variant="destructive" className="ml-2">{kycStatus.rejectedCount}</Badge>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-2">Folgende Dokumente wurden abgelehnt und müssen erneut hochgeladen werden:</p>
            <ul className="list-disc list-inside space-y-1">
              {kycStatus.rejectedDocs.map((doc, index) => (
                <li key={index} className="text-sm">
                  <span className="font-medium">{doc.fileName}</span>
                  {doc.reviewNotes && <span className="text-muted-foreground"> – {doc.reviewNotes}</span>}
                </li>
              ))}
            </ul>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={() => onNavigate('documents')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Dokumente erneut hochladen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {kycStatus.pendingCount > 0 && kycStatus.rejectedCount === 0 && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <ShieldAlert className="h-4 w-4 text-orange-500" />
          <AlertTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            KYC-Prüfung ausstehend
            <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600">{kycStatus.pendingCount}</Badge>
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Deine Ausweisdokumente werden derzeit geprüft. Dies kann einige Zeit dauern.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('tasks')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Meine Aufträge</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.assignedTasks}</p>
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
                <p className="text-sm font-medium text-muted-foreground">In Bearbeitung</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.inProgressTasks}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Play className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('tasks')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Abgeschlossen</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.completedTasks}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <Progress value={completionRate} className="mt-3 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{completionRate}% erledigt</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('time')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Arbeitszeit heute</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {stats.todayWorkHours}:{stats.todayWorkMinutes.toString().padStart(2, '0')}
                </p>
                <p className="text-xs text-muted-foreground">Stunden</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Active Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schnellaktionen</CardTitle>
            <CardDescription>Häufig verwendete Aktionen</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary/50"
              onClick={() => onNavigate('tasks')}
            >
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                <ClipboardList className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">Meine Aufträge</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 relative hover:border-primary/50"
              onClick={() => onNavigate('notifications')}
            >
              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white">
                <Bell className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">Benachrichtigungen</span>
              {stats.unreadNotifications > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2">
                  {stats.unreadNotifications}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary/50"
              onClick={() => onNavigate('time')}
            >
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">Zeiterfassung</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary/50"
              onClick={() => onNavigate('vacation')}
            >
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">Urlaub</span>
            </Button>
          </CardContent>
        </Card>

        {/* Active Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Aktive Aufträge</CardTitle>
              <CardDescription>Deine aktuellen Aufgaben</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('tasks')}>
              Alle anzeigen
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {activeTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine aktiven Aufträge</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => onNavigate('tasks')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.customer_name}</p>
                      </div>
                      <Badge className={cn("text-xs shrink-0", priorityColors[task.priority])}>
                        {task.priority === 'urgent' ? 'Dringend' : 
                         task.priority === 'high' ? 'Hoch' : 
                         task.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", statusColors[task.status] || 'bg-gray-500')} />
                      <span className="text-xs text-muted-foreground">
                        {statusLabels[task.status] || task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer group"
          onClick={() => onNavigate('documents')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <FileText className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Dokumente</p>
              <p className="text-xs text-muted-foreground">Verträge & Dateien</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer group"
          onClick={() => onNavigate('profile')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
              <User className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Profil</p>
              <p className="text-xs text-muted-foreground">Einstellungen</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}