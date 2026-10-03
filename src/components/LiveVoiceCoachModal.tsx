import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  PhoneOff,
  Radio,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface LiveVoiceCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
}

export const LiveVoiceCoachModal: React.FC<LiveVoiceCoachModalProps> = ({
  isOpen,
  onClose,
  studentName = 'Student',
}) => {
  const [status, setStatus] = useState<
    'connecting' | 'connected' | 'speaking' | 'listening' | 'error' | 'disconnected'
  >('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Audio Contexts & WebSocket Refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const isMicMutedRef = useRef(isMicMuted);
  isMicMutedRef.current = isMicMuted;

  // Convert Float32Array PCM to base64 16-bit PCM little-endian
  const pcmToBase64 = (float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    let binary = '';
    const bytes = new Uint8Array(int16Array.buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Playback base64 PCM chunk gaplessly at 24kHz
  const playAudioChunk = (base64Audio: string) => {
    if (!outputAudioCtxRef.current) return;
    const audioCtx = outputAudioCtxRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      const startTime = Math.max(now, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      setStatus('speaking');
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          setStatus('listening');
        }
      }, audioBuffer.duration * 1000);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  };

  const startVoiceSession = async () => {
    setStatus('connecting');
    setErrorMessage(null);

    try {
      // 1. Initialize AudioContexts
      // Input: 16kHz for mic capture as required by gemini-3.8-live
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      // Output: 24kHz for model output playback
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // 2. Request mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Connect to WebSocket Live API endpoint
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live-voice`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('listening');
        console.log('[Live Voice] WebSocket connected to server');

        // Setup microphone audio capture processor
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (isMicMutedRef.current) return;
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const base64Audio = pcmToBase64(inputData);
            ws.send(JSON.stringify({ audio: base64Audio }));
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setErrorMessage(msg.error);
            setStatus('error');
            return;
          }
          if (msg.audio) {
            playAudioChunk(msg.audio);
          }
          if (msg.interrupted) {
            // Stop current playback queue on interruption
            if (outputAudioCtxRef.current) {
              nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
            }
            setStatus('listening');
          }
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('[Live Voice] WebSocket error:', e);
        setStatus('error');
        setErrorMessage('Failed to connect to Live Voice API.');
      };

      ws.onclose = () => {
        console.log('[Live Voice] WebSocket closed');
        setStatus('disconnected');
      };
    } catch (err: any) {
      console.error('[Live Voice] Setup error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Microphone access denied or audio unavailable.');
    }
  };

  const cleanupSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  };

  useEffect(() => {
    if (isOpen) {
      startVoiceSession();
    } else {
      cleanupSession();
    }
    return () => {
      cleanupSession();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[rgba(0,210,255,0.4)] bg-gradient-to-b from-[rgba(10,45,70,0.98)] to-[rgba(2,15,30,0.99)] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-white flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[#7892a5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Badges */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#20f5a2]/10 border border-[#20f5a2]/30 text-xs font-bold text-[#20f5a2] mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>GEMINI-3.8-LIVE · REAL-TIME VOICE API</span>
        </div>

        <h2 className="text-2xl font-extrabold text-white">Live Voice Interview Coach</h2>
        <p className="text-xs text-[#8ca8ba] max-w-sm mt-1">
          Have an interactive, spoken conversation with Gemini. Practice answering questions out loud with instant speech feedback.
        </p>

        {/* Interactive Visualizer Sphere */}
        <div className="my-8 relative flex items-center justify-center">
          {/* Animated Glow Rings */}
          <div
            className={`absolute w-44 h-44 rounded-full transition-all duration-500 ${
              status === 'speaking'
                ? 'bg-[radial-gradient(circle,#20f5a2_0%,rgba(0,210,255,0.2)_60%,transparent_80%)] animate-pulse scale-110 opacity-80'
                : status === 'listening'
                ? 'bg-[radial-gradient(circle,#00cfff_0%,rgba(32,245,162,0.15)_60%,transparent_80%)] animate-pulse scale-100 opacity-60'
                : 'bg-transparent'
            }`}
          />

          <div
            className={`w-32 h-32 rounded-full border-2 flex items-center justify-center relative z-10 transition-all duration-300 ${
              status === 'speaking'
                ? 'border-[#20f5a2] bg-[#20f5a2]/15 shadow-[0_0_40px_rgba(32,245,162,0.5)]'
                : status === 'listening'
                ? 'border-[#00cfff] bg-[#00cfff]/15 shadow-[0_0_35px_rgba(0,207,255,0.4)]'
                : 'border-white/20 bg-white/5'
            }`}
          >
            {/* Inner Voice Sound Waves */}
            <div className="flex items-center gap-1.5 h-12">
              <span
                className={`w-1 rounded-full transition-all duration-150 ${
                  status === 'speaking'
                    ? 'h-10 bg-[#20f5a2] animate-bounce'
                    : status === 'listening' && !isMicMuted
                    ? 'h-6 bg-[#00cfff] animate-pulse'
                    : 'h-2 bg-white/30'
                }`}
              />
              <span
                className={`w-1 rounded-full transition-all duration-150 ${
                  status === 'speaking'
                    ? 'h-12 bg-[#20f5a2] animate-bounce [animation-delay:0.15s]'
                    : status === 'listening' && !isMicMuted
                    ? 'h-9 bg-[#00cfff] animate-pulse [animation-delay:0.1s]'
                    : 'h-2 bg-white/30'
                }`}
              />
              <span
                className={`w-1 rounded-full transition-all duration-150 ${
                  status === 'speaking'
                    ? 'h-8 bg-[#20f5a2] animate-bounce [animation-delay:0.3s]'
                    : status === 'listening' && !isMicMuted
                    ? 'h-11 bg-[#00cfff] animate-pulse [animation-delay:0.2s]'
                    : 'h-2 bg-white/30'
                }`}
              />
              <span
                className={`w-1 rounded-full transition-all duration-150 ${
                  status === 'speaking'
                    ? 'h-11 bg-[#20f5a2] animate-bounce [animation-delay:0.2s]'
                    : status === 'listening' && !isMicMuted
                    ? 'h-7 bg-[#00cfff] animate-pulse [animation-delay:0.15s]'
                    : 'h-2 bg-white/30'
                }`}
              />
              <span
                className={`w-1 rounded-full transition-all duration-150 ${
                  status === 'speaking'
                    ? 'h-6 bg-[#20f5a2] animate-bounce [animation-delay:0.1s]'
                    : status === 'listening' && !isMicMuted
                    ? 'h-4 bg-[#00cfff] animate-pulse [animation-delay:0.05s]'
                    : 'h-2 bg-white/30'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Live Status indicator text */}
        <div className="space-y-1 mb-6">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'speaking'
                  ? 'bg-[#20f5a2] animate-ping'
                  : status === 'listening'
                  ? 'bg-[#00cfff] animate-pulse'
                  : status === 'connecting'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-sm font-bold capitalize text-white">
              {status === 'speaking'
                ? 'Coach is speaking...'
                : status === 'listening'
                ? isMicMuted
                  ? 'Microphone Muted'
                  : 'Listening to your voice...'
                : status === 'connecting'
                ? 'Connecting to gemini-3.8-live...'
                : status === 'error'
                ? 'Connection Error'
                : 'Session Disconnected'}
            </span>
          </div>

          <p className="text-xs text-[#7d9cb0]">
            {status === 'speaking'
              ? 'Listen carefully, or speak to interrupt naturally.'
              : status === 'listening'
              ? 'Speak your interview answer or ask any question out loud.'
              : 'Establishing low-latency WebSocket bidirectional audio stream.'}
          </p>

          {errorMessage && (
            <div className="p-3 mt-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setIsMicMuted(!isMicMuted)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2 font-bold text-xs ${
              isMicMuted
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
            }`}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#20f5a2]" />}
            <span>{isMicMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all cursor-pointer flex items-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Voice Call</span>
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-[rgba(0,210,255,0.15)] w-full text-[11px] text-[#6b8c9f] flex items-center justify-between">
          <span>Bidirectional 16kHz/24kHz PCM</span>
          <span className="text-[#20f5a2] font-semibold">Gemini Live API</span>
        </div>
      </div>
    </div>
  );
};
