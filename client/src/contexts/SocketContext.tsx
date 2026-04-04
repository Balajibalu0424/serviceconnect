import React, { createContext, useContext, useEffect, useState } from "react";
import { pusher } from "@/lib/pusher";
import { useAuth } from "./AuthContext";
import { getAccessToken } from "@/lib/queryClient";

interface SocketContextType {
  socket: any; // Keep name for compatibility, but it's now a Pusher instance or a proxy
  isConnected: boolean;
  pusher: any;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  pusher: null,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Pusher handles connection automatically
      const handleConnectionChange = () => {
        setIsConnected(pusher.connection.state === 'connected');
      };

      pusher.connection.bind('state_change', handleConnectionChange);
      
      // Initial state
      setIsConnected(pusher.connection.state === 'connected');

      // Authenticate user with Pusher
      pusher.signin();

      return () => {
        pusher.connection.unbind('state_change', handleConnectionChange);
      };
    } else {
      setIsConnected(false);
    }
  }, [isAuthenticated, user?.id]);

  // Use a ref to keep track of subscriptions to avoid memory leaks or redundant binds
  const subscriptions = React.useRef<Record<string, any>>({});

  const socketProxy = React.useMemo(() => ({
    on: (event: string, callback: (...args: any[]) => void) => {
      if (!user) return;
      const channelName = `private-user-${user.id}`;
      // Subscribe if not already subscribed
      if (!subscriptions.current[channelName]) {
        subscriptions.current[channelName] = pusher.subscribe(channelName);
      }
      subscriptions.current[channelName].bind(event, callback);
    },
    off: (event: string, callback: (...args: any[]) => void) => {
      if (!user) return;
      const channelName = `private-user-${user.id}`;
      const channel = subscriptions.current[channelName];
      if (channel) {
        channel.unbind(event, callback);
      }
    },
    // PHASE 1 FIX: Attach JWT Authorization header so /api/pusher/trigger 
    // (protected by requireAuth) stops returning 401 and silently dropping all WebRTC signals.
    emit: async (event: string, data: any) => {
      const token = getAccessToken();
      if (!token) {
        console.warn(`[SocketProxy] emit(${event}) skipped — no access token`);
        return;
      }

      const targetUserId = data.to || data.userToCall;
      if (!targetUserId) {
        console.warn(`[SocketProxy] emit(${event}) skipped — no target userId in`, data);
        return;
      }

      try {
        const res = await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,   // ← THE FIX
          },
          body: JSON.stringify({
            to: targetUserId,
            event: event,
            data: { ...data, from: user?.id }
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[SocketProxy] emit(${event}) failed ${res.status}:`, errText);
        }
      } catch (err) {
        console.error(`[SocketProxy] emit(${event}) network error:`, err);
      }
    }
  }), [user?.id]);

  return (
    <SocketContext.Provider value={{ socket: socketProxy, isConnected, pusher }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
