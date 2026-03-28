import React, { createContext, useContext, useEffect, useState } from "react";
import { pusher } from "@/lib/pusher";
import { useAuth } from "./AuthContext";

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
    emit: async (event: string, data: any) => {
      // Client cannot emit directly to others in Pusher private channels for security
      // We use our server-side proxy
      try {
        await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: `private-user-${data.to || data.userToCall}`,
            event: event,
            data: { ...data, from: user?.id }
          })
        });
      } catch (err) {
        console.error("Pusher emit failed", err);
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
