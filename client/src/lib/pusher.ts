import Pusher from "pusher-js";

// Enable logging in development
if (import.meta.env.DEV) {
  Pusher.logToConsole = true;
}

export const pusher = new Pusher(
  import.meta.env.VITE_PUSHER_KEY || "",
  {
    cluster: import.meta.env.VITE_PUSHER_CLUSTER || "mt1",
    forceTLS: true,
    userAuthentication: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  }
);
