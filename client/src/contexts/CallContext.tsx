import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";

type CallStatus = "IDLE" | "RINGING" | "INITIATING" | "ACTIVE";

interface ActiveCall {
  withUserId: string;
  withUserName: string;
  isCaller: boolean;
}

interface CallContextType {
  callStatus: CallStatus;
  activeCall: ActiveCall | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  isMuted: boolean;
  // initiateCall is kept for direct programmatic use (called from server-triggered flow)
  initiateCall: (userId: string, userName: string) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

// PHASE 5: TURN/STUN config with env-var credentials.
// Set VITE_METERED_USERNAME and VITE_METERED_CREDENTIAL on Vercel for reliable NAT traversal.
// Falls back to STUN-only in dev/demo environments.
const buildIceServers = (): RTCConfiguration => {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];

  const turnUser = import.meta.env.VITE_METERED_USERNAME;
  const turnCred = import.meta.env.VITE_METERED_CREDENTIAL;

  if (turnUser && turnCred) {
    servers.push(
      {
        urls: "turn:global.relay.metered.ca:80",
        username: turnUser,
        credential: turnCred,
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: turnUser,
        credential: turnCred,
      },
      {
        urls: "turn:global.relay.metered.ca:443?transport=tcp",
        username: turnUser,
        credential: turnCred,
      }
    );
  }

  return { iceServers: servers };
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { toast } = useToast();

