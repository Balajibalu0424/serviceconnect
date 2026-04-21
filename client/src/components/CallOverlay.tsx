import React, { useEffect, useRef, useState } from "react";
import { useCall } from "@/contexts/CallContext";
import { Button } from "./ui/button";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

export function CallOverlay() {
  const { callStatus, activeCall, remoteStream, acceptCall, declineCall, endCall, toggleMute, isMuted } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isSpeaker, setIsSpeaker] = useState(true);

  const toggleSpeaker = async () => {
    if (!audioRef.current) return;
    
    try {
      // Toggle the internal muted state of the HTMLAudioElement
      // This serves as an "Undeafen/Deafen" button, or just a simple Volume toggle
      audioRef.current.muted = isSpeaker;
      setIsSpeaker(!isSpeaker);
      
      // If the browser supports output device selection (e.g. Chrome/Android)
      // we can attempt to switch from earpiece to loudspeaker
      if (typeof (audioRef.current as any).setSinkId === 'function') {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        if (audioOutputs.length > 1) {
          // Simplistic toggle between available audio outputs
          const currentSinkId = (audioRef.current as any).sinkId;
          const nextDevice = audioOutputs.find(d => d.deviceId !== currentSinkId) || audioOutputs[0];
          await (audioRef.current as any).setSinkId(nextDevice.deviceId);
        }
      }
    } catch (err) {
      console.warn("Could not toggle speaker output", err);
    }
  };

  // Hook up the remote stream to the audio element when it becomes active
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(console.error);
    }
  }, [remoteStream, callStatus]);

  // Live call timer — reset and start counting when call becomes ACTIVE
  useEffect(() => {
    if (callStatus !== "ACTIVE") {
      setCallSeconds(0);
      return;
    }
    setCallSeconds(0);
    const id = setInterval(() => setCallSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [callStatus]);

  // Play synthetic ringing/dial tone sounds
  useEffect(() => {
    if (callStatus !== "RINGING" && callStatus !== "INITIATING") return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (callStatus === "RINGING") {
      // European ring pattern: 400Hz + 450Hz, 1s on, 2s off
      oscillator.type = "sine";
      oscillator.frequency.value = 425;
      
      const now = audioCtx.currentTime;
      for (let i = 0; i < 20; i++) {
        const start = now + i * 3;
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(0.5, start + 0.1);
        gainNode.gain.setValueAtTime(0.5, start + 1);
        gainNode.gain.linearRampToValueAtTime(0, start + 1.1);
      }
    } else if (callStatus === "INITIATING") {
      // Dial tone pattern: 400Hz + 450Hz, 0.4s on, 0.2s off, 0.4s on, 2s off
      oscillator.type = "sine";
      oscillator.frequency.value = 425;
      
      const now = audioCtx.currentTime;
      for (let i = 0; i < 20; i++) {
        const start = now + i * 3;
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(0.1, start + 0.05);
        gainNode.gain.setValueAtTime(0.1, start + 0.4);
        gainNode.gain.linearRampToValueAtTime(0, start + 0.45);
        
        gainNode.gain.setValueAtTime(0, start + 0.65);
        gainNode.gain.linearRampToValueAtTime(0.1, start + 0.7);
        gainNode.gain.setValueAtTime(0.1, start + 1.1);
        gainNode.gain.linearRampToValueAtTime(0, start + 1.15);
      }
    }

    oscillator.start();

    return () => {
      oscillator.stop();
      audioCtx.close().catch(() => {});
    };
  }, [callStatus]);

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
                <p className="text-xs text-green-500 font-medium">
                  {String(Math.floor(callSeconds / 60)).padStart(2, "0")}:{String(callSeconds % 60).padStart(2, "0")}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center bg-muted/50 rounded-xl p-2 px-4">
              <span className="text-xs text-muted-foreground font-medium">In Call</span>
              <div className="flex gap-2">
                <Button
                  variant={!isSpeaker ? "secondary" : "default"}
                  size="icon"
                  className="rounded-full w-10 h-10 hover:scale-105 transition-transform"
                  onClick={toggleSpeaker}
                  title="Toggle Speaker"
                >
                  {isSpeaker ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="rounded-full w-10 h-10 hover:scale-105 transition-transform"
                  onClick={toggleMute}
                  title="Mute Microphone"
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="rounded-full w-10 h-10 hover:scale-105 transition-transform"
                  onClick={endCall}
                  title="End Call"
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
