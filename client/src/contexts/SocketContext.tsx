import React, { createContext, useContext, useEffect, useState } from "react";
import { pusher } from "@/lib/pusher";
import { useAuth } from "./AuthContext";
import { getAuthHeaders } from "@/lib/queryClient";

interface SocketContextType {
  socket: any;
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
      const handleConnectionChange = () => {
        setIsConnected(pusher.connection.state === "connected");
      };

      pusher.connection.bind("state_change", handleConnectionChange);
      setIsConnected(pusher.connection.state === "connected");
      pusher.signin();

      return () => {
        pusher.connection.unbind("state_change", handleConnectionChange);
      };
    }

    setIsConnected(false);
  }, [isAuthenticated, user?.id]);

  const subscriptions = React.useRef<Record<string, any>>({});

  const socketProxy = React.useMemo(
    () => ({
      on: (event: string, callback: (...args: any[]) => void) => {
        if (!user) return;
        const channelName = `private-user-${user.id}`;
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
        const targetUserId = data.to || data.userToCall;
        if (!targetUserId) {
          console.warn(`[SocketProxy] emit(${event}) skipped - no target userId in`, data);
          return;
        }

        try {
          const res = await fetch("/api/pusher/trigger", {
            method: "POST",
            headers: await getAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              to: targetUserId,
              event,
              data: { ...data, from: user?.id },
            }),
            credentials: "include",
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error(`[SocketProxy] emit(${event}) failed ${res.status}:`, errText);
          }
        } catch (err) {
          console.error(`[SocketProxy] emit(${event}) network error:`, err);
        }
      },
    }),
    [user?.id],
  );

  return (
    <SocketContext.Provider value={{ socket: socketProxy, isConnected, pusher }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
