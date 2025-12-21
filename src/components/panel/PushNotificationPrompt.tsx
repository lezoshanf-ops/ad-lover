import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

export function PushNotificationPrompt() {
  const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Don't show if not supported or already granted
  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isSubscribed) {
        const success = await unsubscribe();
        if (success) {
          toast({
            title: 'Benachrichtigungen deaktiviert',
            description: 'Sie erhalten keine Push-Benachrichtigungen mehr.',
          });
        }
      } else {
        const success = await subscribe();
        if (success) {
          toast({
            title: 'Benachrichtigungen aktiviert',
            description: 'Sie erhalten jetzt Push-Benachrichtigungen für neue Nachrichten.',
          });
        } else if (permission === 'denied') {
          toast({
            title: 'Berechtigung verweigert',
            description: 'Bitte erlauben Sie Benachrichtigungen in Ihren Browser-Einstellungen.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Toggle push failed:', error);
      toast({
        title: 'Fehler',
        description: 'Push-Benachrichtigungen konnten nicht geändert werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={loading}
      title={isSubscribed ? 'Push-Benachrichtigungen deaktivieren' : 'Push-Benachrichtigungen aktivieren'}
      className={isSubscribed ? 'text-primary' : 'text-muted-foreground'}
    >
      {isSubscribed ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
    </Button>
  );
}
