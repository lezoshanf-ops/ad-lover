import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, TimeEntry, TaskAssignment, Task, TaskStatus } from '@/types/panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Users, ClipboardList, Clock, TrendingUp, Activity, Timer, Award, Target, Zap } from 'lucide-react';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';
import { de } from 'date-fns/locale';

interface EmployeeStats {
  profile: Profile;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todayHours: number;
  avgCompletionTimeMinutes: number;
  completionRate: number;
}

interface TaskWithAssignee extends Task {
  assignee?: Profile;
  completionTime?: number;
}

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-status-pending/20 text-amber-700 dark:text-amber-400',
  assigned: 'bg-status-assigned/20 text-sky-700 dark:text-sky-400',
  in_progress: 'bg-status-in-progress/20 text-violet-700 dark:text-violet-400',
  sms_requested: 'bg-status-sms-requested/20 text-purple-700 dark:text-purple-400',
  pending_review: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  completed: 'bg-status-completed/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-status-cancelled/20 text-muted-foreground'
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Offen',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  sms_requested: 'SMS angefordert',
  pending_review: 'In Überprüfung',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert'
};

export default function AdminStatsView() {
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<TaskWithAssignee[]>([]);
  const [recentCompletedTasks, setRecentCompletedTasks] = useState<TaskWithAssignee[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    totalEmployees: 0,
    avgCompletionTime: 0,
    todayCompletedTasks: 0
  });

  useEffect(() => {
    fetchStats();

    // Realtime subscription
    const channel = supabase
      .channel('stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    // Fetch all tasks
    const { data: tasks } = await supabase.from('tasks').select('*');
    
    // Fetch employee profiles
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'employee');
    
    // Fetch assignments with accepted_at for time calculations
    const { data: assignments } = await supabase.from('task_assignments').select('*');
    
    // Fetch all profiles for assignee lookup
    const { data: allProfiles } = await supabase.from('profiles').select('*');
    
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const profiles = allProfiles?.filter(p => userIds.includes(p.user_id)) || [];
      
      // Fetch today's time entries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('*')
        .gte('timestamp', today.toISOString());

      if (profiles) {
        const stats: EmployeeStats[] = profiles.map(profile => {
          const userAssignments = assignments?.filter(a => a.user_id === profile.user_id) || [];
          const userTaskIds = userAssignments.map(a => a.task_id);
          const userTasks = tasks?.filter(t => userTaskIds.includes(t.id)) || [];
          
          // Calculate average completion time
          let totalCompletionMinutes = 0;
          let completedWithTimeCount = 0;
          
          userTasks.filter(t => t.status === 'completed').forEach(task => {
            const assignment = userAssignments.find(a => a.task_id === task.id);
            if (assignment?.accepted_at && task.updated_at) {
              const minutes = differenceInMinutes(new Date(task.updated_at), new Date(assignment.accepted_at));
              if (minutes > 0 && minutes < 10000) { // Sanity check
                totalCompletionMinutes += minutes;
                completedWithTimeCount++;
              }
            }
          });
          
          const avgCompletionTimeMinutes = completedWithTimeCount > 0 
            ? Math.round(totalCompletionMinutes / completedWithTimeCount) 
            : 0;
          
          // Calculate today's hours
          const userTimeEntries = timeEntries?.filter(e => e.user_id === profile.user_id) || [];
          let todayHours = 0;
          
          const checkIns = userTimeEntries.filter(e => e.entry_type === 'check_in');
          const checkOuts = userTimeEntries.filter(e => e.entry_type === 'check_out');
          
          checkIns.forEach((checkIn, idx) => {
            const checkOut = checkOuts[idx];
            if (checkOut) {
              const diff = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
              todayHours += diff / (1000 * 60 * 60);
            }
          });

          const completedTasks = userTasks.filter(t => t.status === 'completed').length;
          const completionRate = userTasks.length > 0 
            ? Math.round((completedTasks / userTasks.length) * 100) 
            : 0;

          return {
            profile: profile as Profile,
            totalTasks: userTasks.length,
            completedTasks,
            inProgressTasks: userTasks.filter(t => t.status === 'in_progress' || t.status === 'sms_requested').length,
            todayHours: Math.round(todayHours * 10) / 10,
            avgCompletionTimeMinutes,
            completionRate
          };
        });

        // Sort by completed tasks descending
        stats.sort((a, b) => b.completedTasks - a.completedTasks);
        setEmployeeStats(stats);
      }
    }

    // Set in-progress tasks with assignees
    if (tasks && assignments && allProfiles) {
      const activeTasksWithAssignee: TaskWithAssignee[] = tasks
        .filter(t => t.status === 'in_progress' || t.status === 'sms_requested')
        .map(task => {
          const assignment = assignments.find(a => a.task_id === task.id);
          const assignee = assignment 
            ? allProfiles.find(p => p.user_id === assignment.user_id) as Profile | undefined
            : undefined;
          return { ...task as Task, assignee };
        });
      setInProgressTasks(activeTasksWithAssignee);

      // Get recently completed tasks with completion time
      const completedTasksWithTime: TaskWithAssignee[] = tasks
        .filter(t => t.status === 'completed')
        .slice(0, 10)
        .map(task => {
          const assignment = assignments.find(a => a.task_id === task.id);
          const assignee = assignment 
            ? allProfiles.find(p => p.user_id === assignment.user_id) as Profile | undefined
            : undefined;
          
          let completionTime = 0;
          if (assignment?.accepted_at && task.updated_at) {
            completionTime = differenceInMinutes(new Date(task.updated_at), new Date(assignment.accepted_at));
          }
          
          return { ...task as Task, assignee, completionTime };
        });
      setRecentCompletedTasks(completedTasksWithTime);
    }

    // Calculate global average completion time
    let globalTotalMinutes = 0;
    let globalCount = 0;
    
    if (tasks && assignments) {
      tasks.filter(t => t.status === 'completed').forEach(task => {
        const assignment = assignments.find(a => a.task_id === task.id);
        if (assignment?.accepted_at && task.updated_at) {
          const minutes = differenceInMinutes(new Date(task.updated_at), new Date(assignment.accepted_at));
          if (minutes > 0 && minutes < 10000) {
            globalTotalMinutes += minutes;
            globalCount++;
          }
        }
      });
    }

    // Count today's completed tasks
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCompleted = tasks?.filter(t => 
      t.status === 'completed' && 
      new Date(t.updated_at) >= todayStart
    ).length || 0;

    // Set total stats
    if (tasks) {
      setTotalStats({
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        activeTasks: tasks.filter(t => ['assigned', 'in_progress', 'sms_requested'].includes(t.status)).length,
        totalEmployees: roles?.length || 0,
        avgCompletionTime: globalCount > 0 ? Math.round(globalTotalMinutes / globalCount) : 0,
        todayCompletedTasks: todayCompleted
      });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Statistiken & Übersicht</h2>
        <p className="text-muted-foreground">Detaillierte Mitarbeiter-Performance und Bearbeitungszeiten</p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.totalTasks}</p>
                <p className="text-xs text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.completedTasks}</p>
                <p className="text-xs text-muted-foreground">Erledigt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.activeTasks}</p>
                <p className="text-xs text-muted-foreground">Aktiv</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.totalEmployees}</p>
                <p className="text-xs text-muted-foreground">Mitarbeiter</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Timer className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(totalStats.avgCompletionTime)}</p>
                <p className="text-xs text-muted-foreground">Ø Bearbeitung</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.todayCompletedTasks}</p>
                <p className="text-xs text-muted-foreground">Heute erledigt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Performance Leaderboard */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Mitarbeiter-Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employeeStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Keine Mitarbeiter vorhanden.</p>
          ) : (
            <div className="space-y-4">
              {employeeStats.map((stat, index) => (
                <div key={stat.profile.id} className="p-4 rounded-xl bg-muted/30 border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-amber-500/20 text-amber-600' :
                      index === 1 ? 'bg-slate-400/20 text-slate-500' :
                      index === 2 ? 'bg-orange-600/20 text-orange-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        {stat.profile.first_name[0]}{stat.profile.last_name[0]}
                      </span>
                    </div>

                    {/* Name and stats */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{stat.profile.first_name} {stat.profile.last_name}</span>
                        {index === 0 && <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Top Performer</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Target className="h-3.5 w-3.5" />
                          {stat.totalTasks} Aufträge
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5" />
                          Ø {formatDuration(stat.avgCompletionTimeMinutes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {stat.todayHours}h heute
                        </span>
                      </div>
                    </div>

                    {/* Progress bars */}
                    <div className="w-48 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Abschlussrate</span>
                        <span className="font-medium">{stat.completionRate}%</span>
                      </div>
                      <Progress value={stat.completionRate} className="h-2" />
                    </div>

                    {/* Completion stats */}
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-green-600">{stat.completedTasks}</p>
                        <p className="text-xs text-muted-foreground">Erledigt</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-blue-600">{stat.inProgressTasks}</p>
                        <p className="text-xs text-muted-foreground">Aktiv</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Completed Tasks with Time */}
      {recentCompletedTasks.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-green-500" />
              Zuletzt abgeschlossene Aufträge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Auftrag</th>
                    <th className="text-left py-3 px-4 font-medium">Bearbeiter</th>
                    <th className="text-center py-3 px-4 font-medium">Bearbeitungszeit</th>
                    <th className="text-right py-3 px-4 font-medium">Abgeschlossen</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCompletedTasks.map((task) => (
                    <tr key={task.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">{task.customer_name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {task.assignee.first_name[0]}{task.assignee.last_name[0]}
                              </span>
                            </div>
                            <span className="text-sm">{task.assignee.first_name} {task.assignee.last_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                          {task.completionTime ? formatDuration(task.completionTime) : '-'}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-muted-foreground">
                        {format(new Date(task.updated_at), 'dd.MM.yy HH:mm', { locale: de })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* In Progress Tasks Section */}
      {inProgressTasks.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Aufträge in Bearbeitung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Auftrag</th>
                    <th className="text-left py-3 px-4 font-medium">Kunde</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Bearbeiter</th>
                  </tr>
                </thead>
                <tbody>
                  {inProgressTasks.map((task) => (
                    <tr key={task.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{task.title}</td>
                      <td className="py-3 px-4 text-muted-foreground">{task.customer_name}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={statusColors[task.status]}>
                          {statusLabels[task.status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {task.assignee.first_name[0]}{task.assignee.last_name[0]}
                              </span>
                            </div>
                            <span className="text-sm">{task.assignee.first_name} {task.assignee.last_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Nicht zugewiesen</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
