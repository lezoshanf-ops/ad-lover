import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskAssignment, TaskStatus, TaskPriority, Profile, SmsCodeRequest } from '@/types/panel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTabContext } from '@/components/panel/EmployeeDashboard';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';
import WorkflowStepCard from './WorkflowStepCard';

import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, User, Euro, AlertCircle, MessageSquare, CheckCircle2, 
  FileUp, Mail, Key, UserCheck, Clock, Trophy, PartyPopper, Eye, EyeOff, RefreshCw, Globe, ExternalLink, X, Maximize2, Search, RefreshCcw, FileText, ArrowRight, ChevronDown, Video, Phone, Sparkles, Loader2, Info, Copy, Check
} from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { de } from 'date-fns/locale';

// SMS Code Display Component
function SmsCodeDisplay({ 
  smsCode,
  onResendCode,
  isResending
}: { 
  smsCode: string;
  onResendCode: () => void;
  isResending: boolean;
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(smsCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
      <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">
        Demo-Daten (SMS)
      </p>
      {!isRevealed ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setIsRevealed(true)}
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Eye className="h-4 w-4" />
            Code anzeigen
          </Button>
          <Button
            onClick={onResendCode}
            variant="outline"
            disabled={isResending}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
            Neuen Code anfordern
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-3xl font-mono font-bold text-primary tracking-widest">
              {smsCode}
            </p>
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-primary hover:bg-primary/10"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Kopiert
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Kopieren
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setIsRevealed(false)}
              variant="ghost"
              size="sm"
              className="gap-2 text-primary hover:bg-primary/10"
            >
              <EyeOff className="h-4 w-4" />
              Ausblenden
            </Button>
            <Button
              onClick={onResendCode}
              variant="ghost"
              size="sm"
              disabled={isResending}
              className="gap-2 text-primary hover:bg-primary/10"
            >
              <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
              Neuen Code anfordern
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const priorityConfig: Record<TaskPriority, { color: string; label: string; icon: string }> = {
  low: { color: 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/30', label: 'Niedrig', icon: '○' },
  medium: { color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30', label: 'Mittel', icon: '◐' },
  high: { color: 'bg-accent-red-light text-accent-red dark:bg-accent-red/20 dark:text-accent-red-muted border border-accent-red/30', label: 'Hoch', icon: '●' },
  urgent: { color: 'bg-accent-red/10 text-accent-red dark:bg-accent-red/30 dark:text-accent-red border border-accent-red/50 animate-priority-pulse', label: 'Dringend', icon: '⬤' }
};

const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  pending: { color: 'bg-status-pending/20 text-amber-700 dark:text-amber-400 border border-status-pending/30', label: 'Ausstehend' },
  assigned: { color: 'bg-status-assigned/20 text-sky-700 dark:text-sky-400 border border-status-assigned/30', label: 'Zugewiesen' },
  in_progress: { color: 'bg-status-in-progress/20 text-violet-700 dark:text-violet-400 border border-status-in-progress/30', label: 'In Bearbeitung' },
  sms_requested: { color: 'bg-status-sms-requested/20 text-purple-700 dark:text-purple-400 border border-status-sms-requested/30', label: 'SMS angefordert' },
  pending_review: { color: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30', label: 'In Überprüfung' },
  completed: { color: 'bg-status-completed/20 text-green-700 dark:text-green-400 border border-status-completed/30', label: 'Abgeschlossen' },
  cancelled: { color: 'bg-status-cancelled/20 text-muted-foreground border border-status-cancelled/30', label: 'Storniert' }
};

interface StatusRequest {
  id: string;
  related_task_id: string | null;
  read_at: string | null;
}

interface TaskWithDetails extends Task {
  assignment?: TaskAssignment;
  assignedBy?: Profile;
  smsRequest?: SmsCodeRequest;
}

export default function EmployeeTasksView() {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [taskDocuments, setTaskDocuments] = useState<Record<string, number>>({});
  const [taskEvaluations, setTaskEvaluations] = useState<Record<string, boolean>>({});
  const [progressNotes, setProgressNotes] = useState<Record<string, string>>({});
  const [stepNotes, setStepNotes] = useState<Record<string, Record<string, string>>>({});
  const [statusRequests, setStatusRequests] = useState<StatusRequest[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [dialogViewMode, setDialogViewMode] = useState<'details' | 'workflow'>('details');
  const [completionDialog, setCompletionDialog] = useState<{
    open: boolean;
    task: TaskWithDetails | null;
    duration: string;
  }>({ open: false, task: null, duration: '' });
  const [resendingCode, setResendingCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [webIdentDialog, setWebIdentDialog] = useState<{ open: boolean; url: string; taskTitle: string; taskId: string }>({ open: false, url: '', taskTitle: '', taskId: '' });
  const [videoChatDialog, setVideoChatDialog] = useState<{ open: boolean; task: TaskWithDetails | null }>({ open: false, task: null });
const [savingStepNote, setSavingStepNote] = useState<string | null>(null);
  const [videoChatConfirmed, setVideoChatConfirmed] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(30);
  const [showSmsReceivedAnimation, setShowSmsReceivedAnimation] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const tabContext = useTabContext();
  const { playNotificationSound } = useNotificationSound();
  const { permission, requestPermission, showNotification } = usePushNotifications();
  
  const initialLoadComplete = useRef(false);
  const realtimeSubscribed = useRef(false);
  const pollingIntervalId = useRef<number | null>(null);
  const pollingTimeoutId = useRef<number | null>(null);
  const smsPollingIntervalId = useRef<number | null>(null);
  const smsCountdownIntervalId = useRef<number | null>(null);
  const previousSmsCodesRef = useRef<Record<string, string | null>>({});
  const workflowContentRef = useRef<HTMLDivElement | null>(null);

  const handleCopySmsCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({ title: 'Kopiert!', description: 'SMS-Code in die Zwischenablage kopiert.' });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({ title: 'Fehler', description: 'Kopieren fehlgeschlagen.', variant: 'destructive' });
    }
  };
  useEffect(() => {
    if (permission === 'default') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!user) return;

    const syncNow = () => {
      fetchTasks();
      fetchStatusRequests();
      checkTimeStatus();
    };

    const onVisibility = () => {
      if (!document.hidden) syncNow();
    };

    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', syncNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  const checkTimeStatus = async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('time_entries')
      .select('entry_type')
      .eq('user_id', user.id)
      .gte('timestamp', today.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastEntry = data[0].entry_type;
      setIsCheckedIn(lastEntry === 'check_in' || lastEntry === 'pause_end');
    } else {
      setIsCheckedIn(false);
    }
  };

  const notifyNewTask = useCallback((taskTitle?: string) => {
    playNotificationSound();
    showNotification('🆕 Neuer Auftrag!', {
      body: taskTitle ? `Neuer Auftrag: ${taskTitle}` : 'Dir wurde ein neuer Auftrag zugewiesen.',
      tag: 'new-task',
    });
    toast({
      title: '🆕 Neuer Auftrag!',
      description: taskTitle ? `"${taskTitle}" wurde dir zugewiesen.` : 'Dir wurde ein neuer Auftrag zugewiesen.',
    });
  }, [playNotificationSound, showNotification, toast]);

  const notifySmsCode = useCallback(() => {
    playNotificationSound();
    showNotification('📱 SMS-Code erhalten!', {
      body: 'Der Admin hat dir den SMS-Code weitergeleitet.',
      tag: 'sms-code',
    });
    toast({
      title: '📱 SMS-Code erhalten!',
      description: 'Der Admin hat dir den SMS-Code weitergeleitet.',
    });
  }, [playNotificationSound, showNotification, toast]);

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchStatusRequests();
      checkTimeStatus();

      realtimeSubscribed.current = false;
      if (pollingIntervalId.current) {
        window.clearInterval(pollingIntervalId.current);
        pollingIntervalId.current = null;
      }
      if (pollingTimeoutId.current) {
        window.clearTimeout(pollingTimeoutId.current);
        pollingTimeoutId.current = null;
      }

      const startPollingFallback = () => {
        if (pollingIntervalId.current) return;
        pollingIntervalId.current = window.setInterval(() => {
          fetchTasks();
          fetchStatusRequests();
        }, 1500);
      };

      pollingTimeoutId.current = window.setTimeout(() => {
        if (!realtimeSubscribed.current) startPollingFallback();
      }, 5000);

      const channel = supabase
        .channel(`employee-tasks-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_assignments' }, (payload) => {
          const newData = payload.new as Record<string, unknown> | null;
          if (newData?.user_id === user.id && initialLoadComplete.current) {
            supabase
              .from('tasks')
              .select('title')
              .eq('id', newData.task_id as string)
              .single()
              .then(({ data: taskData }) => {
                notifyNewTask(taskData?.title);
              });
            fetchTasks();
          } else if (newData?.user_id === user.id) {
            fetchTasks();
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_assignments' }, (payload) => {
          const newData = payload.new as Record<string, unknown> | null;
          const oldData = payload.old as Record<string, unknown> | null;
          if (newData?.user_id === user.id || oldData?.user_id === user.id) {
            fetchTasks();
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_assignments' }, (payload) => {
          const oldData = payload.old as Record<string, unknown> | null;
          if (oldData?.user_id === user.id) {
            fetchTasks();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_code_requests' }, (payload) => {
          const newData = payload.new as Record<string, unknown> | null;
          const oldData = payload.old as Record<string, unknown> | null;
          if (newData?.user_id === user.id || oldData?.user_id === user.id) {
            if (payload.eventType === 'UPDATE' && newData?.sms_code && !oldData?.sms_code && initialLoadComplete.current) {
              notifySmsCode();
            }
            fetchTasks();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          fetchTasks();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
          const newData = payload.new as Record<string, unknown> | null;
          const oldData = payload.old as Record<string, unknown> | null;
          if (newData?.user_id === user.id || oldData?.user_id === user.id) {
            fetchStatusRequests();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, (payload) => {
          const newData = payload.new as Record<string, unknown> | null;
          const oldData = payload.old as Record<string, unknown> | null;
          if (newData?.user_id === user.id || oldData?.user_id === user.id) {
            checkTimeStatus();
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            realtimeSubscribed.current = true;
            if (pollingIntervalId.current) {
              window.clearInterval(pollingIntervalId.current);
              pollingIntervalId.current = null;
            }
            setTimeout(() => {
              initialLoadComplete.current = true;
            }, 1000);
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            startPollingFallback();
          }
        });

      return () => {
        if (pollingIntervalId.current) {
          window.clearInterval(pollingIntervalId.current);
          pollingIntervalId.current = null;
        }
        if (pollingTimeoutId.current) {
          window.clearTimeout(pollingTimeoutId.current);
          pollingTimeoutId.current = null;
        }
        supabase.removeChannel(channel);
      };
    }
  }, [user, notifyNewTask, notifySmsCode]);

  // SMS polling for step 4 - refresh every 30 seconds when waiting for SMS code
  useEffect(() => {
    // Check if any task is waiting for SMS code (step 4, requested but no code yet)
    const taskWaitingForSms = tasks.find(task => {
      const step = task.assignment?.workflow_step || 1;
      return step === 4 && task.smsRequest && !task.smsRequest.sms_code;
    });

    if (taskWaitingForSms) {
      // Start 30-second polling
      setSmsCountdown(30);
      smsPollingIntervalId.current = window.setInterval(() => {
        fetchTasks();
        setSmsCountdown(30); // Reset countdown after fetch
      }, 30000);
      
      // Countdown timer
      smsCountdownIntervalId.current = window.setInterval(() => {
        setSmsCountdown(prev => (prev > 0 ? prev - 1 : 30));
      }, 1000);
    } else {
      // Clear polling when not needed
      if (smsPollingIntervalId.current) {
        window.clearInterval(smsPollingIntervalId.current);
        smsPollingIntervalId.current = null;
      }
      if (smsCountdownIntervalId.current) {
        window.clearInterval(smsCountdownIntervalId.current);
        smsCountdownIntervalId.current = null;
      }
    }

    return () => {
      if (smsPollingIntervalId.current) {
        window.clearInterval(smsPollingIntervalId.current);
        smsPollingIntervalId.current = null;
      }
      if (smsCountdownIntervalId.current) {
        window.clearInterval(smsCountdownIntervalId.current);
        smsCountdownIntervalId.current = null;
      }
    };
  }, [tasks]);

  // Detect when SMS code is received and show visual confirmation
  useEffect(() => {
    tasks.forEach(task => {
      const previousCode = previousSmsCodesRef.current[task.id];
      const currentCode = task.smsRequest?.sms_code;
      
      // If code just appeared (was null/undefined, now has value)
      if (!previousCode && currentCode && initialLoadComplete.current) {
        setShowSmsReceivedAnimation(task.id);
        playNotificationSound();
        
        // Clear animation after 3 seconds
        setTimeout(() => {
          setShowSmsReceivedAnimation(null);
        }, 3000);
      }
      
      // Update ref
      previousSmsCodesRef.current[task.id] = currentCode || null;
    });
    
    // Update selectedTask when tasks change (for real-time SMS updates in dialog)
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id);
      if (updatedTask && JSON.stringify(updatedTask.smsRequest) !== JSON.stringify(selectedTask.smsRequest)) {
        setSelectedTask(updatedTask);
      }
    }
  }, [tasks, playNotificationSound, selectedTask]);

  const fetchStatusRequests = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('notifications')
      .select('id, related_task_id, read_at')
      .eq('user_id', user.id)
      .eq('type', 'status_request')
      .is('read_at', null);
    
    if (data) {
      setStatusRequests(data);
    }
  };

  const handleDismissStatusRequest = async (taskId: string) => {
    const request = statusRequests.find(r => r.related_task_id === taskId);
    if (request) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', request.id);
      setStatusRequests(prev => prev.filter(r => r.id !== request.id));
    }
  };

  const fetchTasks = async () => {
    if (!user) return;

    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('user_id', user.id);

    if (assignments && assignments.length > 0) {
      const taskIds = assignments.map(a => a.task_id);
      
      const [tasksRes, profilesRes, smsRes, docsRes, evalsRes] = await Promise.all([
        supabase.from('tasks').select('*').in('id', taskIds).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('sms_code_requests').select('*').in('task_id', taskIds).eq('user_id', user.id).order('requested_at', { ascending: false }),
        supabase.from('documents').select('id, task_id').eq('user_id', user.id).in('task_id', taskIds),
        supabase.from('task_evaluations').select('task_id').eq('user_id', user.id).in('task_id', taskIds)
      ]);

      const docCounts: Record<string, number> = {};
      if (docsRes.data) {
        docsRes.data.forEach(doc => {
          if (doc.task_id) {
            docCounts[doc.task_id] = (docCounts[doc.task_id] || 0) + 1;
          }
        });
      }
      setTaskDocuments(docCounts);

      const evalMap: Record<string, boolean> = {};
      if (evalsRes.data) {
        evalsRes.data.forEach(ev => {
          evalMap[ev.task_id] = true;
        });
      }
      setTaskEvaluations(evalMap);

      if (tasksRes.data) {
        const enrichedTasks = tasksRes.data.map(task => {
          const assignment = assignments.find(a => a.task_id === task.id);
          const assignedBy = profilesRes.data?.find((p: any) => p.user_id === task.created_by);
          const taskSmsRequests = smsRes.data?.filter(s => s.task_id === task.id) || [];
          const smsRequest = taskSmsRequests.find(s => s.sms_code) || taskSmsRequests[0];
          return {
            ...task as Task,
            assignment: assignment as TaskAssignment | undefined,
            assignedBy: assignedBy as Profile | undefined,
            smsRequest: smsRequest as SmsCodeRequest | undefined
          };
        });
        setTasks(enrichedTasks);
      }
    } else {
      setTasks([]);
      setTaskDocuments({});
      setTaskEvaluations({});
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    const { error } = await supabase.rpc('accept_task', { _task_id: taskId });
    
    if (error) {
      toast({ title: 'Fehler', description: 'Auftrag konnte nicht angenommen werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Auftrag übernommen!', description: 'Du bist jetzt für diesen Auftrag verantwortlich.' });
      fetchTasks();
    }
  };

  const handleReturnTask = async (taskId: string) => {
    await supabase.from('task_assignments').delete().eq('task_id', taskId).eq('user_id', user?.id);
    await supabase.from('tasks').update({ status: 'pending' }).eq('id', taskId);
    toast({ title: 'Auftrag abgegeben', description: 'Der Auftrag wurde zurückgegeben.' });
    fetchTasks();
  };

  const handleRequestSms = async (taskId: string) => {
    const { error } = await supabase.from('sms_code_requests').insert({
      task_id: taskId,
      user_id: user?.id
    });

    if (error) {
      toast({ title: 'Fehler', description: 'SMS-Anfrage fehlgeschlagen.', variant: 'destructive' });
    } else {
      await supabase.from('tasks').update({ status: 'sms_requested' }).eq('id', taskId);
      toast({ title: 'Erfolg', description: 'SMS-Code wurde angefordert.' });
      fetchTasks();
    }
  };

  const handleResendSmsCode = async (taskId: string, _existingRequestId: string) => {
    setResendingCode(taskId);

    const { error } = await supabase.from('sms_code_requests').insert({
      task_id: taskId,
      user_id: user?.id,
    });

    if (error) {
      toast({ title: 'Fehler', description: 'Neuer SMS-Code konnte nicht angefordert werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Neuer SMS-Code wurde angefordert.' });
      fetchTasks();
    }

    setResendingCode(null);
  };

  const handleCompleteTask = async (task: TaskWithDetails) => {
    const acceptedAt = task.assignment?.accepted_at || task.assignment?.assigned_at;
    let duration = 'Unbekannt';
    if (acceptedAt) {
      duration = formatDistanceStrict(new Date(acceptedAt), new Date(), { locale: de });
    }
    
    const notes = progressNotes[task.id] || '';
    
    const { error } = await supabase.rpc('complete_task', {
      _task_id: task.id,
      _progress_notes: notes || null
    });

    if (error) {
      toast({ title: 'Fehler', description: 'Auftrag konnte nicht abgeschlossen werden.', variant: 'destructive' });
      return;
    }
    
    setCompletionDialog({ open: true, task, duration });
    setSelectedTask(null);
    fetchTasks();
  };

  const handleUpdateNotes = async (taskId: string, notesOverride?: string) => {
    const notes = notesOverride ?? progressNotes[taskId] ?? '';
    const { error } = await supabase
      .from('task_assignments')
      .update({ progress_notes: notes || null })
      .eq('task_id', taskId)
      .eq('user_id', user?.id);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Notizen konnten nicht gespeichert werden.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Gespeichert', description: 'Notizen aktualisiert.' });
  };

  const handleSaveStepNote = async (taskId: string, stepNumber: number) => {
    if (!user) return;
    
    setSavingStepNote(`${taskId}-${stepNumber}`);
    
    const currentStepNotes = stepNotes[taskId] || {};
    const noteForStep = currentStepNotes[stepNumber.toString()] || '';
    
    // Get existing step_notes from database
    const { data: assignment } = await supabase
      .from('task_assignments')
      .select('step_notes')
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .single();
    
    const existingNotes = (assignment?.step_notes as Record<string, string>) || {};
    const updatedNotes = { ...existingNotes, [stepNumber.toString()]: noteForStep };
    
    const { error } = await supabase
      .from('task_assignments')
      .update({ step_notes: updatedNotes })
      .eq('task_id', taskId)
      .eq('user_id', user.id);

    setSavingStepNote(null);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Schritt-Notiz konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Gespeichert', description: `Notiz für Schritt ${stepNumber} gespeichert.` });
  };

  const getStepNote = (taskId: string, stepNumber: number): string => {
    // First check local state
    if (stepNotes[taskId]?.[stepNumber.toString()]) {
      return stepNotes[taskId][stepNumber.toString()];
    }
    // Then check task assignment
    const task = tasks.find(t => t.id === taskId);
    const assignmentNotes = (task?.assignment as any)?.step_notes as Record<string, string> | undefined;
    return assignmentNotes?.[stepNumber.toString()] || '';
  };

  const setStepNote = (taskId: string, stepNumber: number, note: string) => {
    setStepNotes(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [stepNumber.toString()]: note
      }
    }));
  };

  const handleGoToDocuments = (taskId: string) => {
    if (tabContext) {
      tabContext.setPendingTaskId(taskId);
      tabContext.setActiveTab('documents');
    }
  };

  const getWorkflowStep = (task: TaskWithDetails) => {
    const step = (task.assignment as any)?.workflow_step;
    return typeof step === 'number' && step >= 1 && step <= 8 ? step : 1;
  };

  const updateWorkflow = async (
    taskId: string,
    updates: { workflow_step?: number; workflow_digital?: boolean | null }
  ) => {
    if (!user) return;

    const { error } = await supabase
      .from('task_assignments')
      .update(updates)
      .eq('task_id', taskId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Fortschritt konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
      return;
    }

    await fetchTasks();
    
    // Update selectedTask if it's the same task to refresh the dialog immediately
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          assignment: {
            ...prev.assignment,
            workflow_step: updates.workflow_step ?? (prev.assignment as any)?.workflow_step,
            workflow_digital: updates.workflow_digital !== undefined ? updates.workflow_digital : (prev.assignment as any)?.workflow_digital,
          } as any
        };
      });
    }
  };

  const setWorkflowStep = async (
    task: TaskWithDetails,
    nextStep: number,
    extra?: { workflow_digital?: boolean | null }
  ) => {
    const current = getWorkflowStep(task);

    // Allow going back or forward by 1
    if (nextStep < 1 || nextStep > 8) {
      return;
    }

    // Only enforce forward progression for nextStep > current
    if (nextStep > current && nextStep !== current + 1) {
      toast({
        title: 'Reihenfolge beachten',
        description: 'Bitte bearbeite die Schritte strikt der Reihe nach (1 bis 8).',
        variant: 'destructive',
      });
      return;
    }

    await updateWorkflow(task.id, { workflow_step: nextStep, ...extra });
    
    // Auto-scroll to the new step after a short delay
    setTimeout(() => {
      const stepElement = document.getElementById(`workflow-step-${nextStep}`);
      if (stepElement) {
        stepElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleGoBackStep = async (task: TaskWithDetails) => {
    const currentStep = getWorkflowStep(task);
    if (currentStep > 1) {
      await updateWorkflow(task.id, { workflow_step: currentStep - 1 });
    }
  };

  const handlePrimaryStepAction = async (task: TaskWithDetails) => {
    const step = getWorkflowStep(task);

    if (step === 1) {
      await setWorkflowStep(task, 2);
      return;
    }

    if (step === 2) {
      const hasEvaluation = taskEvaluations[task.id];
      if (!hasEvaluation) {
        toast({
          title: 'Bewertungsbogen ausfüllen',
          description: 'Bitte gehe zum Tab „Bewertungsbögen" und fülle deine Bewertung aus.',
          variant: 'destructive',
        });
        if (tabContext) {
          tabContext.setActiveTab('evaluations');
        }
        return;
      }
      await setWorkflowStep(task, 3);
      return;
    }

    if (step === 3) {
      // Open VideoChatDialog to decide on digital flow
      setVideoChatDialog({ open: true, task });
      return;
    }

    if (step === 4) {
      // Step 4: Open external WebID page first, then request SMS code
      if (task.web_ident_url) {
        // Open external page in new tab
        window.open(task.web_ident_url, '_blank', 'noopener,noreferrer');
        
        // Now request SMS code if not already requested
        if (!task.smsRequest) {
          await handleRequestSms(task.id);
          toast({
            title: 'Externe Seite geöffnet & Demo-Daten angefordert',
            description: 'Die WebID-Seite wurde geöffnet. Warte auf den SMS-Code vom Admin.',
          });
          return;
        }
        
        // SMS already requested, check if code received
        if (task.smsRequest.sms_code) {
          await setWorkflowStep(task, 5);
          return;
        }
        
        toast({
          title: 'Warte auf SMS-Code',
          description: 'Die externe Seite ist geöffnet. Der Admin hat die Anfrage erhalten.',
        });
        return;
      }
      
      // No WebID URL - just proceed with SMS request
      if (task.smsRequest?.sms_code) {
        await setWorkflowStep(task, 5);
        return;
      }

      if (!task.smsRequest) {
        await handleRequestSms(task.id);
        toast({
          title: 'Demo-Daten angefordert',
          description: 'Bitte warte auf den SMS-Code vom Admin.',
        });
        return;
      }

      toast({
        title: 'Warte auf SMS-Code',
        description: 'Der Admin hat die Anfrage erhalten. Bitte warte auf den Code.',
      });
      return;
    }

    if (step === 5) {
      // Only proceed to step 6 when user explicitly confirms video chat is done
      if (!videoChatConfirmed) {
        toast({
          title: 'Bestätigung erforderlich',
          description: 'Bitte bestätige, dass du den Videochat abgeschlossen hast.',
          variant: 'destructive',
        });
        return;
      }
      await setWorkflowStep(task, 6);
      setVideoChatConfirmed(false);
      return;
    }

    if (step === 6) {
      await setWorkflowStep(task, 7);
      return;
    }

    if (step === 7) {
      handleGoToDocuments(task.id);
      // Only allow step 8 if at least one document exists
      if ((taskDocuments[task.id] || 0) > 0) {
        await setWorkflowStep(task, 8);
      } else {
        toast({
          title: 'Nachweis fehlt',
          description: 'Bitte lade zuerst einen Nachweis in „Dokumente“ hoch.',
          variant: 'destructive',
        });
      }
      return;
    }

    if (step === 8) {
      if ((taskDocuments[task.id] || 0) <= 0) {
        toast({
          title: 'Nachweis fehlt',
          description: 'Bitte lade zuerst einen Nachweis hoch, bevor du abschließt.',
          variant: 'destructive',
        });
        return;
      }
      await handleCompleteTask(task);
    }
  };

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'pending_review');
  const pendingReviewTasks = tasks.filter(t => t.status === 'pending_review');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const filteredTasks = activeTasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Task workflow steps based on images
  const getTaskSteps = (task: TaskWithDetails) => [
    {
      number: 1,
      title: 'Bewertung der Webseite',
      description: 'Öffne die Internetseite und nimm dir einige Minuten Zeit, um dir ein genaues Bild vom Aufbau der Seite zu machen. Achte dabei besonders auf den ersten Eindruck, die Übersichtlichkeit der Startseite, die Menüführung sowie das allgemeine Design.'
    },
    {
      number: 2,
      title: 'Bewertung ausfüllen',
      description: 'Klicke im Auftrag auf „Weiter", um den Bewertungsbogen zu starten. Gib dort deine persönliche Einschätzung zum Design, zur Übersichtlichkeit und zum Gesamteindruck der Webseite ab. Fülle den Bogen vollständig aus und bestätige die Eingabe.'
    },
    {
      number: 3,
      title: 'Entscheidung zum digitalen Ablauf',
      description: 'Im nächsten Schritt wirst du gefragt, ob du den digitalen Ablauf testen möchtest. Dabei handelt es sich um einen kurzen Videochat, bei dem du dich mit Demo-Daten ausweist. Der Ablauf ist anonym, rechtlich unverbindlich und dauert nur wenige Minuten.'
    },
    {
      number: 4,
      title: 'Demo-Daten erhalten',
      description: 'Nach deiner Zustimmung erscheinen die Demo-Daten nach kurzer Zeit in deinem System. Wenn du sie werktags zwischen 9:00 und 18:00 Uhr beantragst, stehen sie dir in der Regel innerhalb von 30 Minuten zur Verfügung.'
    },
    {
      number: 5,
      title: 'Videochat durchführen',
      description: 'Mit den erhaltenen Demo-Daten startest du den digitalen Ablauf auf der Webseite. Der Videochat ist kurz, dauert nur etwa fünf Minuten und kann bequem per Laptop oder Smartphone durchgeführt werden.'
    },
    {
      number: 6,
      title: 'Unterlagen abwarten',
      description: 'Nach erfolgreichem Abschluss des Ablaufs erhältst du automatisch postalisch neutrale Unterlagen. Diese Unterlagen sind rein simuliert und haben keine rechtliche Relevanz.'
    },
    {
      number: 7,
      title: 'Nachweis hochladen',
      description: 'Fotografiere oder scanne die erhaltenen Unterlagen und lade sie im Auftragssystem hoch. Achte darauf, dass die Dateien gut lesbar sind. Erst nach dem erfolgreichen Upload gilt der Auftrag als vollständig erledigt.'
    },
    {
      number: 8,
      title: 'Auftrag abschließen',
      description: 'Sobald die Unterlagen hochgeladen wurden, kannst du den Auftrag als abgeschlossen markieren. Erst dann wird dir die vereinbarte Arbeitszeit gutgeschrieben.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Meine Aufträge</h2>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre aktuellen Aufträge und sehen Sie Ihren Fortschritt ein.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-48"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={async () => {
              setIsRefreshing(true);
              await fetchTasks();
              setTimeout(() => setIsRefreshing(false), 500);
            }} 
            className="gap-2"
            disabled={isRefreshing}
          >
            <RefreshCcw className={cn("h-4 w-4 transition-transform", isRefreshing && "animate-spin")} />
            {isRefreshing ? 'Lädt...' : 'Aktualisieren'}
          </Button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Keine Aufträge</h3>
            <p className="text-muted-foreground">
              {tasks.length > 0 
                ? '🎉 Super gemacht! Du hast alle deine Aufträge abgeschlossen.'
                : 'Dir wurden noch keine Aufträge zugewiesen.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const workflowDigital = (task.assignment as any)?.workflow_digital;
            const videoChatStatus = workflowDigital === true 
              ? { text: 'Digitaler Ablauf gewählt', color: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-400' }
              : workflowDigital === false 
                ? { text: 'Digitaler Ablauf abgelehnt', color: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400' }
                : null;
            
            return (
              <Card key={task.id} className="overflow-hidden hover:shadow-lg transition-all border-primary/10 hover:border-primary/20">
                <CardContent className="p-0 bg-gradient-to-br from-background to-primary/5 dark:to-primary/5">
                  {/* Card Header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <Badge variant="outline" className={statusConfig[task.status].color}>
                          {statusConfig[task.status].label}
                        </Badge>
                        {task.special_compensation && task.special_compensation > 0 && (
                          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                            {task.special_compensation.toFixed(2)} €
                          </Badge>
                        )}
                      </div>
                      {task.deadline && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(task.deadline), 'dd.MM.yyyy', { locale: de })}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-1 line-clamp-2">{task.title}</h3>
                    
                    <Badge variant="outline" className={`mt-2 ${priorityConfig[task.priority].color}`}>
                      {priorityConfig[task.priority].label}
                    </Badge>
                  </div>
                  
                  {/* Video Chat Status - based on workflow_digital */}
                  {videoChatStatus && (
                    <div className={`px-4 py-2 border-y ${videoChatStatus.color}`}>
                      <div className="flex items-center gap-2 text-sm">
                        {workflowDigital === true ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        {videoChatStatus.text}
                      </div>
                    </div>
                  )}
                  
                  {/* SMS Code Display on Card */}
                  {task.smsRequest?.sms_code && (
                    <div 
                      className="px-4 py-2 bg-primary/5 border-y border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors group"
                      onClick={() => handleCopySmsCode(task.smsRequest!.sms_code!)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">SMS-Code</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary tracking-widest">
                            {task.smsRequest.sms_code}
                          </span>
                          {copiedCode === task.smsRequest.sms_code ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-primary/50 group-hover:text-primary transition-colors" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Step Progress Overview */}
                  {task.assignment?.accepted_at && (
                    <div className="px-4 py-3 border-t border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Fortschritt</span>
                        <span className="text-xs font-semibold text-primary">
                          Schritt {(task.assignment as any)?.workflow_step || 1} / 8
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => {
                          const currentStep = (task.assignment as any)?.workflow_step || 1;
                          const isDone = step < currentStep;
                          const isActive = step === currentStep;
                          return (
                            <div
                              key={step}
                              className={cn(
                                'flex-1 h-2 rounded-full transition-colors',
                                isDone ? 'bg-primary' : isActive ? 'bg-primary/60' : 'bg-muted'
                              )}
                              title={`Schritt ${step}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Time estimate */}
                  <div className="px-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Geschätzt: 5h</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="p-4 pt-2 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2"
                        onClick={() => {
                          setDialogViewMode('details');
                          setSelectedTask(task);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        Details
                      </Button>
                      {task.status === 'assigned' && !task.assignment?.accepted_at ? (
                        isCheckedIn ? (
                          <Button 
                            className="flex-1 gap-2"
                            onClick={() => handleAcceptTask(task.id)}
                          >
                            <ArrowRight className="h-4 w-4" />
                            Starten
                          </Button>
                        ) : (
                          <Button 
                            className="flex-1 gap-2" 
                            disabled
                          >
                            Einstempeln zum Starten
                          </Button>
                        )
                      ) : task.assignment?.accepted_at && task.status !== 'completed' ? (
                        <Button 
                          className="flex-1 gap-2"
                          onClick={() => {
                            setDialogViewMode('workflow');
                            setSelectedTask(task);
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                          Fortsetzen
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tasks in Review */}
      {pendingReviewTasks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            In Überprüfung ({pendingReviewTasks.length})
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {pendingReviewTasks.map((task) => (
              <Card key={task.id} className="overflow-hidden border-orange-500/20 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30 hover:border-orange-500/40 transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30">
                      In Überprüfung
                    </Badge>
                    {task.special_compensation && task.special_compensation > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        {task.special_compensation.toFixed(2)} € ausstehend
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold">{task.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">Wartet auf Genehmigung durch Teammitglied</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks with Approval */}
      {completedTasks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Genehmigte Aufträge ({completedTasks.length})
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {completedTasks.slice(0, 4).map((task) => (
              <Card key={task.id} className="overflow-hidden border-green-500/20 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 hover:border-green-500/40 transition-all duration-300 cursor-default">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30">
                      Genehmigt
                    </Badge>
                    {task.special_compensation && task.special_compensation > 0 && (
                      <Badge className="bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-600/30 font-medium">
                        {task.special_compensation.toFixed(2)} € verrechnet
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold">{task.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{task.customer_name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Task Detail / Flow View */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
          {selectedTask && (
            <>
              {dialogViewMode === 'details' ? (
                // DETAILS VIEW - Shows task information
                <>
                  <DialogHeader>
                    <DialogTitle className="text-xl">{selectedTask.title}</DialogTitle>
                    <DialogDescription>
                      Auftragsdetails und Informationen
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    {/* Task Info */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Kunde:</span>
                          <span className="text-sm">{selectedTask.customer_name}</span>
                        </div>
                        {selectedTask.customer_phone && (
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Telefon:</span>
                            <span className="text-sm">{selectedTask.customer_phone}</span>
                          </div>
                        )}
                        {selectedTask.deadline && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Deadline:</span>
                            <span className="text-sm">{format(new Date(selectedTask.deadline), 'dd.MM.yyyy', { locale: de })}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={statusConfig[selectedTask.status].color}>
                            {statusConfig[selectedTask.status].label}
                          </Badge>
                          {selectedTask.special_compensation && selectedTask.special_compensation > 0 && (
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              {selectedTask.special_compensation.toFixed(2)} €
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn(priorityConfig[selectedTask.priority].color, "animate-pulse")}>
                            {priorityConfig[selectedTask.priority].label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {selectedTask.description && (
                      <div>
                        <h4 className="font-medium mb-2">Beschreibung</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTask.description}</p>
                      </div>
                    )}
                    {/* Test credentials - only visible from step 4 onwards */}
                    {(selectedTask.test_email || selectedTask.test_password) && getWorkflowStep(selectedTask) >= 4 && (
                      <div className="p-4 bg-info/10 rounded-lg border border-info/20">
                        <p className="text-xs font-semibold text-info mb-3 uppercase tracking-wide">
                          Test-Zugangsdaten
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {selectedTask.test_email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-info" />
                              <span className="font-mono">{selectedTask.test_email}</span>
                            </div>
                          )}
                          {selectedTask.test_password && (
                            <div className="flex items-center gap-2 text-sm">
                              <Key className="h-4 w-4 text-info" />
                              <span className="font-mono">{selectedTask.test_password}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedTask.notes && (
                      <div>
                        <h4 className="font-medium mb-2">Notizen vom Admin</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTask.notes}</p>
                      </div>
                    )}

                    {/* Assigned by */}
                    {selectedTask.assignedBy && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserCheck className="h-4 w-4" />
                        Zugewiesen von: {selectedTask.assignedBy.first_name} {selectedTask.assignedBy.last_name}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setSelectedTask(null)}>
                      Schließen
                    </Button>

                    <div className="flex-1" />

                    {selectedTask.assignment?.accepted_at && selectedTask.status !== 'completed' && (
                      <Button
                        className="gap-2"
                        onClick={() => setDialogViewMode('workflow')}
                      >
                        <ArrowRight className="h-4 w-4" />
                        Auftragsschritte
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                // WORKFLOW VIEW - Shows steps
                (() => {
                  const currentStep = getWorkflowStep(selectedTask);
                  const steps = getTaskSteps(selectedTask);

                  return (
                    <>
                      <DialogHeader>
                        <DialogTitle className="text-xl">{selectedTask.title}</DialogTitle>
                        <DialogDescription className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            Schritt {currentStep} von 8
                          </span>
                        </DialogDescription>
                      </DialogHeader>

                      {/* Progress indicator */}
                      <div className="flex gap-1 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => {
                          const isDone = step < currentStep;
                          const isActive = step === currentStep;
                          return (
                            <div
                              key={step}
                              className={cn(
                                'flex-1 h-2 rounded-full transition-colors',
                                isDone ? 'bg-primary' : isActive ? 'bg-primary/60' : 'bg-muted'
                              )}
                            />
                          );
                        })}
                      </div>

                      {/* Workflow steps with images */}
                      <div className="space-y-4" ref={workflowContentRef}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">Aufgabenverlauf</h3>
                        </div>
                        <div className="space-y-3">
                          {steps.map((step) => (
                            <div
                              key={step.number}
                              id={`workflow-step-${step.number}`}
                              className="scroll-mt-4"
                            >
                              <WorkflowStepCard
                                step={step}
                                currentStep={currentStep}
                                isExpanded={step.number === currentStep}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bewertungsbogen Hinweis (Step 2) */}
                      {currentStep === 2 && (
                        <div className="mt-6 p-4 rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30">
                          <h4 className="font-medium mb-2 text-amber-800 dark:text-amber-300">Bewertungsbogen ausfüllen</h4>
                          <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                            {taskEvaluations[selectedTask.id] 
                              ? 'Bewertung wurde ausgefüllt. Du kannst jetzt zum nächsten Schritt.'
                              : 'Bitte gehe zum Tab „Bewertungsbögen", um deine strukturierte Bewertung für diesen Auftrag einzutragen.'}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {!taskEvaluations[selectedTask.id] && (
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  if (tabContext) {
                                    tabContext.setActiveTab('evaluations');
                                  }
                                }}
                                className="gap-2"
                              >
                                Zum Bewertungsbogen
                              </Button>
                            )}
                            {taskEvaluations[selectedTask.id] && (
                              <Button 
                                onClick={() => setWorkflowStep(selectedTask, 3)}
                                className="gap-2"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Bewertung ausgefüllt → Weiter
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Video Chat Status Section */}
                      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-medium mb-3">Video-Chat Status</h4>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Video className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">Video Beratung</p>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-muted-foreground">
                                {(selectedTask.assignment as any)?.workflow_digital === true
                                  ? 'Digitaler Ablauf gewählt'
                                  : (selectedTask.assignment as any)?.workflow_digital === false
                                    ? 'Abgelehnt'
                                    : 'Noch nicht entschieden'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Task credentials if any - only visible from step 4 onwards */}
                      {(selectedTask.test_email || selectedTask.test_password) && currentStep >= 4 && (
                        <div className="p-4 bg-info/10 rounded-lg border border-info/20">
                          <p className="text-xs font-semibold text-info mb-3 uppercase tracking-wide">
                            Test-Zugangsdaten
                          </p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {selectedTask.test_email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-info" />
                                <span className="font-mono">{selectedTask.test_email}</span>
                              </div>
                            )}
                            {selectedTask.test_password && (
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-4 w-4 text-info" />
                                <span className="font-mono">{selectedTask.test_password}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* SMS Code display / Waiting indicator for Step 4 */}
                      {currentStep === 4 && (
                        <div className="p-4 rounded-lg border bg-gradient-to-r from-primary/5 to-transparent relative overflow-hidden">
                          {/* SMS Received Animation Overlay */}
                          {showSmsReceivedAnimation === selectedTask.id && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-r from-emerald-500/20 to-green-500/20 animate-fade-in">
                              <div className="flex flex-col items-center gap-3 animate-scale-in">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                                  <CheckCircle2 className="h-10 w-10 text-white" />
                                </div>
                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">SMS-Code erhalten!</p>
                              </div>
                            </div>
                          )}
                          
                          {selectedTask.smsRequest?.sms_code ? (
                            <SmsCodeDisplay
                              smsCode={selectedTask.smsRequest.sms_code}
                              onResendCode={() => handleResendSmsCode(selectedTask.id, selectedTask.smsRequest!.id)}
                              isResending={resendingCode === selectedTask.id}
                            />
                          ) : selectedTask.smsRequest ? (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <div className="relative">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                                <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-primary/30 animate-ping" />
                              </div>
                              <p className="font-semibold text-lg mb-1">Warte auf SMS-Code</p>
                              <p className="text-sm text-muted-foreground max-w-xs">
                                Der Admin wurde benachrichtigt. Dein SMS-Code wird in Kürze bereitgestellt.
                              </p>
                              
                              {/* Request timestamp with relative time */}
                              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  Angefragt um {format(new Date(selectedTask.smsRequest.requested_at), 'HH:mm', { locale: de })} Uhr
                                </div>
                                <div className="px-3 py-1.5 bg-primary/10 rounded-full text-xs font-medium text-primary">
                                  vor {formatDistanceStrict(new Date(selectedTask.smsRequest.requested_at), new Date(), { locale: de, addSuffix: false })}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>Werktags 9-18 Uhr: ca. 30 Minuten</span>
                              </div>
                              
                              {/* Countdown Timer & Refresh */}
                              <div className="mt-4 p-3 bg-muted/50 rounded-lg border w-full max-w-xs">
                                <div className="flex items-center justify-center gap-2">
                                  <RefreshCcw className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium">
                                    Nächste Aktualisierung in{' '}
                                    <span className="font-mono text-primary font-bold">{smsCountdown}s</span>
                                  </span>
                                </div>
                                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000 ease-linear"
                                    style={{ width: `${(smsCountdown / 30) * 100}%` }}
                                  />
                                </div>
                                
                                {/* Manual refresh button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-3 gap-2"
                                  disabled={isRefreshing}
                                  onClick={async () => {
                                    setIsRefreshing(true);
                                    await fetchTasks();
                                    setSmsCountdown(30);
                                    setTimeout(() => setIsRefreshing(false), 500);
                                  }}
                                >
                                  <RefreshCcw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                                  {isRefreshing ? 'Prüfe...' : 'Jetzt prüfen'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <MessageSquare className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <p className="font-medium mb-1">Demo-Daten anfordern</p>
                              <p className="text-sm text-muted-foreground">
                                Klicke unten auf "Demo-Daten anfordern", um den SMS-Code zu erhalten.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SMS Code display for other steps when available */}
                      {currentStep !== 4 && selectedTask.smsRequest?.sms_code && (
                        <SmsCodeDisplay
                          smsCode={selectedTask.smsRequest.sms_code}
                          onResendCode={() => handleResendSmsCode(selectedTask.id, selectedTask.smsRequest!.id)}
                          isResending={resendingCode === selectedTask.id}
                        />
                      )}

                      {/* Step 5: Videochat Tab - Elegant Visual with External Link */}
                      {currentStep === 5 && (
                        <div className="rounded-xl border overflow-hidden bg-gradient-to-br from-cyan-500/5 via-blue-500/5 to-violet-500/5">
                          {/* Hero Banner with Visual */}
                          <div className="relative h-48 bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 flex items-center justify-center overflow-hidden">
                            {/* Animated Background Elements */}
                            <div className="absolute inset-0">
                              <div className="absolute top-4 left-4 w-20 h-20 rounded-full bg-white/10 blur-xl animate-pulse" />
                              <div className="absolute bottom-4 right-4 w-32 h-32 rounded-full bg-white/5 blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
                            </div>
                            
                            {/* Main Icon */}
                            <div className="relative z-10 flex flex-col items-center gap-4">
                              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl shadow-black/20 border border-white/30">
                                <Video className="h-10 w-10 text-white" />
                              </div>
                              <div className="text-center">
                                <h3 className="text-xl font-bold text-white">Video-Verifizierung</h3>
                                <p className="text-sm text-white/80">Öffne die externe Seite für den Videochat</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Content Area */}
                          <div className="p-6 space-y-5">
                            {/* SMS Code Display - Prominent */}
                            {selectedTask.smsRequest?.sms_code ? (
                              <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                      <MessageSquare className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-primary/70 uppercase tracking-wide">SMS-Code für Verifizierung</p>
                                      <p className="text-3xl font-mono font-bold text-primary tracking-[0.4em]">
                                        {selectedTask.smsRequest.sms_code}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                      onClick={() => handleCopySmsCode(selectedTask.smsRequest!.sms_code!)}
                                    >
                                      {copiedCode === selectedTask.smsRequest.sms_code ? (
                                        <>
                                          <Check className="h-3 w-3" />
                                          Kopiert
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3 w-3" />
                                          Kopieren
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                      disabled={resendingCode === selectedTask.id}
                                      onClick={() => handleResendSmsCode(selectedTask.id, selectedTask.smsRequest!.id)}
                                    >
                                      <RefreshCw className={cn("h-3 w-3", resendingCode === selectedTask.id && "animate-spin")} />
                                      Neuer Code
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : selectedTask.smsRequest ? (
                              <div className="p-4 bg-muted/50 rounded-xl border animate-pulse">
                                <div className="flex items-center gap-3">
                                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                  <span className="text-sm font-medium">Warte auf SMS-Code vom Admin...</span>
                                </div>
                              </div>
                            ) : null}

                            {/* Important Notice */}
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                              <div className="flex items-start gap-3">
                                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">Externe Seite erforderlich</p>
                                  <p className="text-sm text-amber-700 dark:text-amber-400">
                                    Die Videochat-Plattform kann aus Sicherheitsgründen nicht eingebettet werden. 
                                    Klicke auf "Extern öffnen", um den Videochat in einem neuen Tab zu starten.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Primary Action - Extern Öffnen */}
                            {selectedTask.web_ident_url && (
                              <Button
                                size="lg"
                                className="w-full gap-3 h-14 text-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/20"
                                asChild
                              >
                                <a href={selectedTask.web_ident_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-5 w-5" />
                                  Extern öffnen
                                </a>
                              </Button>
                            )}

                            {/* Confirmation Section */}
                            <div className="p-4 bg-muted/30 rounded-xl border">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  id="videochat-confirm-step5"
                                  checked={videoChatConfirmed}
                                  onCheckedChange={(checked) => setVideoChatConfirmed(checked === true)}
                                  className="mt-0.5"
                                />
                                <label htmlFor="videochat-confirm-step5" className="text-sm cursor-pointer leading-relaxed">
                                  Ich bestätige, dass ich den Videochat <strong>erfolgreich abgeschlossen</strong> habe und die Verifizierung durchgeführt wurde.
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step Notes - separate note for each step */}
                      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Notiz für Schritt {currentStep}
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={savingStepNote === `${selectedTask.id}-${currentStep}`}
                            onClick={() => handleSaveStepNote(selectedTask.id, currentStep)}
                          >
                            {savingStepNote === `${selectedTask.id}-${currentStep}` ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Speichern
                          </Button>
                        </div>
                        <Textarea
                          placeholder={`Was hast du in Schritt ${currentStep} gemacht? Notizen hier eingeben...`}
                          value={getStepNote(selectedTask.id, currentStep)}
                          onChange={(e) => setStepNote(selectedTask.id, currentStep, e.target.value)}
                          className="min-h-[80px] bg-background"
                        />
                        
                        {/* Show previous step notes */}
                        {currentStep > 1 && (
                          <div className="mt-4 pt-4 border-t border-border/50">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Vorherige Schritt-Notizen:</p>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {Array.from({ length: currentStep - 1 }, (_, i) => i + 1).map(step => {
                                const note = getStepNote(selectedTask.id, step);
                                if (!note) return null;
                                return (
                                  <div key={step} className="text-xs p-2 bg-background rounded border">
                                    <span className="font-medium text-primary">Schritt {step}:</span>
                                    <span className="ml-2 text-muted-foreground">{note}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-3 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          onClick={async () => {
                            if (currentStep > 1) {
                              await handleGoBackStep(selectedTask);
                            } else {
                              setDialogViewMode('details');
                            }
                          }}
                        >
                          ← Zurück
                        </Button>

                        <div className="flex-1" />

                        {selectedTask.status === 'assigned' && !selectedTask.assignment?.accepted_at && isCheckedIn && (
                          <Button
                            onClick={async () => {
                              await handleAcceptTask(selectedTask.id);
                              await updateWorkflow(selectedTask.id, { workflow_step: 1, workflow_digital: null });
                            }}
                          >
                            Auftrag annehmen
                          </Button>
                        )}

                        {selectedTask.assignment?.accepted_at && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => handleGoToDocuments(selectedTask.id)}
                              className="gap-2"
                            >
                              <FileUp className="h-4 w-4" />
                              Dokumente
                            </Button>

                            <Button
                              className="gap-2"
                              onClick={() => handlePrimaryStepAction(selectedTask)}
                            >
                              {(() => {
                                const step = getWorkflowStep(selectedTask);
                                if (step === 3) return 'Weiter (Entscheidung)';
                                if (step === 4) {
                                  if (selectedTask.smsRequest?.sms_code) return 'SMS-Code erhalten → Weiter';
                                  if (selectedTask.smsRequest) return (
                                    <span className="flex items-center gap-2">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Warte auf SMS-Code...
                                    </span>
                                  );
                                  return 'Demo-Daten anfordern';
                                }
                                if (step === 5) {
                                  if (selectedTask.web_ident_url) return 'Extern Öffnen';
                                  if (videoChatConfirmed) return 'Videochat erledigt → weiter';
                                  return 'Bitte Checkbox bestätigen';
                                }
                                if (step === 7) return (taskDocuments[selectedTask.id] || 0) > 0 ? 'Weiter zu Abschluss' : 'Nachweis hochladen';
                                if (step === 8) return 'Auftrag abschließen';
                                return 'Weiter';
                              })()}
                              <ArrowRight className="h-4 w-4" />
                            </Button>

                            {getWorkflowStep(selectedTask) === 8 && (taskDocuments[selectedTask.id] || 0) > 0 ? (
                              <Button
                                onClick={() => handleCompleteTask(selectedTask)}
                                className="gap-2"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Abschließen
                              </Button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </>
                  );
                })()
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Chat Confirmation Dialog */}
      <Dialog open={videoChatDialog.open} onOpenChange={(open) => setVideoChatDialog({ ...videoChatDialog, open })}>
        <DialogContent className="max-w-2xl [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Möchtest du den Video-Chat durchführen?
            </DialogTitle>
            <DialogDescription className="text-center">
              Der Video-Chat ist ein wichtiger Teil des Bewertungsprozesses. Bitte lies dir die folgenden Hinweise sorgfältig durch.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div>
              <h4 className="font-semibold mb-3">Hinweise für den Video-Chat</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Damit du den Anmeldeprozess realistisch bewerten kannst, bitten wir dich, dich wie ein echter Neukunde zu verhalten. Deine Angaben dienen ausschließlich der internen Bewertung – sie sind nicht rechtsverbindlich.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Gesetzlich vorgeschriebene Fragen im Chat</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Während des Video-Chats kann dir der/die Mitarbeiter:in Sicherheitsfragen stellen, z. B.:
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm italic">
                <p>„Wirst du gezwungen, einen Account zu eröffnen?"</p>
                <p>„Steht jemand bei dir, der dich zur Anmeldung drängt?"</p>
              </div>
              <p className="text-sm font-medium mt-3">
                Diese Fragen musst du immer mit „Nein" beantworten.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Falls keine solchen Fragen gestellt werden, vermerke das bitte im Bewertungsbogen.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Wichtige Hinweise zur Durchführung</h4>
              <p className="text-sm text-muted-foreground">
                Wähle eine ruhige Umgebung mit guter Beleuchtung, funktionierender Webcam und stabiler Internetverbindung.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Folge den Anweisungen des Video-Chat-Systems bzw. der Mitarbeiterin oder des Mitarbeiters Schritt für Schritt.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Sollte etwas unklar oder technisch problematisch sein, notiere es bitte im Bewertungsbogen.
              </p>
            </div>
            
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                  Bei Ablehnung wird die Bewertung als nicht erfolgreich gewertet und fließt nicht in deine Leistungen ein.
                </p>
              </div>
            </div>
          </div>
          
           <div className="flex gap-3">
             <Button
               variant="outline"
               className="flex-1 gap-2"
               onClick={async () => {
                 const task = videoChatDialog.task;
                 setVideoChatDialog({ open: false, task: null });
                 if (!task) return;
                 await updateWorkflow(task.id, { workflow_step: 6, workflow_digital: false });
                 toast({ title: 'Okay', description: 'Du hast den digitalen Ablauf abgelehnt. Weiter mit Schritt 6.' });
               }}
             >
               <X className="h-4 w-4" />
               Ablehnen
             </Button>
             <Button
               className="flex-1 gap-2"
               onClick={async () => {
                 const task = videoChatDialog.task;
                 setVideoChatDialog({ open: false, task: null });
                 if (!task) return;
                 await updateWorkflow(task.id, { workflow_step: 4, workflow_digital: true });
                 toast({ title: 'Einverstanden', description: 'Weiter mit Schritt 4: Demo-Daten anfordern.' });
               }}
             >
               <CheckCircle2 className="h-4 w-4" />
               Einverstanden
             </Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={completionDialog.open} onOpenChange={(open) => {
        if (!open) setCompletionDialog({ ...completionDialog, open: false });
      }}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <PartyPopper className="h-6 w-6 text-yellow-500" />
              Hervorragende Arbeit!
            </DialogTitle>
            <DialogDescription>
              Du hast den Auftrag erfolgreich abgeschlossen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
                <Trophy className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold">{completionDialog.task?.title}</h3>
              <p className="text-muted-foreground">{completionDialog.task?.customer_name}</p>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Bearbeitungszeit
                </span>
                <span className="font-bold text-lg">{completionDialog.duration}</span>
              </div>
              {completionDialog.task?.special_compensation && completionDialog.task.special_compensation > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    Sondervergütung
                  </span>
                  <span className="font-bold text-lg text-emerald-600">{completionDialog.task.special_compensation.toFixed(2)} €</span>
                </div>
              )}
            </div>
            
            <div className="text-center">
              <Button
                onClick={() => {
                  setCompletionDialog({ ...completionDialog, open: false });
                  fetchTasks();
                }}
                className="bg-primary"
              >
                Zurück zu Aufträge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Web-Ident Dialog - Elegant Design with External Focus */}
      <Dialog open={webIdentDialog.open} onOpenChange={(open) => setWebIdentDialog({ ...webIdentDialog, open })}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden [&>button]:hidden">
          {/* Custom Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-background to-cyan-500/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Video className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{webIdentDialog.taskTitle}</h3>
                <p className="text-sm text-muted-foreground">Video-Verifizierung</p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setWebIdentDialog({ open: false, url: '', taskTitle: '', taskId: '' })}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Phone Number & SMS Code */}
            <div className="flex flex-wrap gap-3">
              {(() => {
                const currentTask = tasks.find(t => t.id === webIdentDialog.taskId);
                return (
                  <>
                    {currentTask?.customer_phone && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{currentTask.customer_phone}</span>
                      </div>
                    )}
                    {currentTask?.smsRequest?.sms_code && (
                      <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-primary uppercase tracking-wide">SMS-Code</span>
                        <span className="text-2xl font-mono font-bold text-primary tracking-[0.3em]">
                          {currentTask.smsRequest.sms_code}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Important Notice */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">Wichtiger Hinweis</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Die Videochat-Seite kann aus Sicherheitsgründen nicht in einem eingebetteten Fenster angezeigt werden. 
                    Bitte öffne die Seite in einem neuen Tab über den Button unten.
                  </p>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border">
              <Checkbox
                id="videochat-dialog-confirm"
                checked={videoChatConfirmed}
                onCheckedChange={(checked) => setVideoChatConfirmed(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="videochat-dialog-confirm" className="text-sm cursor-pointer leading-relaxed">
                Ich bestätige, dass ich den Videochat <strong>erfolgreich abgeschlossen</strong> habe und die Verifizierung durchgeführt wurde.
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                asChild
              >
                <a href={webIdentDialog.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Extern Öffnen
                </a>
              </Button>
              
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  if (webIdentDialog.taskId) {
                    handleRequestSms(webIdentDialog.taskId);
                  }
                }}
              >
                <MessageSquare className="h-4 w-4" />
                SMS anfordern
              </Button>
            </div>

            {/* Complete Button */}
            <div className="pt-4 border-t">
              <Button
                className="w-full gap-2"
                disabled={!videoChatConfirmed}
                onClick={async () => {
                  const taskId = webIdentDialog.taskId;
                  setWebIdentDialog({ open: false, url: '', taskTitle: '', taskId: '' });
                  if (taskId) {
                    const task = tasks.find(t => t.id === taskId);
                    if (task) {
                      await setWorkflowStep(task, 6);
                      setVideoChatConfirmed(false);
                      toast({
                        title: 'Videochat abgeschlossen',
                        description: 'Weiter mit Schritt 6: Unterlagen abwarten.',
                      });
                    }
                  }
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Videochat abgeschlossen – Weiter zu Schritt 6
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
