import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Star, Download, Search, RefreshCcw, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Evaluation {
  id: string;
  task_id: string;
  user_id: string;
  design_rating: number;
  usability_rating: number;
  overall_rating: number;
  comment: string | null;
  created_at: string;
  task?: {
    title: string;
    customer_name: string;
  };
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

export default function AdminEvaluationsView() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const { data: evals, error } = await supabase
        .from('task_evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (evals && evals.length > 0) {
        const taskIds = [...new Set(evals.map(e => e.task_id))];
        const userIds = [...new Set(evals.map(e => e.user_id))];

        const [tasksRes, profilesRes] = await Promise.all([
          supabase.from('tasks').select('id, title, customer_name').in('id', taskIds),
          supabase.from('profiles').select('user_id, first_name, last_name, email').in('user_id', userIds)
        ]);

        const enriched = evals.map(ev => ({
          ...ev,
          task: tasksRes.data?.find(t => t.id === ev.task_id),
          profile: profilesRes.data?.find(p => p.user_id === ev.user_id)
        }));

        setEvaluations(enriched);
      } else {
        setEvaluations([]);
      }
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      toast({
        title: 'Fehler',
        description: 'Bewertungen konnten nicht geladen werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredEvaluations = evaluations.filter(ev => {
    const search = searchQuery.toLowerCase();
    return (
      ev.task?.title?.toLowerCase().includes(search) ||
      ev.task?.customer_name?.toLowerCase().includes(search) ||
      ev.profile?.first_name?.toLowerCase().includes(search) ||
      ev.profile?.last_name?.toLowerCase().includes(search) ||
      ev.comment?.toLowerCase().includes(search)
    );
  });

  const exportToCsv = () => {
    const headers = ['Datum', 'Mitarbeiter', 'Auftrag', 'Kunde', 'Design', 'Usability', 'Gesamt', 'Kommentar'];
    const rows = filteredEvaluations.map(ev => [
      format(new Date(ev.created_at), 'dd.MM.yyyy HH:mm', { locale: de }),
      `${ev.profile?.first_name || ''} ${ev.profile?.last_name || ''}`.trim() || 'Unbekannt',
      ev.task?.title || 'Unbekannt',
      ev.task?.customer_name || 'Unbekannt',
      ev.design_rating.toString(),
      ev.usability_rating.toString(),
      ev.overall_rating.toString(),
      ev.comment || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bewertungen_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export erfolgreich',
      description: `${filteredEvaluations.length} Bewertungen exportiert.`
    });
  };

  const avgDesign = evaluations.length > 0 
    ? (evaluations.reduce((acc, ev) => acc + ev.design_rating, 0) / evaluations.length).toFixed(1)
    : '0.0';
  const avgUsability = evaluations.length > 0
    ? (evaluations.reduce((acc, ev) => acc + ev.usability_rating, 0) / evaluations.length).toFixed(1)
    : '0.0';
  const avgOverall = evaluations.length > 0
    ? (evaluations.reduce((acc, ev) => acc + ev.overall_rating, 0) / evaluations.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bewertungen</h2>
          <p className="text-muted-foreground">
            Alle Mitarbeiterbewertungen übersichtlich verwalten und exportieren.
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
          <Button variant="outline" onClick={fetchEvaluations} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Aktualisieren
          </Button>
          <Button onClick={exportToCsv} className="gap-2" disabled={filteredEvaluations.length === 0}>
            <Download className="h-4 w-4" />
            CSV Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt Bewertungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ø Design</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <div className="text-2xl font-bold">{avgDesign}</div>
            <StarRating rating={Math.round(parseFloat(avgDesign))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ø Usability</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <div className="text-2xl font-bold">{avgUsability}</div>
            <StarRating rating={Math.round(parseFloat(avgUsability))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ø Gesamt</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <div className="text-2xl font-bold">{avgOverall}</div>
            <StarRating rating={Math.round(parseFloat(avgOverall))} />
          </CardContent>
        </Card>
      </div>

      {/* Evaluations Table */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Bewertungen werden geladen...</p>
          </CardContent>
        </Card>
      ) : filteredEvaluations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Keine Bewertungen</h3>
            <p className="text-muted-foreground">
              {evaluations.length > 0
                ? 'Keine Bewertungen gefunden für die aktuelle Suche.'
                : 'Es wurden noch keine Bewertungen abgegeben.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Auftrag</TableHead>
                  <TableHead>Design</TableHead>
                  <TableHead>Usability</TableHead>
                  <TableHead>Gesamt</TableHead>
                  <TableHead>Kommentar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvaluations.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(ev.created_at), 'dd.MM.yyyy', { locale: de })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {ev.profile?.first_name} {ev.profile?.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{ev.profile?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium line-clamp-1">{ev.task?.title}</div>
                        <div className="text-xs text-muted-foreground">{ev.task?.customer_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StarRating rating={ev.design_rating} />
                    </TableCell>
                    <TableCell>
                      <StarRating rating={ev.usability_rating} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {ev.overall_rating}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ev.comment || '-'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
