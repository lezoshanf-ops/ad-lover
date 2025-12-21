import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TypingUser {
  id: string;
  name: string;
  isTyping: boolean;
}

interface UseTypingIndicatorProps {
  channelName: string;
  userId: string | undefined;
  userName: string;
  recipientId?: string | null;
}

export function useTypingIndicator({ 
  channelName, 
  userId, 
  userName, 
  recipientId 
}: UseTypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`typing-${channelName}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== userId) {
            const presence = presences[0] as any;
            if (presence?.isTyping) {
              users.push({
                id: key,
                name: presence.name || 'Jemand',
                isTyping: true,
              });
            }
          }
        });
        
        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: userName,
            isTyping: false,
            recipientId: recipientId || null,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [channelName, userId, userName, recipientId]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!channelRef.current || !userId || isTypingRef.current === isTyping) return;
    
    isTypingRef.current = isTyping;
    
    await channelRef.current.track({
      name: userName,
      isTyping,
      recipientId: recipientId || null,
    });
  }, [userId, userName, recipientId]);

  const handleTyping = useCallback(() => {
    setTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  }, [setTyping]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTyping(false);
  }, [setTyping]);

  return {
    typingUsers,
    handleTyping,
    stopTyping,
  };
}
