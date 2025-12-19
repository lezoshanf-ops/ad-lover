import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VacationRequest, RequestStatus } from '@/types/panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Plus, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

const statusColors: Record<RequestStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  approved: 'bg-green-500/20 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/20 text-red-700 dark:text-red-400'
};

const statusLabels: Record<RequestStatus, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt'
};

export default function EmployeeVacationView() {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [newRequest, setNewRequest] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setRequests(data.map(r => ({ ...r, status: r.status as RequestStatus })) as VacationRequest[]);
    }
  };

  const handleSubmit = async () => {
    if (!newRequest.start_date || !newRequest.end_date) {
      toast({ title: 'Fehler', description: 'Bitte Start- und Enddatum angeben.', variant: 'destructive' });
      return;
    }

    if (new Date(newRequest.end_date) < new Date(newRequest.start_date)) {
      toast({ title: 'Fehler', description: 'Enddatum muss nach Startdatum liegen.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('vacation_requests').insert({
      user_id: user?.id,
      start_date: newRequest.start_date,
      end_date: newRequest.end_date,
      reason: newRequest.reason || null
    });

    if (error) {
      toast({ title: 'Fehler', description: 'Antrag konnte nicht erstellt werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Urlaubsantrag wurde eingereicht.' });
      setIsDialogOpen(false);
      setNewRequest({ start_date: '', end_date: '', reason: '' });
      fetchRequests();
    }
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('vacation_requests').delete().eq('id', id);

    if (error) {
      toast({ title: 'Fehler', description: 'Antrag konnte nicht storniert werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Antrag wurde storniert.' });
      fetchRequests();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Urlaub & Anträge</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Neuer Antrag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Urlaubsantrag stellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Von *</Label>
                  <Input
                    type="date"
                    value={newRequest.start_date}
                    onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bis *</Label>
                  <Input
                    type="date"
                    value={newRequest.end_date}
                    onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Grund (optional)</Label>
                <Textarea
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                  placeholder="z.B. Familienurlaub..."
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">Antrag einreichen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine Urlaubsanträge vorhanden.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
            return (
              <Card key={request.id} className="shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">
                        {format(new Date(request.start_date), 'dd.MM.yyyy', { locale: de })} - {format(new Date(request.end_date), 'dd.MM.yyyy', { locale: de })}
                      </CardTitle>
                    </div>
                    <Badge variant="status" className={statusColors[request.status]}>
                      {statusLabels[request.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {days} {days === 1 ? 'Tag' : 'Tage'}
                  </p>
                  {request.reason && (
                    <p className="text-sm text-muted-foreground mb-3">
                      <strong>Grund:</strong> {request.reason}
                    </p>
                  )}
                  {request.review_notes && (
                    <p className="text-sm text-muted-foreground mb-3">
                      <strong>Anmerkung:</strong> {request.review_notes}
                    </p>
                  )}
                  {request.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleCancel(request.id)}
                    >
                      Stornieren
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
