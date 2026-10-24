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
    const safeCloseSocket = (socket: WebSocket | null) => {
      if (!socket) return;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => {
          try {
            socket.close();
          } catch {
            // ignore
          }
        };
      }
    };

    if (!token) {
      if (wsRef.current) {
        safeCloseSocket(wsRef.current);
        wsRef.current = null;
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

      ws.onclose = (event) => {
        setIsConnected(false);
        // If authentication failed (1008 Policy Violation), dispatch expired event instead of looping
        if (event.code === 1008) {
          window.dispatchEvent(new Event('argus_auth_expired'));
          return;
        }

        // Attempt reconnect after 3 seconds if token still present and not unmounted
        if (token && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            if (token) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    };

    connectWebSocket();

    // Ping interval to keep connection alive
    const pingInterval = window.setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 20000);

    return () => {
      window.clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        safeCloseSocket(wsRef.current);
        wsRef.current = null;
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
