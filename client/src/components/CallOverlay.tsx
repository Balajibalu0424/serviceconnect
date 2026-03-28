import React, { useEffect, useRef } from "react";
import { useCall } from "@/contexts/CallContext";
import { Button } from "./ui/button";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";

export function CallOverlay() {
  const { callStatus, activeCall, remoteStream, acceptCall, declineCall, endCall, toggleMute, isMuted } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Hook up the remote stream to the audio element when it becomes active
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      // Play is sometimes blocked by browser policies if no user interaction occurred,
      // but accepting a call is a user interaction.
      audioRef.current.play().catch(console.error);
    }
  }, [remoteStream, callStatus]);

  if (callStatus === "IDLE" || !activeCall) return null;

  return (
    <>
      {/* Hidden audio element to play the incoming voice stream */}
      <audio ref={audioRef} autoPlay />

      {/* INCOMING CALL OVERLAY */}
      {callStatus === "RINGING" && !activeCall.isCaller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-8 flex flex-col items-center shadow-2xl border border-border/50 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
              <Phone className="w-10 h-10 text-primary animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>
            <p className="text-muted-foreground mb-8 text-center">
              {activeCall.withUserName} is calling you.
            </p>
            <div className="flex gap-6 w-full justify-center">
              <Button
                variant="destructive"
                size="icon"
                className="w-16 h-16 rounded-full shadow-lg hover:scale-105 transition-transform"
                onClick={declineCall}
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
              <Button
                size="icon"
                className="w-16 h-16 rounded-full shadow-lg bg-green-500 hover:bg-green-600 hover:scale-105 transition-transform"
                onClick={acceptCall}
              >
                <Phone className="w-6 h-6 animate-ping-once" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OUTGOING CALL OVERLAY (INITIATING) */}
      {callStatus === "INITIATING" && activeCall.isCaller && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-card rounded-2xl p-4 shadow-xl border flex items-center gap-4 min-w-[300px]">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center relative">
              <Phone className="w-5 h-5 text-primary" />
              <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-50"></span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Calling {activeCall.withUserName}</h3>
              <p className="text-xs text-muted-foreground animate-pulse">Ringing...</p>
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="rounded-full w-10 h-10"
              onClick={endCall}
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ACTIVE CALL OVERLAY */}
      {callStatus === "ACTIVE" && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-card rounded-2xl p-4 shadow-2xl border border-primary/20 flex flex-col gap-4 min-w-[320px]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center relative">
                <Phone className="w-5 h-5 text-green-500" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse border-2 border-background"></span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{activeCall.withUserName}</h3>
                <p className="text-xs text-green-500 font-medium">00:00</p>
              </div>
            </div>
            <div className="flex justify-between items-center bg-muted/50 rounded-xl p-2 px-4">
              <span className="text-xs text-muted-foreground font-medium">In Call</span>
              <div className="flex gap-2">
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="rounded-full w-10 h-10 hover:scale-105 transition-transform"
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="rounded-full w-10 h-10 hover:scale-105 transition-transform"
                  onClick={endCall}
                >
                  <PhoneOff className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
