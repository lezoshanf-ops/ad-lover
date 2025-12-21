import { useCallback, useEffect, useState } from 'react';
import { useNotificationSettings } from './useNotificationSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Simple Base64 URL encode/decode for VAPID keys
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Public VAPID key - this is safe to expose
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { settings } = useNotificationSettings();
  const { user } = useAuth();

  // Register service worker and check subscription status
  useEffect(() => {
    const init = async () => {
      // Check if notifications and service workers are supported
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }
      
      setIsSupported(true);
      setPermission(Notification.permission);
      
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', reg);
        setRegistration(reg);
        
        // Check if already subscribed
        const subscription = await reg.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
        
        // If subscribed and user is logged in, ensure DB is up to date
        if (subscription && user) {
          await saveSubscription(subscription);
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };
    
    init();
  }, [user]);

  // Save subscription to database
  const saveSubscription = async (subscription: PushSubscription) => {
    if (!user) return;
    
    const subscriptionJson = subscription.toJSON();
    const keys = subscriptionJson.keys as { p256dh: string; auth: string };
    
    try {
      // Upsert subscription (update if exists, insert if not)
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,endpoint'
        });
      
      if (error) {
        console.error('Failed to save push subscription:', error);
      } else {
        console.log('Push subscription saved successfully');
      }
    } catch (e) {
      console.error('Error saving subscription:', e);
    }
  };

  // Remove subscription from database
  const removeSubscription = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
    } catch (e) {
      console.error('Error removing subscription:', e);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.warn('Could not request notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!registration || !user) return false;
    
    try {
      // First ensure we have permission
      if (Notification.permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return false;
      }
      
      // Subscribe to push notifications
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });
      
      console.log('Push subscription created:', subscription);
      
      // Save to database
      await saveSubscription(subscription);
      setIsSubscribed(true);
      
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      return false;
    }
  }, [registration, user, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;
    
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      await removeSubscription();
      setIsSubscribed(false);
      
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }, [registration]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    // Check if push notifications are enabled in settings
    if (!settings.pushEnabled) {
      return null;
    }

    if (!isSupported || permission !== 'granted') {
      console.log('Notifications not available or not permitted');
      return null;
    }

    try {
      // Use service worker to show notification (works in background)
      if (registration) {
        registration.showNotification(title, {
          icon: '/favicon.png',
          badge: '/favicon.png',
          tag: 'chat-notification',
          ...options,
        });
        return null;
      }
      
      // Fallback to regular notification
      const notification = new Notification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Focus window when clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.warn('Could not show notification:', error);
      return null;
    }
  }, [isSupported, permission, settings.pushEnabled, registration]);

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
  };
}
