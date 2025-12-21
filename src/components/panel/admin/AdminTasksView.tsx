import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskAssignment, Profile, TaskStatus, TaskPriority } from '@/types/panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Calendar, User, Phone, Euro, AlertCircle, Mail, Key, Activity, MessageCircle, Radio, CheckCircle, Clock, Trash2, ExternalLink, Globe, Eye, Video, FileText, Search, ArrowUpDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { taskCreationSchema, validateWithSchema } from '@/lib/validation';

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/30 !font-bold',
  medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30 !font-bold',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-600/30 dark:text-orange-300 border border-orange-400 dark:border-orange-500/50 !font-bold animate-priority-pulse',
  urgent: 'bg-orange-200 text-orange-900 dark:bg-orange-700/40 dark:text-orange-200 border border-orange-500 dark:border-orange-600/60 !font-bold animate-priority-pulse'
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  assigned: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  in_progress: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  sms_requested: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-destructive/20 text-destructive'
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Offen',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  sms_requested: 'SMS angefordert',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert'
};

export default function AdminTasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<(TaskAssignment & { progress_notes?: string; workflow_step?: number; workflow_digital?: boolean | null })[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'deadline'>('newest');
  const { toast } = useToast();
  const { user } = useAuth();

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    customer_name: '',
    customer_phone: '',
    deadline: '',
    priority: 'medium' as TaskPriority,
    special_compensation: '',
    test_email: '',
    test_password: '',
    web_ident_url: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchEmployees();

    // Realtime subscription for live updates
    const channel = supabase
      .channel('admin-tasks')
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
  }, []);

  const fetchTasks = async () => {
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (tasksData) {
      setTasks(tasksData as Task[]);
    }

    const { data: assignmentsData } = await supabase
      .from('task_assignments')
      .select('*');

    if (assignmentsData) {
      setAssignments(assignmentsData as TaskAssignment[]);
    }
  };

  const fetchEmployees = async () => {
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'employee');

    if (rolesData && rolesData.length > 0) {
      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesData) {
        setEmployees(profilesData as unknown as Profile[]);
      }
    }
  };

  const handleCreateTask = async () => {
    // Use zod schema for comprehensive validation
    const validation = validateWithSchema(taskCreationSchema, {
      title: newTask.title.trim(),
      description: newTask.description?.trim() || null,
      customer_name: newTask.customer_name.trim(),
      customer_phone: newTask.customer_phone?.trim() || null,
      test_email: newTask.test_email?.trim() || null,
      test_password: newTask.test_password || null,
      deadline: newTask.deadline || null,
      priority: newTask.priority,
      special_compensation: newTask.special_compensation ? parseFloat(newTask.special_compensation) : null,
      notes: null
    });

    if (!validation.success) {
      toast({ title: 'Fehler', description: (validation as { success: false; error: string }).error, variant: 'destructive' });
      return;
    }

    const webIdentUrl = newTask.web_ident_url?.trim() || null;
    
    const { error } = await supabase.from('tasks').insert({
      title: validation.data.title,
      description: validation.data.description,
      customer_name: validation.data.customer_name,
      customer_phone: validation.data.customer_phone,
      deadline: validation.data.deadline,
      priority: validation.data.priority,
      special_compensation: validation.data.special_compensation,
      test_email: validation.data.test_email,
      test_password: validation.data.test_password,
      web_ident_url: webIdentUrl,
      created_by: user?.id
    });

    if (error) {
      toast({ title: 'Fehler', description: 'Auftrag konnte nicht erstellt werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Auftrag wurde erstellt.' });
      setIsDialogOpen(false);
      setNewTask({ title: '', description: '', customer_name: '', customer_phone: '', deadline: '', priority: 'medium', special_compensation: '', test_email: '', test_password: '', web_ident_url: '' });
      fetchTasks();
    }
  };

  const handleAssignTask = async () => {
    if (!selectedTask || !selectedEmployee) {
      toast({ title: 'Fehler', description: 'Bitte Mitarbeiter auswählen.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('task_assignments').insert({
      task_id: selectedTask.id,
      user_id: selectedEmployee
    });

    if (error) {
      toast({ title: 'Fehler', description: 'Zuweisung fehlgeschlagen.', variant: 'destructive' });
    } else {
      await supabase.from('tasks').update({ status: 'assigned' }).eq('id', selectedTask.id);
      toast({ title: 'Erfolg', description: 'Auftrag wurde zugewiesen.' });
      setIsAssignDialogOpen(false);
      setSelectedTask(null);
      setSelectedEmployee('');
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    // Use the secure server-side function
    const { error } = await supabase.rpc('delete_task', { _task_id: taskId });
    
    if (error) {
      toast({ title: 'Fehler', description: 'Auftrag konnte nicht gelöscht werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Auftrag wurde gelöscht.' });
      fetchTasks();
    }
  };

  const getTaskAssignee = (taskId: string) => {
    const assignment = assignments.find(a => a.task_id === taskId);
    if (!assignment) return null;
    return employees.find(e => e.user_id === assignment.user_id);
  };

  const getTaskAssignment = (taskId: string) => {
    return assignments.find(a => a.task_id === taskId);
  };

  const getFilteredTasks = () => {
    let filtered = tasks;
    
    // Status filter
    switch (statusFilter) {
      case 'open':
        filtered = filtered.filter(t => t.status === 'pending' || t.status === 'assigned');
        break;
      case 'in_progress':
        filtered = filtered.filter(t => t.status === 'in_progress' || t.status === 'sms_requested');
        break;
      case 'completed':
        filtered = filtered.filter(t => t.status === 'completed' || t.status === 'cancelled');
        break;
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.customer_name.toLowerCase().includes(query) ||
        t.customer_phone?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'oldest':
        filtered = [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'priority':
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        filtered = [...filtered].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        break;
      case 'deadline':
        filtered = [...filtered].sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
        break;
      default: // newest
        filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return filtered;
  };

  const openCount = tasks.filter(t => t.status === 'pending' || t.status === 'assigned').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress' || t.status === 'sms_requested').length;
  const completedCount = tasks.filter(t => t.status === 'completed' || t.status === 'cancelled').length;
  const filteredTasks = getFilteredTasks();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Aufträge verwalten</h2>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/30">
            <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Live</span>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Neuer Auftrag
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Neuen Auftrag erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titel *</Label>
                <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Auftragstitel" />
              </div>
              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Textarea 
                  value={newTask.description} 
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} 
                  placeholder="Auftragsdetails..." 
                  className="min-h-[120px] whitespace-pre-wrap"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kundenname *</Label>
                  <Input value={newTask.customer_name} onChange={(e) => setNewTask({ ...newTask, customer_name: e.target.value })} placeholder="Max Mustermann" />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={newTask.customer_phone} onChange={(e) => setNewTask({ ...newTask, customer_phone: e.target.value })} placeholder="+49 123 456789" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="datetime-local" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Priorität</Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as TaskPriority })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                      <SelectItem value="urgent">Dringend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sondervergütung (€)</Label>
                <Input type="number" step="0.01" value={newTask.special_compensation} onChange={(e) => setNewTask({ ...newTask, special_compensation: e.target.value })} placeholder="0.00" />
              </div>
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-3 text-muted-foreground">Test-Zugangsdaten (Optional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Test E-Mail</Label>
                    <Input type="email" value={newTask.test_email} onChange={(e) => setNewTask({ ...newTask, test_email: e.target.value })} placeholder="test@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Test Passwort</Label>
                    <Input type="text" value={newTask.test_password} onChange={(e) => setNewTask({ ...newTask, test_password: e.target.value })} placeholder="Passwort123" />
                  </div>
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Web-Ident (Optional)
                </p>
                <div className="space-y-2">
                  <Label>Web-Ident Link</Label>
                  <Input 
                    type="url" 
                    value={newTask.web_ident_url} 
                    onChange={(e) => setNewTask({ ...newTask, web_ident_url: e.target.value })} 
                    placeholder="https://webident.example.com/verify/..." 
                  />
                  <p className="text-xs text-muted-foreground">Link zur Web-Ident-Verifizierung, falls erforderlich</p>
                </div>
              </div>
              <Button onClick={handleCreateTask} className="w-full">Auftrag erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Aufträge durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-full sm:w-48">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sortieren" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Neueste zuerst</SelectItem>
            <SelectItem value="oldest">Älteste zuerst</SelectItem>
            <SelectItem value="priority">Nach Priorität</SelectItem>
            <SelectItem value="deadline">Nach Deadline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="all" className="gap-2 py-2">
            Alle
            <Badge variant="secondary" className="ml-1">{tasks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="open" className="gap-2 py-2">
            <Clock className="h-4 w-4" />
            Offen
            <Badge variant="secondary" className="ml-1 bg-muted">{openCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-2 py-2">
            <Activity className="h-4 w-4" />
            In Bearbeitung
            <Badge variant="secondary" className="ml-1 bg-blue-500/20 text-blue-700 dark:text-blue-400">{inProgressCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2 py-2">
            <CheckCircle className="h-4 w-4" />
            Abgeschlossen
            <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-700 dark:text-green-400">{completedCount}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {filteredTasks.length} Ergebnis{filteredTasks.length !== 1 ? 'se' : ''} gefunden
        </p>
      )}

      <div className="grid gap-3">
        {filteredTasks.map((task) => {
          const assignee = getTaskAssignee(task.id);
          const assignment = getTaskAssignment(task.id);
          const isHighPriority = task.priority === 'high' || task.priority === 'urgent';
          return (
            <Card key={task.id} className={`overflow-hidden transition-all hover:shadow-md ${isHighPriority ? 'ring-1 ring-red-500/30' : ''}`}>
              <div className="flex items-stretch">
                {/* Priority indicator bar */}
                <div className={`w-1 flex-shrink-0 ${
                  task.priority === 'urgent' ? 'bg-red-500' :
                  task.priority === 'high' ? 'bg-red-400' :
                  task.priority === 'medium' ? 'bg-yellow-500' : 'bg-muted'
                }`} />
                
                <div className="flex-1 p-4">
                  {/* Header row: Title + Badges + Actions */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base truncate">{task.title}</h3>
                        <Badge className={`${priorityColors[task.priority]} text-xs`}>
                          {task.priority === 'low' ? 'Niedrig' : task.priority === 'medium' ? 'Mittel' : task.priority === 'high' ? 'Hoch' : 'Dringend'}
                        </Badge>
                        <Badge className={`${statusColors[task.status]} text-xs`}>
                          {statusLabels[task.status]}
                        </Badge>
                        {task.special_compensation && (
                          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
                            +{task.special_compensation.toFixed(0)}€
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setDetailTask(task)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!assignee && task.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setSelectedTask(task);
                            setIsAssignDialogOpen(true);
                          }}
                        >
                          Zuweisen
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Auftrag löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Der Auftrag "{task.title}" wird dauerhaft gelöscht.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTask(task.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  {/* Info row: Customer, Phone, Deadline, Assignee */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {task.customer_name}
                    </span>
                    {task.customer_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {task.customer_phone}
                      </span>
                    )}
                    {task.deadline && !isNaN(new Date(task.deadline).getTime()) && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(task.deadline), 'dd.MM. HH:mm', { locale: de })}
                      </span>
                    )}
                    {assignee && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <User className="h-3.5 w-3.5" />
                        {assignee.first_name} {assignee.last_name}
                      </span>
                    )}
                    {task.web_ident_url && (
                      <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                        <Globe className="h-3.5 w-3.5" />
                        Web-Ident
                      </span>
                    )}
                    {(task.test_email || task.test_password) && (
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Key className="h-3.5 w-3.5" />
                        Test-Daten
                      </span>
                    )}
                  </div>
                  
                  {/* Expandable details - only show if there's content */}
                  {(task.description || assignment?.progress_notes) && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-sm">
                      {task.description && (
                        <p className="text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      {assignment?.progress_notes && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                          <span className="font-medium text-muted-foreground">Notiz: </span>
                          {assignment.progress_notes}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Status request button for in-progress tasks */}
                  {assignee && (task.status === 'in_progress' || task.status === 'sms_requested') && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={async () => {
                          const { error } = await supabase.from('notifications').insert({
                            user_id: assignment!.user_id,
                            title: 'Statusanfrage',
                            message: `Bitte schreibe eine kurze Notiz zum aktuellen Fortschritt des Auftrags "${task.title}".`,
                            type: 'status_request',
                            related_task_id: task.id
                          });
                          if (error) {
                            toast({ title: 'Fehler', description: 'Statusanfrage fehlgeschlagen.', variant: 'destructive' });
                          } else {
                            toast({ title: 'Status angefordert', description: `Anfrage an ${assignee.first_name} gesendet.` });
                          }
                        }}
                      >
                        <MessageCircle className="h-3 w-3" />
                        Status anfragen
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {filteredTasks.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                {statusFilter === 'all' 
                  ? 'Keine Aufträge vorhanden.' 
                  : statusFilter === 'open' 
                    ? 'Keine offenen Aufträge.' 
                    : statusFilter === 'in_progress' 
                      ? 'Keine Aufträge in Bearbeitung.' 
                      : 'Keine abgeschlossenen Aufträge.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auftrag zuweisen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Auftrag: <strong>{selectedTask?.title}</strong>
            </p>
            <div className="space-y-2">
              <Label>Mitarbeiter auswählen</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Mitarbeiter wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssignTask} className="w-full">Zuweisen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailTask && (() => {
            const assignee = getTaskAssignee(detailTask.id);
            const assignment = getTaskAssignment(detailTask.id);
            const workflowStep = assignment?.workflow_step ?? 1;
            const workflowDigital = assignment?.workflow_digital;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    {detailTask.title}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Status & Priority */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={priorityColors[detailTask.priority]}>
                      {detailTask.priority === 'low' ? 'Niedrig' : detailTask.priority === 'medium' ? 'Mittel' : detailTask.priority === 'high' ? 'Hoch' : 'Dringend'}
                    </Badge>
                    <Badge className={statusColors[detailTask.status]}>
                      {statusLabels[detailTask.status]}
                    </Badge>
                    {detailTask.special_compensation && (
                      <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                        <Euro className="h-3 w-3 mr-1" />
                        {detailTask.special_compensation.toFixed(2)} €
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {detailTask.description && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{detailTask.description}</p>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Kundenname</Label>
                      <p className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {detailTask.customer_name}
                      </p>
                    </div>
                    {detailTask.customer_phone && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Telefon</Label>
                        <p className="font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {detailTask.customer_phone}
                        </p>
                      </div>
                    )}
                    {detailTask.deadline && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Deadline</Label>
                        <p className="font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <Clock className="h-4 w-4" />
                          {format(new Date(detailTask.deadline), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Test Credentials */}
                  {(detailTask.test_email || detailTask.test_password) && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs font-semibold mb-3 text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Test-Zugangsdaten
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {detailTask.test_email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-blue-600" />
                            <span className="font-mono">{detailTask.test_email}</span>
                          </div>
                        )}
                        {detailTask.test_password && (
                          <div className="flex items-center gap-2 text-sm">
                            <Key className="h-4 w-4 text-blue-600" />
                            <span className="font-mono">{detailTask.test_password}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Web-Ident URL */}
                  {detailTask.web_ident_url && (
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <p className="text-xs font-semibold mb-2 text-cyan-700 dark:text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Web-Ident Link
                      </p>
                      <a 
                        href={detailTask.web_ident_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {detailTask.web_ident_url}
                      </a>
                    </div>
                  )}

                  {/* Assignee & Workflow Status */}
                  {assignee && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-emerald-700 dark:text-emerald-400">
                            {assignee.first_name} {assignee.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{assignee.email}</p>
                        </div>
                      </div>

                      {/* Workflow Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Workflow-Fortschritt</span>
                          <span className="font-medium">Schritt {workflowStep} / 8</span>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
                            <div
                              key={step}
                              className={`flex-1 h-2 rounded-full ${
                                step < workflowStep ? 'bg-emerald-500' : step === workflowStep ? 'bg-emerald-500/60' : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Video Chat Decision */}
                      <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                        <Video className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Video-Chat</p>
                          <p className="text-xs text-muted-foreground">
                            {workflowDigital === true
                              ? '✅ Akzeptiert'
                              : workflowDigital === false
                                ? '❌ Abgelehnt'
                                : '⏳ Noch nicht entschieden'}
                          </p>
                        </div>
                      </div>

                      {/* Progress Notes */}
                      {assignment?.progress_notes && (
                        <div className="p-3 bg-background/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Mitarbeiter-Notizen
                          </p>
                          <p className="text-sm">{assignment.progress_notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDetailTask(null)}>
                    Schließen
                  </Button>
                  {!assignee && detailTask.status === 'pending' && (
                    <Button onClick={() => {
                      setSelectedTask(detailTask);
                      setDetailTask(null);
                      setIsAssignDialogOpen(true);
                    }}>
                      Zuweisen
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
