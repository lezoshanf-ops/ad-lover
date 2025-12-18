import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TimeEntry, TimeEntryType } from '@/types/panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Clock, Play, Pause, Square, Coffee } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const entryTypeLabels: Record<TimeEntryType, string> = {
  check_in: 'Eingestempelt',
  check_out: 'Ausgestempelt',
  pause_start: 'Pause gestartet',
  pause_end: 'Pause beendet'
};

const entryTypeIcons: Record<TimeEntryType, React.ReactNode> = {
  check_in: <Play className="h-4 w-4" />,
  check_out: <Square className="h-4 w-4" />,
  pause_start: <Coffee className="h-4 w-4" />,
  pause_end: <Play className="h-4 w-4" />
};

export default function EmployeeTimeView() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<'out' | 'in' | 'paused'>('out');
  const [todayWorkTime, setTodayWorkTime] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user]);

  const fetchEntries = async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', today.toISOString())
      .order('timestamp', { ascending: false });

    if (data) {
      setEntries(data as TimeEntry[]);
      calculateStatus(data as TimeEntry[]);
      calculateWorkTime(data as TimeEntry[]);
    }
  };

  const calculateStatus = (entries: TimeEntry[]) => {
    if (entries.length === 0) {
      setCurrentStatus('out');
      return;
    }

    const latestEntry = entries[0];
    switch (latestEntry.entry_type) {
      case 'check_in':
      case 'pause_end':
        setCurrentStatus('in');
        break;
      case 'pause_start':
        setCurrentStatus('paused');
        break;
      case 'check_out':
        setCurrentStatus('out');
        break;
    }
  };

  const calculateWorkTime = (entries: TimeEntry[]) => {
    let totalMs = 0;
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let checkInTime: Date | null = null;
    let pauseStartTime: Date | null = null;
    let pauseDuration = 0;

    for (const entry of sortedEntries) {
      const timestamp = new Date(entry.timestamp);
      
      switch (entry.entry_type) {
        case 'check_in':
          checkInTime = timestamp;
          pauseDuration = 0;
          break;
        case 'check_out':
          if (checkInTime) {
            totalMs += timestamp.getTime() - checkInTime.getTime() - pauseDuration;
            checkInTime = null;
          }
          break;
        case 'pause_start':
          pauseStartTime = timestamp;
          break;
        case 'pause_end':
          if (pauseStartTime) {
            pauseDuration += timestamp.getTime() - pauseStartTime.getTime();
            pauseStartTime = null;
          }
          break;
      }
    }

    // If still checked in, calculate time until now
    if (checkInTime) {
      const now = new Date();
      let currentPause = 0;
      if (pauseStartTime) {
        currentPause = now.getTime() - pauseStartTime.getTime();
      }
      totalMs += now.getTime() - checkInTime.getTime() - pauseDuration - currentPause;
    }

    setTodayWorkTime(totalMs);
  };

  const handleTimeEntry = async (type: TimeEntryType) => {
    if (!user) return;

    const { error } = await supabase.from('time_entries').insert({
      user_id: user.id,
      entry_type: type
    });

    if (error) {
      toast({ title: 'Fehler', description: 'Zeiterfassung fehlgeschlagen.', variant: 'destructive' });
    } else {
      const messages: Record<TimeEntryType, string> = {
        check_in: 'Erfolgreich eingestempelt!',
        check_out: 'Erfolgreich ausgestempelt!',
        pause_start: 'Pause gestartet.',
        pause_end: 'Pause beendet.'
      };
      toast({ title: 'Erfolg', description: messages[type] });
      fetchEntries();
    }
  };

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Zeiterfassung</h2>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Aktueller Status</span>
            <Badge className={
              currentStatus === 'in' ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
              currentStatus === 'paused' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
              'bg-gray-500/20 text-gray-700 dark:text-gray-400'
            }>
              {currentStatus === 'in' ? 'Eingestempelt' : currentStatus === 'paused' ? 'Pause' : 'Ausgestempelt'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Arbeitszeit heute</p>
              <p className="text-4xl font-bold flex items-center justify-center gap-2">
                <Clock className="h-8 w-8" />
                {formatTime(todayWorkTime)}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {currentStatus === 'out' && (
                <Button size="lg" onClick={() => handleTimeEntry('check_in')} className="gap-2">
                  <Play className="h-5 w-5" />
                  Einstempeln
                </Button>
              )}
              {currentStatus === 'in' && (
                <>
                  <Button size="lg" variant="outline" onClick={() => handleTimeEntry('pause_start')} className="gap-2">
                    <Coffee className="h-5 w-5" />
                    Pause starten
                  </Button>
                  <Button size="lg" variant="destructive" onClick={() => handleTimeEntry('check_out')} className="gap-2">
                    <Square className="h-5 w-5" />
                    Ausstempeln
                  </Button>
                </>
              )}
              {currentStatus === 'paused' && (
                <>
                  <Button size="lg" onClick={() => handleTimeEntry('pause_end')} className="gap-2">
                    <Play className="h-5 w-5" />
                    Pause beenden
                  </Button>
                  <Button size="lg" variant="destructive" onClick={() => handleTimeEntry('check_out')} className="gap-2">
                    <Square className="h-5 w-5" />
                    Ausstempeln
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Heutige Einträge</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Keine Einträge für heute.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      entry.entry_type === 'check_in' ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                      entry.entry_type === 'check_out' ? 'bg-red-500/20 text-red-700 dark:text-red-400' :
                      'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {entryTypeIcons[entry.entry_type]}
                    </div>
                    <span className="font-medium">{entryTypeLabels[entry.entry_type]}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(entry.timestamp), 'HH:mm', { locale: de })} Uhr
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
