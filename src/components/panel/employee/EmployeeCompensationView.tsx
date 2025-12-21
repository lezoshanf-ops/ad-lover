import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Euro, Calendar, TrendingUp, CheckCircle2, Clock, ArrowUpRight, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CompletedTask {
  id: string;
  title: string;
  customer_name: string;
  special_compensation: number | null;
  status: string;
  reviewed_at: string | null;
  updated_at: string;
}

interface MonthlyData {
  month: string;
  year: number;
  monthIndex: number;
  tasks: CompletedTask[];
  total: number;
}

export default function EmployeeCompensationView() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalCompensation, setTotalCompensation] = useState(0);
  const [pendingCompensation, setPendingCompensation] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const exportToCsv = () => {
    const approvedTasks = tasks.filter(t => t.status === 'completed');
    if (approvedTasks.length === 0) {
      toast({ title: 'Keine Daten', description: 'Keine genehmigten Aufträge zum Exportieren.', variant: 'destructive' });
      return;
    }

    const headers = ['Datum', 'Auftrag', 'Kunde', 'Sondervergütung (€)'];
    const rows = approvedTasks.map(task => [
      format(parseISO(task.reviewed_at || task.updated_at), 'dd.MM.yyyy', { locale: de }),
      task.title,
      task.customer_name,
      task.special_compensation?.toFixed(2) || '0.00'
    ]);

    // Add total row
    rows.push(['', '', 'Gesamt:', totalCompensation.toFixed(2)]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sondervergütungen_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Export erfolgreich', description: 'Die CSV-Datei wurde heruntergeladen.' });
  };

  const exportToPdf = () => {
    const approvedTasks = tasks.filter(t => t.status === 'completed');
    if (approvedTasks.length === 0) {
      toast({ title: 'Keine Daten', description: 'Keine genehmigten Aufträge zum Exportieren.', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Sondervergütungen', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Erstellt am ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}`, 14, 30);

    // Table
    const tableData = approvedTasks.map(task => [
      format(parseISO(task.reviewed_at || task.updated_at), 'dd.MM.yyyy', { locale: de }),
      task.title,
      task.customer_name,
      `${task.special_compensation?.toFixed(2)} €`
    ]);

    autoTable(doc, {
      head: [['Datum', 'Auftrag', 'Kunde', 'Vergütung']],
      body: tableData,
      startY: 40,
      theme: 'striped',
      headStyles: { 
        fillColor: [220, 38, 38],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 10,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 60 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30, halign: 'right' }
      }
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY || 40;
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.setFont(undefined as any, 'bold');
    doc.text(`Gesamt: ${totalCompensation.toFixed(2)} €`, 14, finalY + 15);

    // Save
    doc.save(`sondervergütungen_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'Export erfolgreich', description: 'Die PDF-Datei wurde heruntergeladen.' });
  };

  useEffect(() => {
    if (user) {
      fetchCompensationData();
    }
  }, [user]);

  const fetchCompensationData = async () => {
    if (!user) return;

    // Get all assigned task IDs for this user
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('task_id')
      .eq('user_id', user.id);

    if (!assignments || assignments.length === 0) {
      setTasks([]);
      setMonthlyData([]);
      return;
    }

    const taskIds = assignments.map(a => a.task_id);

    // Fetch completed tasks with special compensation
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('id, title, customer_name, special_compensation, status, reviewed_at, updated_at')
      .in('id', taskIds)
      .in('status', ['completed', 'pending_review'])
      .not('special_compensation', 'is', null)
      .gt('special_compensation', 0)
      .order('updated_at', { ascending: false });

    if (completedTasks) {
      setTasks(completedTasks);
      
      // Calculate totals
      const approved = completedTasks.filter(t => t.status === 'completed');
      const pending = completedTasks.filter(t => t.status === 'pending_review');
      
      setTotalCompensation(approved.reduce((sum, t) => sum + (t.special_compensation || 0), 0));
      setPendingCompensation(pending.reduce((sum, t) => sum + (t.special_compensation || 0), 0));

      // Group by month
      const grouped: Record<string, MonthlyData> = {};
      
      completedTasks.forEach(task => {
        if (task.status !== 'completed') return; // Only count approved
        
        const date = parseISO(task.reviewed_at || task.updated_at);
        const monthKey = format(date, 'yyyy-MM');
        const monthName = format(date, 'MMMM', { locale: de });
        const year = date.getFullYear();
        const monthIndex = date.getMonth();
        
        if (!grouped[monthKey]) {
          grouped[monthKey] = {
            month: monthName,
            year,
            monthIndex,
            tasks: [],
            total: 0
          };
        }
        
        grouped[monthKey].tasks.push(task);
        grouped[monthKey].total += task.special_compensation || 0;
      });

      // Sort by date descending
      const sortedMonths = Object.values(grouped).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.monthIndex - a.monthIndex;
      });

      setMonthlyData(sortedMonths);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sondervergütungen</h2>
          <p className="text-muted-foreground">
            Übersicht deiner verrechneten Sondervergütungen
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportToCsv}
            variant="outline"
            disabled={tasks.filter(t => t.status === 'completed').length === 0}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
          <Button
            onClick={exportToPdf}
            disabled={tasks.filter(t => t.status === 'completed').length === 0}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gesamt verrechnet</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {totalCompensation.toFixed(2)} €
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ausstehend</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {pendingCompensation.toFixed(2)} €
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aufträge gesamt</p>
                <p className="text-3xl font-bold text-primary">
                  {tasks.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      {monthlyData.length > 0 ? (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Monatliche Übersicht</h3>
          
          {monthlyData.map((month) => (
            <Card key={`${month.year}-${month.monthIndex}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {month.month} {month.year}
                  </CardTitle>
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-lg px-3 py-1">
                    {month.total.toFixed(2)} €
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {month.tasks.map((task, idx) => (
                    <div key={task.id}>
                      {idx > 0 && <Separator className="my-3" />}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">{task.customer_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +{task.special_compensation?.toFixed(2)} €
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(task.reviewed_at || task.updated_at), 'dd.MM.yyyy', { locale: de })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Euro className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Keine Sondervergütungen</h3>
            <p className="text-muted-foreground">
              Du hast noch keine Aufträge mit Sondervergütung abgeschlossen.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending Tasks */}
      {tasks.filter(t => t.status === 'pending_review').length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Ausstehende Genehmigungen
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {tasks.filter(t => t.status === 'pending_review').map(task => (
              <Card key={task.id} className="border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">{task.customer_name}</p>
                    </div>
                    <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400">
                      {task.special_compensation?.toFixed(2)} €
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Wartet auf Genehmigung...</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
