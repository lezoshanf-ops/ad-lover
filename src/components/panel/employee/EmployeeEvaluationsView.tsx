import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ClipboardCheck, Star, CheckCircle2, Edit2, Save, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskEvaluation {
  id: string;
  task_id: string;
  user_id: string;
  design_rating: number;
  usability_rating: number;
  overall_rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  title: string;
  customer_name: string;
  status: string;
}

interface EvaluationWithTask extends TaskEvaluation {
  task: Task;
}

export default function EmployeeEvaluationsView() {
  const [evaluations, setEvaluations] = useState<EvaluationWithTask[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    design_rating: string;
    usability_rating: string;
    overall_rating: string;
    comment: string;
  }>({ design_rating: '', usability_rating: '', overall_rating: '', comment: '' });
  const [newEvalTaskId, setNewEvalTaskId] = useState<string | null>(null);
  const [newEvalForm, setNewEvalForm] = useState<{
    design_rating: string;
    usability_rating: string;
    overall_rating: string;
    comment: string;
  }>({ design_rating: '', usability_rating: '', overall_rating: '', comment: '' });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchEvaluations();
      fetchPendingTasks();
    }
  }, [user]);

  const fetchEvaluations = async () => {
    if (!user) return;

    // Fetch evaluations
    const { data: evals } = await supabase
      .from('task_evaluations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (evals && evals.length > 0) {
      const taskIds = evals.map((e) => e.task_id);
      const { data: tasks } = await supabase.from('tasks').select('id, title, customer_name, status').in('id', taskIds);

      const enriched: EvaluationWithTask[] = evals.map((ev) => ({
        ...ev,
        task: tasks?.find((t) => t.id === ev.task_id) || { id: ev.task_id, title: 'Unbekannt', customer_name: '', status: '' },
      }));
      setEvaluations(enriched);
    } else {
      setEvaluations([]);
    }
  };

  const fetchPendingTasks = async () => {
    if (!user) return;

    // Get assigned tasks that don't have an evaluation yet
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('task_id')
      .eq('user_id', user.id);

    if (!assignments || assignments.length === 0) {
      setPendingTasks([]);
      return;
    }

    const taskIds = assignments.map((a) => a.task_id);

    const { data: existingEvals } = await supabase
      .from('task_evaluations')
      .select('task_id')
      .eq('user_id', user.id)
      .in('task_id', taskIds);

    const evaluatedTaskIds = new Set(existingEvals?.map((e) => e.task_id) || []);
    const pendingTaskIds = taskIds.filter((id) => !evaluatedTaskIds.has(id));

    if (pendingTaskIds.length === 0) {
      setPendingTasks([]);
      return;
    }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, customer_name, status')
      .in('id', pendingTaskIds)
      .neq('status', 'completed')
      .neq('status', 'cancelled');

    setPendingTasks(tasks || []);
  };

  const handleSaveNew = async () => {
    if (!user || !newEvalTaskId) return;

    if (!newEvalForm.design_rating || !newEvalForm.usability_rating || !newEvalForm.overall_rating) {
      toast({ title: 'Unvollständig', description: 'Bitte alle 3 Bewertungen ausfüllen.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('task_evaluations').insert({
      task_id: newEvalTaskId,
      user_id: user.id,
      design_rating: parseInt(newEvalForm.design_rating),
      usability_rating: parseInt(newEvalForm.usability_rating),
      overall_rating: parseInt(newEvalForm.overall_rating),
      comment: newEvalForm.comment || null,
    });

    if (error) {
      toast({ title: 'Fehler', description: 'Bewertung konnte nicht gespeichert werden.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Gespeichert', description: 'Bewertung erfolgreich gespeichert.' });
    setNewEvalTaskId(null);
    setNewEvalForm({ design_rating: '', usability_rating: '', overall_rating: '', comment: '' });
    fetchEvaluations();
    fetchPendingTasks();
  };

  const handleEdit = (ev: EvaluationWithTask) => {
    setEditingId(ev.id);
    setEditForm({
      design_rating: String(ev.design_rating),
      usability_rating: String(ev.usability_rating),
      overall_rating: String(ev.overall_rating),
      comment: ev.comment || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    if (!editForm.design_rating || !editForm.usability_rating || !editForm.overall_rating) {
      toast({ title: 'Unvollständig', description: 'Bitte alle 3 Bewertungen ausfüllen.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('task_evaluations')
      .update({
        design_rating: parseInt(editForm.design_rating),
        usability_rating: parseInt(editForm.usability_rating),
        overall_rating: parseInt(editForm.overall_rating),
        comment: editForm.comment || null,
      })
      .eq('id', editingId);

    if (error) {
      toast({ title: 'Fehler', description: 'Änderung konnte nicht gespeichert werden.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Aktualisiert', description: 'Bewertung aktualisiert.' });
    setEditingId(null);
    fetchEvaluations();
  };

  const RatingStars = ({ value }: { value: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('h-4 w-4', n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </div>
  );

  const RatingRadioGroup = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <RadioGroupItem id={`${label}-${n}`} value={String(n)} />
            <Label htmlFor={`${label}-${n}`} className="cursor-pointer">
              {n}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bewertungsbögen</h2>
        <p className="text-muted-foreground">Hier findest du alle deine strukturierten Auftragsbewertungen.</p>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Offene Bewertungen
            </CardTitle>
            <CardDescription>Diese Aufträge haben noch keine Bewertung.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pendingTasks.map((t) => (
                <Button
                  key={t.id}
                  variant={newEvalTaskId === t.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setNewEvalTaskId(t.id);
                    setNewEvalForm({ design_rating: '', usability_rating: '', overall_rating: '', comment: '' });
                  }}
                >
                  {t.title}
                </Button>
              ))}
            </div>

            {newEvalTaskId && (
              <div className="mt-4 p-4 border rounded-lg bg-background space-y-4">
                <h4 className="font-medium">
                  Neue Bewertung für: {pendingTasks.find((t) => t.id === newEvalTaskId)?.title}
                </h4>

                <RatingRadioGroup
                  label="Design (1–5)"
                  value={newEvalForm.design_rating}
                  onChange={(v) => setNewEvalForm((p) => ({ ...p, design_rating: v }))}
                />
                <RatingRadioGroup
                  label="Übersichtlichkeit (1–5)"
                  value={newEvalForm.usability_rating}
                  onChange={(v) => setNewEvalForm((p) => ({ ...p, usability_rating: v }))}
                />
                <RatingRadioGroup
                  label="Gesamteindruck (1–5)"
                  value={newEvalForm.overall_rating}
                  onChange={(v) => setNewEvalForm((p) => ({ ...p, overall_rating: v }))}
                />

                <div className="grid gap-2">
                  <Label>Kommentar (optional)</Label>
                  <Textarea
                    value={newEvalForm.comment}
                    onChange={(e) => setNewEvalForm((p) => ({ ...p, comment: e.target.value }))}
                    placeholder="Notizen, Besonderheiten, Probleme…"
                    className="min-h-[80px]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveNew} className="gap-2">
                    <Save className="h-4 w-4" />
                    Speichern
                  </Button>
                  <Button variant="ghost" onClick={() => setNewEvalTaskId(null)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing Evaluations */}
      {evaluations.length === 0 && pendingTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Keine Bewertungen</h3>
            <p className="text-muted-foreground">Sobald du Aufträge bearbeitest, erscheinen hier deine Bewertungsbögen.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {evaluations.map((ev) => (
            <Card key={ev.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{ev.task.title}</CardTitle>
                    <CardDescription>
                      {ev.task.customer_name} • Bewertet am{' '}
                      {format(new Date(ev.updated_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Bewertet
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {editingId === ev.id ? (
                  <div className="space-y-4">
                    <RatingRadioGroup
                      label="Design (1–5)"
                      value={editForm.design_rating}
                      onChange={(v) => setEditForm((p) => ({ ...p, design_rating: v }))}
                    />
                    <RatingRadioGroup
                      label="Übersichtlichkeit (1–5)"
                      value={editForm.usability_rating}
                      onChange={(v) => setEditForm((p) => ({ ...p, usability_rating: v }))}
                    />
                    <RatingRadioGroup
                      label="Gesamteindruck (1–5)"
                      value={editForm.overall_rating}
                      onChange={(v) => setEditForm((p) => ({ ...p, overall_rating: v }))}
                    />
                    <div className="grid gap-2">
                      <Label>Kommentar</Label>
                      <Textarea
                        value={editForm.comment}
                        onChange={(e) => setEditForm((p) => ({ ...p, comment: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveEdit} size="sm" className="gap-2">
                        <Save className="h-4 w-4" />
                        Speichern
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Design</p>
                        <RatingStars value={ev.design_rating} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Übersichtlichkeit</p>
                        <RatingStars value={ev.usability_rating} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Gesamteindruck</p>
                        <RatingStars value={ev.overall_rating} />
                      </div>
                    </div>

                    {ev.comment && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Kommentar</p>
                          <p className="text-sm">{ev.comment}</p>
                        </div>
                      </>
                    )}

                    <div className="pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(ev)} className="gap-2">
                        <Edit2 className="h-3 w-3" />
                        Bearbeiten
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
