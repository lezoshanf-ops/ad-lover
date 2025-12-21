import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type UserStatus = 'online' | 'away' | 'busy' | 'offline';

interface PresenceState {
  id: string;
  status: UserStatus;
  lastSeen: string;
}

interface UseUserPresenceProps {
  userId: string | undefined;
  userName: string;
  initialStatus?: UserStatus;
}

interface UseUserPresenceReturn {
  onlineUsers: Map<string, PresenceState>;
  getUserStatus: (userId: string) => UserStatus;
  getLastSeen: (userId: string) => string | null;
  setMyStatus: (status: UserStatus) => void;
}

export function useUserPresence({
  userId,
  userName,
  initialStatus = 'online'
}: UseUserPresenceProps): UseUserPresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceState>>(new Map());
  const [myStatus, setMyStatusState] = useState<UserStatus>(initialStatus);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Update database when status changes
  const updateDbStatus = useCallback(async (status: UserStatus) => {
    if (!userId) return;
    try {
      await supabase.rpc('update_user_status', { new_status: status });
    } catch (err) {
      console.error('Failed to update status in DB:', err);
    }
  }, [userId]);

  const setMyStatus = useCallback((status: UserStatus) => {
    setMyStatusState(status);
    updateDbStatus(status);
    
    // Also update presence
    if (channelRef.current && userId) {
      channelRef.current.track({
        id: userId,
        status,
        lastSeen: new Date().toISOString(),
        name: userName,
      });
    }
  }, [userId, userName, updateDbStatus]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('user-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = new Map<string, PresenceState>();
        
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as any;
            users.set(key, {
              id: key,
              status: presence.status || 'online',
              lastSeen: presence.lastSeen || new Date().toISOString(),
            });
          }
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (newPresences && newPresences.length > 0) {
          const presence = newPresences[0] as any;
          setOnlineUsers(prev => {
            const updated = new Map(prev);
            updated.set(key, {
              id: key,
              status: presence.status || 'online',
              lastSeen: presence.lastSeen || new Date().toISOString(),
            });
            return updated;
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const updated = new Map(prev);
          updated.delete(key);
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our own presence
          await channel.track({
            id: userId,
            status: myStatus,
            lastSeen: new Date().toISOString(),
            name: userName,
          });
          
          // Update DB status to online when connected
          updateDbStatus(myStatus);
        }
      });

    channelRef.current = channel;

    // Heartbeat to keep presence alive and update lastSeen
    heartbeatRef.current = setInterval(async () => {
      if (channelRef.current) {
        await channelRef.current.track({
          id: userId,
          status: myStatus,
          lastSeen: new Date().toISOString(),
          name: userName,
        });
      }
    }, 30000); // Every 30 seconds

    // Inactivity detection - set to 'away' after 5 minutes
    let inactivityTimeout: NodeJS.Timeout | null = null;
    let lastActivity = Date.now();

    const resetInactivityTimer = () => {
      lastActivity = Date.now();
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
      }
      // If we're away due to inactivity, set back to online
      if (myStatus === 'away') {
        setMyStatusState('online');
        updateDbStatus('online');
        if (channelRef.current) {
          channelRef.current.track({
            id: userId,
            status: 'online',
            lastSeen: new Date().toISOString(),
            name: userName,
          });
        }
      }
      // Set timeout for 5 minutes
      inactivityTimeout = setTimeout(() => {
        if (myStatus === 'online') {
          setMyStatusState('away');
          updateDbStatus('away');
          if (channelRef.current) {
            channelRef.current.track({
              id: userId,
              status: 'away',
              lastSeen: new Date().toISOString(),
              name: userName,
            });
          }
        }
      }, 5 * 60 * 1000); // 5 minutes
    };

    // Activity events to track
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    // Start initial timer
    resetInactivityTimer();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched tab - set to away after a short delay
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
          if (myStatus === 'online') {
            setMyStatusState('away');
            updateDbStatus('away');
            if (channelRef.current) {
              channelRef.current.track({
                id: userId,
                status: 'away',
                lastSeen: new Date().toISOString(),
                name: userName,
              });
            }
          }
        }, 60000); // 1 minute when tab hidden
      } else {
        // User came back - reset to online
        resetInactivityTimer();
        if (channelRef.current) {
          channelRef.current.track({
            id: userId,
            status: 'online',
            lastSeen: new Date().toISOString(),
            name: userName,
          });
        }
      }
    };

    // Handle before unload - set offline
    const handleBeforeUnload = () => {
      updateDbStatus('offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
      }
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Set offline in DB before leaving
      updateDbStatus('offline');
      
      supabase.removeChannel(channel);
    };
  }, [userId, userName, myStatus, updateDbStatus]);

  const getUserStatus = useCallback((targetUserId: string): UserStatus => {
    const presence = onlineUsers.get(targetUserId);
    if (!presence) return 'offline';
    
    // Check if lastSeen is recent (within 60 seconds)
    const lastSeen = new Date(presence.lastSeen);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
    
    if (diffSeconds > 60) {
      return 'offline';
    }
    
    return presence.status;
  }, [onlineUsers]);

  const getLastSeen = useCallback((targetUserId: string): string | null => {
    const presence = onlineUsers.get(targetUserId);
    if (!presence) return null;
    return presence.lastSeen;
  }, [onlineUsers]);

  return {
    onlineUsers,
    getUserStatus,
    getLastSeen,
    setMyStatus,
  };
}
