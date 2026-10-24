import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { WebSocketEventMessage } from '../types';

interface WebSocketContextType {
  isConnected: boolean;
  lastEvent: WebSocketEventMessage['event'] | null;
  liveEventCount: number;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEventMessage['event'] | null>(null);
  const [liveEventCount, setLiveEventCount] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsConnected(false);
      return;
    }

    const connectWebSocket = () => {
      // Determine protocol and host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/ws/events?token=${token}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketEventMessage = JSON.parse(event.data);
          if (data.type === 'NEW_SECURITY_EVENT' && data.event) {
            setLastEvent(data.event);
            setLiveEventCount((prev) => prev + 1);
          }
        } catch {
          // ignore ping or non-json message
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (token) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();

    // Ping interval to keep connection alive
    const pingInterval = window.setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 25000);

    return () => {
      window.clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastEvent, liveEventCount }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
