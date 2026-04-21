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
      headersProvider: authHeaders,
    },
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
      headersProvider: authHeaders,
    },
  }
);
