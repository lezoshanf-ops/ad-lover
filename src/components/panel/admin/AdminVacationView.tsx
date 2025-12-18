import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VacationRequest, Profile, RequestStatus } from '@/types/panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, CheckCircle, XCircle, Clock, User } from 'lucide-react';
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

export default function AdminVacationView() {
  const [requests, setRequests] = useState<(VacationRequest & { profile?: Profile })[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('vacation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      const enrichedData = data.map(request => ({
        ...request,
        status: request.status as RequestStatus,
        profile: profiles?.find(p => p.user_id === request.user_id) as Profile | undefined
      }));

      setRequests(enrichedData);
    }
  };

  const handleReview = async (status: RequestStatus) => {
    if (!selectedRequest) return;

    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null
      })
      .eq('id', selectedRequest.id);

    if (error) {
      toast({ title: 'Fehler', description: 'Antrag konnte nicht bearbeitet werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: `Antrag wurde ${status === 'approved' ? 'genehmigt' : 'abgelehnt'}.` });
      setIsDialogOpen(false);
      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Urlaubsanträge</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-500" />
          Ausstehende Anträge ({pendingRequests.length})
        </h3>

        {pendingRequests.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine ausstehenden Urlaubsanträge.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingRequests.map((request) => {
              const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
              return (
                <Card key={request.id} className="shadow-card border-l-4 border-l-yellow-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {request.profile?.first_name} {request.profile?.last_name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(request.start_date), 'dd.MM.yyyy', { locale: de })} - {format(new Date(request.end_date), 'dd.MM.yyyy', { locale: de })}
                          <span className="ml-2">({days} {days === 1 ? 'Tag' : 'Tage'})</span>
                        </p>
                      </div>
                      <Badge className={statusColors.pending}>
                        {statusLabels.pending}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {request.reason && (
                      <p className="text-sm text-muted-foreground mb-4">
                        <strong>Grund:</strong> {request.reason}
                      </p>
                    )}
                    <Button
                      onClick={() => {
                        setSelectedRequest(request);
                        setIsDialogOpen(true);
                      }}
                    >
                      Bearbeiten
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Bearbeitete Anträge ({processedRequests.length})</h3>
        <div className="grid gap-4">
          {processedRequests.map((request) => {
            const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
            return (
              <Card key={request.id} className="shadow-card opacity-75">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {request.profile?.first_name} {request.profile?.last_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.start_date), 'dd.MM.yyyy', { locale: de })} - {format(new Date(request.end_date), 'dd.MM.yyyy', { locale: de })}
                        ({days} {days === 1 ? 'Tag' : 'Tage'})
                      </p>
                    </div>
                    <Badge className={statusColors[request.status]}>
                      {statusLabels[request.status]}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Urlaubsantrag bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p><strong>Mitarbeiter:</strong> {selectedRequest?.profile?.first_name} {selectedRequest?.profile?.last_name}</p>
              <p><strong>Zeitraum:</strong> {selectedRequest && format(new Date(selectedRequest.start_date), 'dd.MM.yyyy', { locale: de })} - {selectedRequest && format(new Date(selectedRequest.end_date), 'dd.MM.yyyy', { locale: de })}</p>
              {selectedRequest?.reason && <p><strong>Grund:</strong> {selectedRequest.reason}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Anmerkung (optional)</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Optionale Anmerkung..."
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => handleReview('rejected')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Ablehnen
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleReview('approved')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Genehmigen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
