import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskAssignment, TaskStatus, TaskPriority } from '@/types/panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, User, Phone, Euro, AlertCircle, Play, MessageSquare, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-green-500/20 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  high: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  urgent: 'bg-red-500/20 text-red-700 dark:text-red-400'
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-gray-500/20 text-gray-700 dark:text-gray-400',
  assigned: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  in_progress: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  sms_requested: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-500/20 text-red-700 dark:text-red-400'
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Offen',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  sms_requested: 'SMS angefordert',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert'
};

export default function EmployeeTasksView() {
  const [tasks, setTasks] = useState<(Task & { assignment?: TaskAssignment })[]>([]);
  const [progressNotes, setProgressNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTasks();

      const channel = supabase
        .channel('employee-tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          fetchTasks();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, () => {
          fetchTasks();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    // First get assignments for current user
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('user_id', user.id);

    if (assignments && assignments.length > 0) {
      const taskIds = assignments.map(a => a.task_id);
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .in('id', taskIds)
        .order('deadline', { ascending: true });

      if (tasksData) {
        const enrichedTasks = tasksData.map(task => ({
          ...task as Task,
          assignment: assignments.find(a => a.task_id === task.id) as TaskAssignment | undefined
        }));
        setTasks(enrichedTasks);
      }
    } else {
      setTasks([]);
    }
  };

  const handleStartTask = async (taskId: string) => {
    await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId);
    await supabase.from('task_assignments').update({ accepted_at: new Date().toISOString(), status: 'in_progress' }).eq('task_id', taskId).eq('user_id', user?.id);
    toast({ title: 'Erfolg', description: 'Aufgabe wurde gestartet.' });
    fetchTasks();
  };

  const handleRequestSms = async (taskId: string) => {
    const { error } = await supabase.from('sms_code_requests').insert({
      task_id: taskId,
      user_id: user?.id
    });

    if (error) {
      toast({ title: 'Fehler', description: 'SMS-Anfrage konnte nicht gesendet werden.', variant: 'destructive' });
    } else {
      await supabase.from('tasks').update({ status: 'sms_requested' }).eq('id', taskId);
      toast({ title: 'Erfolg', description: 'SMS-Code wurde angefordert.' });
      fetchTasks();
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    const notes = progressNotes[taskId] || '';
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId);
    await supabase.from('task_assignments').update({ status: 'completed', progress_notes: notes }).eq('task_id', taskId).eq('user_id', user?.id);
    toast({ title: 'Erfolg', description: 'Aufgabe wurde abgeschlossen.' });
    fetchTasks();
  };

  const handleUpdateNotes = async (taskId: string) => {
    const notes = progressNotes[taskId] || '';
    await supabase.from('task_assignments').update({ progress_notes: notes }).eq('task_id', taskId).eq('user_id', user?.id);
    toast({ title: 'Gespeichert', description: 'Notizen wurden aktualisiert.' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Meine Aufgaben</h2>

      {tasks.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine Aufgaben zugewiesen.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.id} className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={priorityColors[task.priority]}>
                        {task.priority === 'low' ? 'Niedrig' : task.priority === 'medium' ? 'Mittel' : task.priority === 'high' ? 'Hoch' : 'Dringend'}
                      </Badge>
                      <Badge className={statusColors[task.status]}>
                        {statusLabels[task.status]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {task.customer_name}
                    </span>
                    {task.customer_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {task.customer_phone}
                      </span>
                    )}
                    {task.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(task.deadline), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </span>
                    )}
                    {task.special_compensation && (
                      <span className="flex items-center gap-1">
                        <Euro className="h-4 w-4" />
                        {task.special_compensation.toFixed(2)} €
                      </span>
                    )}
                  </div>

                  {task.status !== 'completed' && task.status !== 'cancelled' && (
                    <div className="space-y-3 pt-3 border-t">
                      <Textarea
                        placeholder="Fortschritt / Notizen..."
                        value={progressNotes[task.id] || task.assignment?.progress_notes || ''}
                        onChange={(e) => setProgressNotes({ ...progressNotes, [task.id]: e.target.value })}
                        className="min-h-[80px]"
                      />
                      <div className="flex flex-wrap gap-2">
                        {task.status === 'assigned' && (
                          <Button onClick={() => handleStartTask(task.id)} className="gap-2">
                            <Play className="h-4 w-4" />
                            Starten
                          </Button>
                        )}
                        {task.status === 'in_progress' && (
                          <>
                            <Button variant="outline" onClick={() => handleRequestSms(task.id)} className="gap-2">
                              <MessageSquare className="h-4 w-4" />
                              SMS anfordern
                            </Button>
                            <Button onClick={() => handleCompleteTask(task.id)} className="gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Abschließen
                            </Button>
                          </>
                        )}
                        {task.status === 'sms_requested' && (
                          <Button onClick={() => handleCompleteTask(task.id)} className="gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Abschließen
                          </Button>
                        )}
                        <Button variant="secondary" onClick={() => handleUpdateNotes(task.id)}>
                          Notizen speichern
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