  const [callStatus, setCallStatus] = useState<CallStatus>("IDLE");
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);

  // PHASE 2 FIX: Keep a ref in sync with state so callbacks created at mount time
  // always read the current activeCall value, avoiding stale closures.
  const activeCallRef = useRef<ActiveCall | null>(null);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Also keep a ref to the socket for use inside PC callbacks
  const socketRef = useRef<any>(null);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // ─── CLEANUP ─────────────────────────────────────────────────────────────────
  const stopLocalStream = (stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  const closePeerConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.onicecandidate = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }
  };

  const cleanupCall = (showToast = false, toastMsg = "Call Ended") => {
    stopLocalStream(localStream);
    setLocalStream(null);
    closePeerConnection();
    setRemoteStream(null);
    setCallStatus("IDLE");
    setActiveCall(null);
    activeCallRef.current = null;
    setIsMuted(false);
    window.sessionStorage.removeItem("incoming_offer");
    if (showToast) {
      toast({ title: toastMsg });
    }
  };

  // ─── BUILD PEER CONNECTION ────────────────────────────────────────────────────
  const buildPeerConnection = (stream: MediaStream, targetUserId: string): RTCPeerConnection => {
    closePeerConnection(); // defensive: close any existing connection

    const pc = new RTCPeerConnection(buildIceServers());

    // PHASE 2 FIX: use targetUserId from closure (not from activeCallRef) because
    // this is always called with the right userId at creation time.
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.debug("[WebRTC] Sending ICE candidate to", targetUserId);
        socketRef.current.emit("webrtc_ice_candidate", {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.debug("[WebRTC] Remote track received");
      setRemoteStream(event.streams[0]);
    };

    // Log connection state changes for easier debugging
    pc.onconnectionstatechange = () => {
      console.debug("[WebRTC] Connection state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        console.warn("[WebRTC] Peer connection failed/disconnected — cleaning up");
        toast({ title: "Call disconnected", description: "The connection was lost.", variant: "destructive" });
        cleanupCall();
      }
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnection.current = pc;
    return pc;
  };

  // ─── SOCKET LISTENERS ────────────────────────────────────────────────────────
  // PHASE 3 FIX: Listen for "call_ready" — the new event the server fires when a
  // DB call request is accepted. This is the correct trigger for the in-browser
  // ringing/WebRTC flow (replaces the old immediate-call-on-button-click approach).
  useEffect(() => {
    if (!socket) return;

    // ── Initiated by SERVER after call-request acceptance ──
    // Event: "call_ready" — server fires this to both parties when DB request is accepted.
    // The caller receives it and immediately starts the WebRTC offer.
    // The callee receives it and shows the incoming RINGING screen.
    const handleCallReady = ({ from, name, role }: { from: string; name: string; role: "caller" | "callee" }) => {
      console.debug("[WebRTC] call_ready received, role:", role);

      if (role === "callee") {
        // Show incoming call screen — WebRTC offer will follow immediately
        setActiveCall({ withUserId: from, withUserName: name || "User", isCaller: false });
        setCallStatus("RINGING");
      } else if (role === "caller") {
        // Server confirmed callee accepted, now begin the WebRTC offer
        const callInfo = activeCallRef.current;
        if (!callInfo) return;
        setCallStatus("INITIATING");
        // kick off offer async
        _sendOffer(callInfo.withUserId).catch(console.error);
      }
    };

    // ── Incoming WebRTC offer (from the caller after call_ready) ──
    const handleIncomingCall = ({ signal, from, name }: any) => {
      console.debug("[WebRTC] incoming_call (offer) from:", from);

      // If already in a call, auto-decline
      const current = activeCallRef.current;
      if (current && current.withUserId !== from) {
        socketRef.current?.emit("call_declined", { to: from });
        return;
      }

      // Store offer in sessionStorage for acceptCall to consume
      window.sessionStorage.setItem("incoming_offer", JSON.stringify(signal));

      // Ensure we're in RINGING state (may already be from call_ready)
      if (callStatus === "IDLE" || !activeCallRef.current) {
        setActiveCall({ withUserId: from, withUserName: name || "User", isCaller: false });
        setCallStatus("RINGING");
      }
    };

    // ── Answer received by caller ──
    const handleCallAccepted = async ({ signal }: any) => {
      console.debug("[WebRTC] call_accepted (answer) received");
      setCallStatus("ACTIVE");
      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
        } catch (e) {
          console.error("[WebRTC] setRemoteDescription (answer) failed:", e);
        }
      }
    };

    // ── Remote party ended or declined ──
    const handleCallEnded = ({ reason }: any = {}) => {
      console.debug("[WebRTC] call_ended/call_declined received:", reason);
      cleanupCall(true, reason === "declined" ? "Call Declined" : "Call Ended");
    };

    // ── ICE candidates ──
    const handleIceCandidate = async ({ candidate }: any) => {
      if (peerConnection.current && candidate) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[WebRTC] addIceCandidate failed:", e);
        }
      }
    };

    socket.on("call_ready", handleCallReady);
    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_declined", (d: any) => handleCallEnded({ ...d, reason: "declined" }));
    socket.on("call_ended", handleCallEnded);
    socket.on("webrtc_ice_candidate", handleIceCandidate);

    return () => {
      socket.off("call_ready", handleCallReady);
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_declined", handleCallEnded);
      socket.off("call_ended", handleCallEnded);
      socket.off("webrtc_ice_candidate", handleIceCandidate);
    };
  // Only re-register when socket identity changes — NOT on callStatus change,
  // which would create/drop listeners on every state transition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ─── INTERNAL: send offer (caller side after call_ready) ─────────────────────
  const _sendOffer = async (targetUserId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setLocalStream(stream);

      const pc = buildPeerConnection(stream, targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.debug("[WebRTC] Sending offer to", targetUserId);
      socketRef.current?.emit("call_user", {
        userToCall: targetUserId,
        signalData: offer,
        from: user?.id,
        name: `${user?.firstName} ${user?.lastName}`,
      });
    } catch (err) {
      console.error("[WebRTC] Offer creation failed:", err);
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to make calls.",
        variant: "destructive",
      });
      cleanupCall();
    }
  };

  // ─── ACTIONS ─────────────────────────────────────────────────────────────────

  // initiateCall: called when the server-side "call_ready" flow wants to
  // programmatically start the caller side. Also usable directly if needed.
  const initiateCall = async (userId: string, userName: string) => {
    console.debug("[WebRTC] initiateCall →", userId);
    setActiveCall({ withUserId: userId, withUserName: userName, isCaller: true });
    setCallStatus("INITIATING");
    await _sendOffer(userId);
  };

  const acceptCall = async () => {
    const callInfo = activeCallRef.current;
    if (!callInfo) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setLocalStream(stream);

      const pc = buildPeerConnection(stream, callInfo.withUserId);

      const incomingOfferStr = window.sessionStorage.getItem("incoming_offer");
      if (!incomingOfferStr) {
        console.error("[WebRTC] acceptCall: no incoming offer in sessionStorage");
        return;
      }

      const offer = JSON.parse(incomingOfferStr);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      window.sessionStorage.removeItem("incoming_offer");

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.debug("[WebRTC] Sending answer to", callInfo.withUserId);
      socketRef.current?.emit("call_accepted", {
        signal: answer,
        to: callInfo.withUserId,
      });

      setCallStatus("ACTIVE");
    } catch (err) {
      console.error("[WebRTC] acceptCall failed:", err);
      toast({
        title: "Microphone Access Required",
        description: "Cannot accept call — please allow microphone access.",
        variant: "destructive",
      });
      declineCall();
    }
  };

  const declineCall = () => {
    const callInfo = activeCallRef.current;
    if (callInfo && socketRef.current) {
      socketRef.current.emit("call_declined", { to: callInfo.withUserId, reason: "declined" });
    }
    cleanupCall(false);
  };

  const endCall = () => {
    const callInfo = activeCallRef.current;
    if (callInfo && socketRef.current) {
      socketRef.current.emit("call_ended", { to: callInfo.withUserId });
    }
    cleanupCall(false);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted; // flip: if currently muted, re-enable
        setIsMuted(!isMuted);
      }
    }
  };

  return (
    <CallContext.Provider
      value={{
        callStatus,
        activeCall,
        remoteStream,
        localStream,
        isMuted,
        initiateCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
}
