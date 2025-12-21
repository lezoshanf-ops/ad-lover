import { useState, useEffect, useCallback } from 'react';

// Simple event emitter for avatar updates
const avatarUpdateListeners: Set<() => void> = new Set();

export const triggerAvatarRefresh = () => {
  avatarUpdateListeners.forEach(listener => listener());
};

export const useAvatarRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    avatarUpdateListeners.add(refresh);
    return () => {
      avatarUpdateListeners.delete(refresh);
    };
  }, [refresh]);

  return refreshKey;
};
