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
  initiateCall: (userId: string, userName: string) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
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

  // Initialize RTCPeerConnection and bind local stream
  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && activeCall?.withUserId && socket) {
        socket.emit("webrtc_ice_candidate", {
          to: activeCall.withUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    peerConnection.current = pc;
    return pc;
  };

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setRemoteStream(null);
    setCallStatus("IDLE");
    setActiveCall(null);
    setIsMuted(false);
  };

  // ─── SOCKET LISTENERS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Incoming Call Handle
    const handleIncomingCall = ({ signal, from, name }: any) => {
      if (callStatus !== "IDLE") {
        // Busy
        socket.emit("call_declined", { to: from });
        return;
      }
      setActiveCall({ withUserId: from, withUserName: name || "User", isCaller: false });
      setCallStatus("RINGING");
      // Store incoming offer temporarily
      window.sessionStorage.setItem("incoming_offer", JSON.stringify(signal));
    };

    // Call Accepted Handle
    const handleCallAccepted = async ({ signal }: any) => {
      setCallStatus("ACTIVE");
      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
        } catch (e) {
          console.error("Failed to set remote description", e);
        }
      }
    };

    // Peer Declined/Ended Handle
    const handleCallEnded = () => {
      toast({ title: "Call Ended", description: "The other user ended the call." });
      cleanupCall();
    };

    // ICE Candidate handler
    const handleIceCandidate = async ({ candidate }: any) => {
      if (peerConnection.current && candidate) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Failed to add ice candidate", e);
        }
      }
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_declined", handleCallEnded);
    socket.on("call_ended", handleCallEnded);
    socket.on("webrtc_ice_candidate", handleIceCandidate);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_declined", handleCallEnded);
      socket.off("call_ended", handleCallEnded);
      socket.off("webrtc_ice_candidate", handleIceCandidate);
    };
  }, [socket, callStatus, activeCall, toast]);


  // ─── ACTIONS ─────────────────────────────────────────────────────────────────
  const initiateCall = async (userId: string, userName: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setLocalStream(stream);
      setCallStatus("INITIATING");
      setActiveCall({ withUserId: userId, withUserName: userName, isCaller: true });

      // Need to wait for states to flush before creating PC. 
      // Instead, we just use the stream straight away.
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("webrtc_ice_candidate", {
            to: userId,
            candidate: event.candidate,
          });
        }
      };
      pc.ontrack = (event) => setRemoteStream(event.streams[0]);
      
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      peerConnection.current = pc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit("call_user", {
        userToCall: userId,
        signalData: offer,
        from: user?.id,
        name: `${user?.firstName} ${user?.lastName}`,
      });
      
    } catch (err) {
      console.error("Microphone access blocked", err);
      toast({ title: "Microphone Access Required", description: "Please allow microphone access to make calls.", variant: "destructive" });
    }
  };

  const acceptCall = async () => {
    if (!activeCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("webrtc_ice_candidate", {
            to: activeCall.withUserId,
            candidate: event.candidate,
          });
        }
      };
      pc.ontrack = (event) => setRemoteStream(event.streams[0]);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      peerConnection.current = pc;

      const incomingOfferStr = window.sessionStorage.getItem("incoming_offer");
      if (incomingOfferStr) {
        const offer = JSON.parse(incomingOfferStr);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        window.sessionStorage.removeItem("incoming_offer");

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket?.emit("call_accepted", {
          signal: answer,
          to: activeCall.withUserId,
        });

        setCallStatus("ACTIVE");
      }
    } catch (err) {
      console.error("Microphone access blocked", err);
      toast({ title: "Microphone Access Required", description: "Cannot accept call.", variant: "destructive" });
      declineCall();
    }
  };

  const declineCall = () => {
    if (activeCall && socket) {
      socket.emit("call_declined", { to: activeCall.withUserId });
    }
    cleanupCall();
  };

  const endCall = () => {
    if (activeCall && socket) {
      socket.emit("call_ended", { to: activeCall.withUserId });
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
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
