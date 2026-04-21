import Pusher from "pusher-js";
import { getAccessToken } from "./queryClient";

// Enable logging in development
if (import.meta.env.DEV) {
  Pusher.logToConsole = true;
}

// Build auth headers that include the JWT Bearer token
const authHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const pusher = new Pusher(
  import.meta.env.VITE_PUSHER_KEY || "",
  {
    cluster: import.meta.env.VITE_PUSHER_CLUSTER || "eu",
    forceTLS: true,
    userAuthentication: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
      headers: authHeaders(),
    },
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
      headers: authHeaders(),
    },
  }
);

// Update auth headers dynamically when token changes (after login/refresh)
const originalSubscribe = pusher.subscribe.bind(pusher);
pusher.subscribe = (channelName: string) => {
  // Refresh headers before each subscription to pick up latest token
  const token = getAccessToken();
  if (token) {
    (pusher.config as any).channelAuthorization.headers = { Authorization: `Bearer ${token}` };
    (pusher.config as any).userAuthentication.headers = { Authorization: `Bearer ${token}` };
  }
  return originalSubscribe(channelName);
};
