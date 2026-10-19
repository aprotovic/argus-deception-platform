import React, { createContext, useContext, useEffect, useState } from 'react';
import type { NotificationItem, Severity } from '../types';
import { useWebSocket } from './WebSocketContext';

interface ToastItem extends NotificationItem {
  createdAt: number;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  toasts: ToastItem[];
  unreadCount: number;
  soundEnabled: boolean;
  investigationEventId: string | null;
  toggleSound: () => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setInvestigationEventId: (id: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API Sound Synthesizer (No external asset dependencies)
function playTacticalChime(severity: Severity) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (severity === 'critical') {
      // Urgent double-chirp alarm
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else if (severity === 'high') {
      // High-priority alert ping
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else {
      // Subtle tactical sonar blip
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch {
    // Audio context may be restricted by browser autoplay policy before first gesture
  }
}

// Request and dispatch desktop browser push notifications
function sendDesktopNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        tag: 'argus-event',
      });
    } catch {
      // Ignore notification errors
    }
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lastEvent } = useWebSocket();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('argus_sound_enabled') !== 'false';
  });
  const [investigationEventId, setInvestigationEventId] = useState<string | null>(null);

  // Keep a ref to soundEnabled to avoid re-triggering event listener when sound is toggled
  const soundEnabledRef = React.useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Track last handled event ID so events are never replayed upon state re-renders
  const lastHandledEventIdRef = React.useRef<string | null>(null);

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Listen for incoming WebSocket security events (fires strictly once per distinct event)
  useEffect(() => {
    if (!lastEvent || !lastEvent.id) return;
    if (lastEvent.id === lastHandledEventIdRef.current) return;
    lastHandledEventIdRef.current = lastEvent.id;

    const notifItem: NotificationItem = {
      id: `notif-${lastEvent.id}-${Date.now()}`,
      eventId: lastEvent.id,
      timestamp: lastEvent.timestamp,
      source_ip: lastEvent.source_ip,
      event_type: lastEvent.event_type,
      severity: lastEvent.severity,
      summary: lastEvent.summary || `${lastEvent.event_type.replace('_', ' ')} from ${lastEvent.source_ip}`,
      read: false,
    };

    // Prepend to persistent notification list (capped at 50)
    setNotifications((prev) => [notifItem, ...prev.slice(0, 49)]);

    // Add to active toast list (capped at 4 visible simultaneously)
    const toastItem: ToastItem = {
      ...notifItem,
      createdAt: Date.now(),
    };
    setToasts((prev) => [toastItem, ...prev.slice(0, 3)]);

    // Play tactical cyber alert chime if sound enabled
    if (soundEnabledRef.current) {
      playTacticalChime(lastEvent.severity);
    }

    // Trigger desktop OS notification if document is backgrounded
    if (document.hidden) {
      const title = `ARGUS SOC [${lastEvent.severity.toUpperCase()}] ${lastEvent.event_type.replace('_', ' ')}`;
      sendDesktopNotification(title, `${lastEvent.summary} (IP: ${lastEvent.source_ip})`);
    }
  }, [lastEvent]);

  // Auto-dismiss toasts after 6.5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.createdAt < 6500));
    }, 500);

    return () => clearInterval(timer);
  }, [toasts]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('argus_sound_enabled', String(next));
      if (next) {
        playTacticalChime('low');
      }
      return next;
    });
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    setToasts([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        unreadCount,
        soundEnabled,
        investigationEventId,
        toggleSound,
        dismissToast,
        markAsRead,
        markAllAsRead,
        clearAll,
        setInvestigationEventId,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
