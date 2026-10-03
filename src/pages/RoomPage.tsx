import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ChatPanel } from '../components/ChatPanel';
import { PostSessionFeedbackModal } from '../components/PostSessionFeedbackModal';
import { SpeakMateLogo } from '../components/SpeakMateLogo';
import { PracticeMode } from '../types';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  RefreshCw,
  PhoneOff,
  MessageSquare,
  Users,
  Clock,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Award,
  Star,
  Hand,
  Monitor,
  MonitorOff,
  Subtitles,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  UserX,
  X,
  Radio,
  Signal,
  Settings,
} from 'lucide-react';

interface RoomPageProps {
  practiceMode?: PracticeMode;
  onNavigate: (tab: string, mode?: PracticeMode) => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ practiceMode = 'General Communication', onNavigate }) => {
  const { user } = useAuth();
  const {
    socket,
    activeRoom,
    leaveRoom,
    endConversation,
    toggleMediaState,
    chatMessages,
    handRaisedUsers,
    toggleHandRaise,
    toggleRoomLock,
    kickParticipant,
  } = useSocket();

  // Local media state
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const [remotePeerMediaState, setRemotePeerMediaState] = useState<{ isMuted: boolean; isVideoOff: boolean }>({
    isMuted: false,
    isVideoOff: false,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  // Teams Meeting Features
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isCaptionsOn, setIsCaptionsOn] = useState(false);
  const [liveCaptionText, setLiveCaptionText] = useState('Captions active. Speak into your microphone to view real-time transcript...');
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Session timer
  const [seconds, setSeconds] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1200 : false;
  });

  // Post-Room Feedback System
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  // Resolve current active room ID with robust fallback chain to custom ID
  const currentRoomId =
    activeRoom?.id ||
    sessionStorage.getItem('currentPracticeRoomId') ||
    (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('joinRoom') : null) ||
    'vamsi@2317';

  const myName = user?.fullName || 'Student';

  // Check if I am host: check role in participants, or matching host name
  const myParticipant = activeRoom?.participants?.find(
    (p) => (socket?.id && p.socketId === socket.id) || p.name.trim().toLowerCase() === myName.trim().toLowerCase()
  );

  const isHost = myParticipant
    ? myParticipant.role === 'Host'
    : (activeRoom ? activeRoom.host.trim().toLowerCase() === myName.trim().toLowerCase() : true);

  const participants = activeRoom?.participants && activeRoom.participants.length > 0
    ? activeRoom.participants
    : [
        {
          socketId: socket?.id || 'local',
          name: myName,
          initial: myName.charAt(0).toUpperCase() || 'S',
          role: (isHost ? 'Host' : 'Participant') as 'Host' | 'Participant',
          level: user?.level || 'Beginner',
          goal: user?.goal || 'Career Preparation',
          isMuted: false,
          isVideoOff: false,
        },
      ];

  // Distinguish remote participants by socketId, not just by name
  const remoteParticipants = participants.filter((p) => {
    if (socket?.id && p.socketId && p.socketId !== 'local') {
      return p.socketId !== socket.id;
    }
    return p.role !== (isHost ? 'Host' : 'Participant') || p.name.trim().toLowerCase() !== myName.trim().toLowerCase();
  });

  const partner = remoteParticipants[0];
  const partnerName = partner?.name || 'Practice Partner';
  const participantCount = participants.length;
  const isRoomLocked = activeRoom?.locked || false;

  // Timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Ensure socket joins room channel on mount
  useEffect(() => {
    if (!socket) return;
    socket.emit('join-room', {
      roomId: currentRoomId,
      studentName: myName,
      userProfile: user,
    });
  }, [socket, currentRoomId]);

  // WebRTC Peer Connection Helper
  const createPeerConnection = (targetSocketId: string) => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    const activeStream = localStreamRef.current || localStream;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        pc.addTrack(track, activeStream);
      });
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote stream track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          roomId: currentRoomId,
          candidate: event.candidate,
        });
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // WebRTC Signaling and Event Listeners
  useEffect(() => {
    if (!socket) return;

    // When peer announces they are mounted and ready
    const handlePeerReady = async (data: { socketId: string }) => {
      console.log('[WebRTC] Peer is ready, initiating offer to:', data.socketId);
      try {
        const pc = createPeerConnection(data.socketId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', {
          targetSocketId: data.socketId,
          roomId: currentRoomId,
          offer,
        });
      } catch (err) {
        console.warn('[WebRTC] Offer initiation on peer-ready error:', err);
      }
    };

    const handleStudentJoined = (data: { socketId: string; name: string }) => {
      console.log('[WebRTC] Student joined:', data.name, data.socketId);
      // Give the joining peer's RoomPage 700ms to mount and bind listeners
      setTimeout(async () => {
        try {
          const pc = createPeerConnection(data.socketId);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', {
            targetSocketId: data.socketId,
            roomId: currentRoomId,
            offer,
          });
        } catch (err) {
          console.warn('[WebRTC] Offer initiation error:', err);
        }
      }, 700);
    };

    const handleWebRtcOffer = async (data: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTC] Received offer from:', data.senderSocketId);
      try {
        const pc = createPeerConnection(data.senderSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        while (iceCandidatesQueue.current.length > 0) {
          const cand = iceCandidatesQueue.current.shift();
          if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetSocketId: data.senderSocketId,
          answer,
        });
      } catch (err) {
        console.warn('[WebRTC] Offer processing error:', err);
      }
    };

    const handleWebRtcAnswer = async (data: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTC] Received answer from:', data.senderSocketId);
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          while (iceCandidatesQueue.current.length > 0) {
            const cand = iceCandidatesQueue.current.shift();
            if (cand) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Answer processing error:', err);
      }
    };

    const handleWebRtcIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        } else {
          iceCandidatesQueue.current.push(data.candidate);
        }
      } catch (err) {
        console.warn('[WebRTC] Ice candidate error:', err);
      }
    };

    const handleParticipantMediaChanged = (data: { socketId: string; isMuted?: boolean; isVideoOff?: boolean }) => {
      setRemotePeerMediaState((prev) => ({
        isMuted: typeof data.isMuted === 'boolean' ? data.isMuted : prev.isMuted,
        isVideoOff: typeof data.isVideoOff === 'boolean' ? data.isVideoOff : prev.isVideoOff,
      }));
    };

    const handleParticipantLeft = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setRemoteStream(null);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };

    const handleLiveCaption = (data: { speaker: string; text: string }) => {
      setLiveCaptionText(`${data.speaker}: "${data.text}"`);
    };

    socket.on('peer-ready', handlePeerReady);
    socket.on('student-joined', handleStudentJoined);
    socket.on('webrtc-offer', handleWebRtcOffer);
    socket.on('webrtc-answer', handleWebRtcAnswer);
    socket.on('webrtc-ice-candidate', handleWebRtcIceCandidate);
    socket.on('participant-media-changed', handleParticipantMediaChanged);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('live-caption', handleLiveCaption);

    return () => {
      socket.off('peer-ready', handlePeerReady);
      socket.off('student-joined', handleStudentJoined);
      socket.off('webrtc-offer', handleWebRtcOffer);
      socket.off('webrtc-answer', handleWebRtcAnswer);
      socket.off('webrtc-ice-candidate', handleWebRtcIceCandidate);
      socket.off('participant-media-changed', handleParticipantMediaChanged);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('live-caption', handleLiveCaption);
    };
  }, [socket, currentRoomId]);

  // Auto-connect WebRTC if peer already present upon entering room
  useEffect(() => {
    if (!socket || !isHost) return;
    const peer = remoteParticipants[0];
    if (peer && peer.socketId && peer.socketId !== 'local' && peer.socketId !== 'host-partner' && !peerConnectionRef.current) {
      const timer = setTimeout(async () => {
        try {
          const pc = createPeerConnection(peer.socketId);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', {
            targetSocketId: peer.socketId,
            roomId: currentRoomId,
            offer,
          });
        } catch (err) {
          console.warn('[WebRTC] Auto-offer error:', err);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [socket, isHost, remoteParticipants, currentRoomId]);

  // Keep remote video preview synchronized whenever remoteStream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Cleanup WebRTC and media tracks on unmount
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {}
        peerConnectionRef.current = null;
      }
    };
  }, []);

  // Socket listener for partner ending conversation
  useEffect(() => {
    if (!socket) return;

    const handlePeerEnded = () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setIsFeedbackModalOpen(true);
    };

    socket.on('conversation-ended', handlePeerEnded);
    return () => {
      socket.off('conversation-ended', handlePeerEnded);
    };
  }, [socket, localStream, screenStream]);

  // Start local camera and audio
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function initMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        });

        localStreamRef.current = stream;
        setLocalStream(stream);
        setHasMediaPermission(true);

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          stream.getTracks().forEach((track) => {
            const existingSender = senders.find((s) => s.track?.kind === track.kind);
            if (existingSender) {
              existingSender.replaceTrack(track).catch(() => {});
            } else {
              peerConnectionRef.current?.addTrack(track, stream!);
            }
          });
        }

        if (socket) {
          socket.emit('peer-ready', { roomId: currentRoomId });
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Camera/mic access error:', err);
        setHasMediaPermission(false);
      }
    }

    initMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // Keep local video preview synchronized whenever stream or video state changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      if (isVideoOn && hasMediaPermission) {
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream, isVideoOn, hasMediaPermission]);

  // Web Speech API for Teams Real-Time Live Captions
  useEffect(() => {
    if (!isCaptionsOn) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setLiveCaptionText('Live Captions: Web Speech API active. (Voice detected in session)');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interim += event.results[i][0].transcript;
        }
        if (interim.trim()) {
          const text = interim.trim();
          const speaker = user?.fullName || 'Speaker';
          setLiveCaptionText(`${speaker}: "${text}"`);
          if (socket) {
            socket.emit('live-caption', {
              roomId: currentRoomId,
              speaker,
              text,
            });
          }
        }
      };

      recognition.onerror = () => {
        setLiveCaptionText('Listening for speech...');
      };

      recognition.start();

      return () => {
        try {
          recognition.stop();
        } catch {}
      };
    } catch {
      setLiveCaptionText('Captions active: audio stream listening...');
    }
  }, [isCaptionsOn, user?.fullName]);

  const handleToggleMute = () => {
    if (localStream) {
      const next = !isMuted;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      setIsMuted(next);
      toggleMediaState(next, !isVideoOn);
    }
  };

  const handleToggleVideo = async () => {
    const next = !isVideoOn;

    if (next) {
      // User is turning video ON
      const hasLiveTrack =
        localStream &&
        localStream.getVideoTracks().length > 0 &&
        localStream.getVideoTracks().some((t) => t.readyState === 'live');

      if (hasLiveTrack && localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = true;
        });
        setIsVideoOn(true);
        if (localVideoRef.current) {
          if (localVideoRef.current.srcObject !== localStream) {
            localVideoRef.current.srcObject = localStream;
          }
          localVideoRef.current.play().catch(() => {});
        }
        toggleMediaState(isMuted, false);
      } else {
        // If track was ended or absent, re-acquire video track
        try {
          const fresh = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: !isMuted,
          });

          if (localStream) {
            localStream.getTracks().forEach((t) => t.stop());
          }

          setLocalStream(fresh);
          setIsVideoOn(true);
          setHasMediaPermission(true);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = fresh;
            localVideoRef.current.play().catch(() => {});
          }
          toggleMediaState(isMuted, false);
        } catch (err) {
          console.warn('Could not re-enable video camera:', err);
          setIsVideoOn(false);
        }
      }
    } else {
      // User is turning video OFF
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsVideoOn(false);
      toggleMediaState(isMuted, true);
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Screen Sharing Toggle (Microsoft Teams style)
  const handleToggleScreenShare = async () => {
    if (isScreenSharing && screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Screen sharing is not supported by your browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }

      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setIsScreenSharing(false);
      };
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
    }
  };

  // Raise Hand Toggle (Microsoft Teams feature)
  const handleToggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    toggleHandRaise(next);
  };

  const handleEndSession = () => {
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
    setIsFeedbackModalOpen(true);
  };

  const handleFeedbackComplete = () => {
    setIsFeedbackModalOpen(false);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (isHost) {
      endConversation();
    } else {
      leaveRoom();
    }
    onNavigate('progress');
  };

  const handleFeedbackDismiss = () => {
    setIsFeedbackModalOpen(false);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (isHost) {
      endConversation();
    } else {
      leaveRoom();
    }
    onNavigate('progress');
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(currentRoomId);
    setCopiedRoomId(true);
    setTimeout(() => setCopiedRoomId(false), 2000);
  };

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}/?joinRoom=${encodeURIComponent(currentRoomId)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex flex-col bg-[#010912] text-white relative">
      {/* MICROSOFT TEAMS TOP NAVIGATION BAR */}
      <header className="h-14 bg-[#051524] border-b border-[rgba(0,210,255,0.18)] px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Meeting Info & Security status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLeaveConfirmOpen(true)}
            className="p-1.5 rounded-lg text-[#7c97aa] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Leave room"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <SpeakMateLogo size={30} showText={false} />

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20f5a2] shadow-[0_0_10px_#20f5a2] animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {activeRoom?.mode || practiceMode}
                </span>
                <span className="text-[10px] bg-[#00cfff]/15 text-[#00cfff] font-mono px-2 py-0.5 rounded border border-[#00cfff]/30 hidden sm:inline-block">
                  Teams Room: {currentRoomId}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Timer & Security Verification Banner */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(1,15,30,0.8)] border border-[rgba(0,210,255,0.2)] text-xs">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-mono text-[#20f5a2] font-bold">{formatTimer(seconds)}</span>
          </div>

          <div
            onClick={() => setIsSecurityModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(32,245,162,0.08)] border border-[rgba(32,245,162,0.3)] text-[11px] text-[#20f5a2] cursor-pointer hover:bg-[rgba(32,245,162,0.15)] transition-colors"
            title="Click to view meeting security details"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-medium">
              {isRoomLocked ? 'Room Locked · E2EE' : 'End-to-End Encrypted'}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons & Teams Toolbar */}
        <div className="flex items-center gap-2">
          {/* People / Participants button */}
          <button
            onClick={() => {
              setIsPeopleOpen(!isPeopleOpen);
              if (isChatOpen) setIsChatOpen(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPeopleOpen
                ? 'bg-[#20f5a2] text-[#00131c] font-bold'
                : 'bg-white/5 hover:bg-white/10 text-[#8fa9bb] hover:text-white border border-white/5'
            }`}
            title="Meeting Participants"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">People</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">
              {participantCount}
            </span>
          </button>

          {/* Meeting Chat button */}
          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              if (isPeopleOpen) setIsPeopleOpen(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isChatOpen
                ? 'bg-[#20f5a2] text-[#00131c] font-bold'
                : 'bg-white/5 hover:bg-white/10 text-[#8fa9bb] hover:text-white border border-white/5'
            }`}
            title="Meeting Chat"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chat</span>
            {chatMessages.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#20f5a2] text-[#00131c] font-bold">
                {chatMessages.length}
              </span>
            )}
          </button>

          {/* Security & Lock settings (Host privileged) */}
          <button
            onClick={() => setIsSecurityModalOpen(true)}
            className="p-2 rounded-xl text-[#7c97aa] hover:text-[#20f5a2] hover:bg-white/5 transition-colors cursor-pointer border border-white/5"
            title="Meeting Security Settings"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Rate Peer Communication button */}
          <button
            onClick={() => setIsFeedbackModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-[rgba(32,245,162,0.4)] bg-[rgba(32,245,162,0.12)] text-[#20f5a2] hover:bg-[#20f5a2] hover:text-[#00131c] transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Submit peer rating"
          >
            <Star className="w-3.5 h-3.5 fill-[#20f5a2]" />
            <span className="hidden sm:inline">Rate Peer</span>
          </button>
        </div>
      </header>

      {/* MAIN MEETING STAGE AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Central Stage: Video Grid / Screen Share */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto relative space-y-4">
          {/* Active Screen Share Window if Screen Sharing */}
          {isScreenSharing && (
            <div className="relative aspect-video max-h-[55vh] rounded-3xl overflow-hidden border-2 border-[#00cfff] bg-black shadow-2xl mx-auto w-full">
              <span className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full text-xs font-bold bg-black/80 text-[#00cfff] border border-[#00cfff]/40 backdrop-blur-md flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                <span>You are sharing your screen</span>
              </span>

              <button
                onClick={handleToggleScreenShare}
                className="absolute top-3 right-3 z-10 px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <MonitorOff className="w-3.5 h-3.5" />
                <span>Stop Sharing</span>
              </button>

              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Teams Video Gallery Tiles Grid */}
          <div
            className={`grid gap-4 flex-1 items-center justify-center ${
              isScreenSharing
                ? 'grid-cols-2 sm:grid-cols-4 max-h-[25vh]'
                : participantCount === 1
                ? 'grid-cols-1 max-w-2xl mx-auto w-full'
                : participantCount === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto w-full'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto w-full'
            }`}
          >
            {/* Local Video Tile (You) */}
            <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-[rgba(0,210,255,0.25)] bg-[#030f1c] shadow-2xl group flex flex-col items-center justify-center">
              {/* Top info badge with Unique Room ID */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[rgba(2,12,22,0.85)] border border-white/10 text-white backdrop-blur-md flex items-center gap-1.5">
                  <span>{user?.fullName || 'You'} ({isHost ? 'Host' : 'Participant'})</span>
                </span>
                <span className="text-[9px] bg-[#20f5a2]/20 text-[#20f5a2] px-2 py-0.5 rounded-full font-bold uppercase">
                  YOU
                </span>
                <span className="text-[10px] font-mono bg-[#00cfff]/20 text-[#00cfff] border border-[#00cfff]/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="text-[#8ec5e3]">Room:</span>
                  <span className="text-white font-bold">{currentRoomId}</span>
                </span>
                {currentRoomId.startsWith('SM-QM-') && (
                  <span className="text-[9px] bg-[#20f5a2]/20 text-[#20f5a2] border border-[#20f5a2]/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span>⚡ Quick Match</span>
                  </span>
                )}
              </div>

              {/* Hand raised badge */}
              {isHandRaised && (
                <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-amber-400 text-[#00131c] font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-bounce">
                  <Hand className="w-3.5 h-3.5" />
                  <span>Hand Raised</span>
                </div>
              )}

              {/* Video Element (ALWAYS preserved in DOM to prevent detachment of MediaStream tracks) */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-200 ${
                  isVideoOn && hasMediaPermission ? 'opacity-100 block' : 'opacity-0 hidden'
                }`}
              />

              {/* Avatar placeholder when video is turned off or not permitted */}
              {(!isVideoOn || !hasMediaPermission) && (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center font-extrabold text-2xl text-[#00131c] shadow-[0_0_25px_rgba(32,245,162,0.4)] mb-2">
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <strong className="text-sm text-white">{user?.fullName || 'You'}</strong>
                  <span className="text-xs text-[#718b9e]">
                    {!hasMediaPermission ? 'Camera ready / previewing' : 'Camera turned off'}
                  </span>
                </div>
              )}

              {/* Bottom left: Audio status & speaking wave bar */}
              <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5">
                <div
                  className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 backdrop-blur-md transition-all ${
                    isMuted
                      ? 'bg-rose-500/90 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                      : 'bg-black/75 text-[#20f5a2] border border-white/10'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold">{isMuted ? 'Muted' : 'Speaking'}</span>
                  {!isMuted && (
                    <div className="flex items-center gap-0.5 ml-0.5">
                      <span className="w-0.5 h-2 bg-[#20f5a2] rounded-full animate-pulse" />
                      <span className="w-0.5 h-3.5 bg-[#20f5a2] rounded-full animate-bounce" />
                      <span className="w-0.5 h-2 bg-[#20f5a2] rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-xl bg-black/60 text-[#20f5a2] text-[10px] border border-white/10"
                  title="Strong Signal & End-to-End Encryption"
                >
                  <Signal className="w-3 h-3" />
                  <span className="font-mono font-bold">HD</span>
                </div>
              </div>

              {/* Bottom right: Video status indicator bar */}
              <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-xs">
                {isVideoOn && hasMediaPermission ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#20f5a2] shadow-[0_0_8px_#20f5a2] animate-pulse" />
                    <span className="text-[10px] font-bold text-[#20f5a2] flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      <span>Video Live</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-[10px] font-bold text-rose-300 flex items-center gap-1">
                      <VideoOff className="w-3 h-3" />
                      <span>Video Off</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Remote Participants Video Tiles (Second person's video bar) */}
            {remoteParticipants.map((remoteUser, idx) => {
                const remoteHandRaised = handRaisedUsers[remoteUser.socketId] || remoteUser.isHandRaised;
                const isPeerVideoOff = remotePeerMediaState.isVideoOff || remoteUser.isVideoOff;
                const isPeerMuted = remotePeerMediaState.isMuted || remoteUser.isMuted;

                return (
                  <div
                    key={idx}
                    className="relative aspect-video rounded-3xl overflow-hidden border-2 border-[rgba(0,210,255,0.25)] bg-[#030f1c] shadow-2xl group flex flex-col items-center justify-center text-center"
                  >
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[rgba(2,12,22,0.85)] border border-white/10 text-white backdrop-blur-md">
                        {remoteUser.name}
                      </span>
                      <span className="text-[9px] bg-sky-400/20 text-sky-400 px-2 py-0.5 rounded-full font-bold">
                        {remoteUser.role || 'Attendee'}
                      </span>
                      <span className="text-[10px] font-mono bg-[#00cfff]/20 text-[#00cfff] border border-[#00cfff]/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="text-[#8ec5e3]">Room:</span>
                        <span className="text-white font-bold">{currentRoomId}</span>
                      </span>
                    </div>

                    {remoteHandRaised && (
                      <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-amber-400 text-[#00131c] font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-bounce">
                        <Hand className="w-3.5 h-3.5" />
                        <span>Hand Raised</span>
                      </div>
                    )}

                    {/* Remote Live Video Element */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover transition-opacity duration-200 ${
                        remoteStream && !isPeerVideoOff ? 'opacity-100 block' : 'opacity-0 hidden'
                      }`}
                    />

                    {/* Fallback avatar if remote video is off or connecting */}
                    {(!remoteStream || isPeerVideoOff) && (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#00cfff] to-[#20f5a2] flex items-center justify-center font-extrabold text-2xl text-[#00131c] shadow-lg mb-2">
                          {remoteUser.initial || remoteUser.name.charAt(0).toUpperCase()}
                        </div>
                        <strong className="text-sm text-white">{remoteUser.name}</strong>
                        <span className="text-xs text-[#718b9e]">
                          {remoteUser.level} · {remoteUser.goal}
                        </span>
                        <span className="text-[10px] text-[#718b9e] mt-1">
                          {remoteStream ? 'Camera turned off' : 'Audio & video connecting...'}
                        </span>
                      </div>
                    )}

                    {/* Bottom left: Audio status & speaking wave bar */}
                    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5">
                      <div
                        className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 backdrop-blur-md transition-all ${
                          isPeerMuted
                            ? 'bg-rose-500/90 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                            : 'bg-black/75 text-[#20f5a2] border border-white/10'
                        }`}
                      >
                        {isPeerMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span className="text-[10px] font-bold">{isPeerMuted ? 'Muted' : 'Speaking'}</span>
                        {!isPeerMuted && (
                          <div className="flex items-center gap-0.5 ml-0.5">
                            <span className="w-0.5 h-2 bg-[#20f5a2] rounded-full animate-pulse" />
                            <span className="w-0.5 h-3.5 bg-[#20f5a2] rounded-full animate-bounce" />
                            <span className="w-0.5 h-2 bg-[#20f5a2] rounded-full animate-pulse" />
                          </div>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-xl bg-black/60 text-[#20f5a2] text-[10px] border border-white/10"
                        title="Strong Signal & End-to-End Encryption"
                      >
                        <Signal className="w-3 h-3" />
                        <span className="font-mono font-bold">HD</span>
                      </div>
                    </div>

                    {/* Bottom right: Video live indicator */}
                    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-xs">
                      {remoteStream && !isPeerVideoOff ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#20f5a2] shadow-[0_0_8px_#20f5a2] animate-pulse" />
                          <span className="text-[10px] font-bold text-[#20f5a2] flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            <span>Video Live</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-[10px] font-bold text-rose-300 flex items-center gap-1">
                            <VideoOff className="w-3 h-3" />
                            <span>Video Off</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Waiting for partner tile if solo */}
            {remoteParticipants.length === 0 && (
              <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-[rgba(0,210,255,0.3)] bg-[rgba(2,15,28,0.5)] shadow-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[rgba(0,200,255,0.1)] border border-[rgba(0,200,255,0.25)] flex items-center justify-center text-[#00cfff]">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <strong className="text-sm text-white block">
                    Invite classmate with Unique Room ID
                  </strong>
                  <p className="text-xs text-[#718b9e] max-w-xs mt-1">
                    Your camera and audio are connected. Share the room ID below to begin live 1-to-1 or group practice:
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRoomId}
                    className="px-4 py-2.5 rounded-xl bg-[rgba(0,207,255,0.18)] border-2 border-[#00cfff] text-sm font-mono text-[#20f5a2] hover:bg-[#20f5a2] hover:text-[#00131c] transition-all flex items-center gap-2 cursor-pointer font-bold shadow-[0_0_15px_rgba(0,207,255,0.3)]"
                    title="Click to copy unique Room ID"
                  >
                    {copiedRoomId ? <Check className="w-4 h-4 text-[#20f5a2]" /> : <Copy className="w-4 h-4 text-[#00cfff]" />}
                    <span className="tracking-wider">{currentRoomId}</span>
                  </button>
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 text-xs text-white font-semibold transition-colors cursor-pointer"
                  >
                    {copiedLink ? 'Link Copied!' : 'Copy Link'}
                  </button>
                </div>

                {/* Clear instructions on how 2nd person joins */}
                <div className="mt-3 p-3.5 rounded-2xl bg-[rgba(0,200,255,0.06)] border border-[rgba(0,200,255,0.2)] text-[11px] text-[#9ebcd1] max-w-sm text-left space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#20f5a2] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#20f5a2] animate-pulse" />
                    <span>How 2nd person joins this room:</span>
                  </div>
                  <div className="space-y-1 text-slate-300">
                    <p>
                      <strong>Method 1 (Direct link):</strong> Send them the copied link. When they open it, they will automatically join.
                    </p>
                    <p>
                      <strong>Method 2 (Using Room ID):</strong> Tell them to open SpeakMate, click <strong className="text-white">Rooms</strong> in the top navigation, paste <strong className="text-[#20f5a2] font-mono">{currentRoomId}</strong> into the <strong className="text-white">Join by Room ID</strong> box, and click <strong className="text-white">Join Room</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Live Captions Overlay Strip (Microsoft Teams feature) */}
          {isCaptionsOn && (
            <div className="w-full max-w-3xl mx-auto p-3.5 rounded-2xl bg-black/85 border border-[#00cfff]/30 backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="p-2 rounded-xl bg-[#00cfff]/20 text-[#00cfff]">
                <Subtitles className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <span className="text-[10px] uppercase font-bold text-[#00cfff] tracking-wider block">
                  LIVE MEETING TRANSCRIPTION (TEAMS CAPTIONS)
                </span>
                <p className="text-white font-medium italic mt-0.5 leading-relaxed">
                  {liveCaptionText}
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Slide-out: People / Participants Panel */}
        {isPeopleOpen && (
          <aside className="w-80 border-l border-[rgba(0,210,255,0.18)] bg-[#051524] p-5 flex flex-col justify-between shrink-0 z-10 animate-in slide-in-from-right duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#20f5a2]" />
                  <h3 className="text-sm font-bold text-white">Participants ({participantCount})</h3>
                </div>
                <button
                  onClick={() => setIsPeopleOpen(false)}
                  className="p-1 rounded-lg text-[#7c97aa] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                {participants.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center text-[#00131c] font-bold text-xs">
                        {p.initial || p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong className="block text-xs text-white">
                          {p.name} {p.name === (user?.fullName || 'Student') && '(You)'}
                        </strong>
                        <span className="text-[10px] text-[#718b9e]">
                          {p.role} · {p.level}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(handRaisedUsers[p.socketId] || p.isHandRaised) && (
                        <span className="text-amber-400" title="Hand Raised">
                          <Hand className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {isHost && p.socketId !== 'local' && p.name !== (user?.fullName || 'Student') && (
                        <button
                          onClick={() => kickParticipant(p.socketId)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
                          title="Remove from room"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2">
              <button
                onClick={handleCopyShareLink}
                className="w-full py-2.5 rounded-xl border border-[rgba(0,210,255,0.25)] bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#20f5a2]" />
                <span>{copiedLink ? 'Link Copied!' : 'Copy Meeting Invite'}</span>
              </button>
            </div>
          </aside>
        )}

        {/* Slide-out: Live Chat Panel */}
        {isChatOpen && (
          <aside className="w-80 lg:w-96 border-l border-[rgba(0,210,255,0.18)] bg-[#051524] h-full shrink-0 z-10 animate-in slide-in-from-right duration-200">
            <ChatPanel onClose={() => setIsChatOpen(false)} />
          </aside>
        )}
      </div>

      {/* MICROSOFT TEAMS BOTTOM MEETING CONTROLS TOOLBAR */}
      <footer className="h-20 bg-[#030d17] border-t border-[rgba(0,210,255,0.15)] px-4 sm:px-8 flex items-center justify-between shrink-0 z-20">
        {/* Left: Meeting Mode & Room ID Badge */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#20f5a2]" />
            <span className="text-xs font-mono text-white font-bold">{currentRoomId}</span>
          </div>
        </div>

        {/* Center: Primary Call Controls (Mute, Camera, Screen Share, Raise Hand, Captions) */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3 mx-auto sm:mx-0">
          {/* Mic Button */}
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute (Ctrl+Shift+M)' : 'Mute (Ctrl+Shift+M)'}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isMuted
                ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'bg-[#223547] hover:bg-[#2c445c] text-white'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera Button */}
          <button
            onClick={handleToggleVideo}
            title={isVideoOn ? 'Turn camera off (Ctrl+Shift+O)' : 'Turn camera on (Ctrl+Shift+O)'}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative ${
              !isVideoOn
                ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'bg-[#223547] hover:bg-[#2c445c] text-white border border-[#20f5a2]/30'
            }`}
          >
            {isVideoOn ? <Video className="w-5 h-5 text-[#20f5a2]" /> : <VideoOff className="w-5 h-5" />}
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#030d17] ${
                isVideoOn ? 'bg-[#20f5a2] shadow-[0_0_6px_#20f5a2]' : 'bg-rose-500'
              }`}
            />
          </button>

          {/* Switch Camera Button (Mobile) */}
          <button
            onClick={handleSwitchCamera}
            title="Switch front/rear camera"
            className="w-12 h-12 rounded-2xl bg-[#223547] hover:bg-[#2c445c] text-white flex items-center justify-center transition-all cursor-pointer hidden sm:flex"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Share Screen Button (Teams Feature) */}
          <button
            onClick={handleToggleScreenShare}
            title={isScreenSharing ? 'Stop screen sharing' : 'Share entire screen or window'}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isScreenSharing
                ? 'bg-[#00cfff] text-[#00131c] shadow-[0_0_20px_rgba(0,207,255,0.5)] font-bold'
                : 'bg-[#223547] hover:bg-[#2c445c] text-white'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Raise Hand Button (Teams Feature) */}
          <button
            onClick={handleToggleHandRaise}
            title={isHandRaised ? 'Lower hand' : 'Raise hand (Ctrl+Shift+K)'}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isHandRaised
                ? 'bg-amber-400 text-[#00131c] shadow-[0_0_20px_rgba(251,191,36,0.6)] font-bold'
                : 'bg-[#223547] hover:bg-[#2c445c] text-white'
            }`}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Live Captions Toggle Button (Teams Feature) */}
          <button
            onClick={() => setIsCaptionsOn(!isCaptionsOn)}
            title={isCaptionsOn ? 'Turn off live captions' : 'Turn on live captions'}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isCaptionsOn
                ? 'bg-[#20f5a2] text-[#00131c] shadow-[0_0_20px_rgba(32,245,162,0.5)] font-bold'
                : 'bg-[#223547] hover:bg-[#2c445c] text-white'
            }`}
          >
            <Subtitles className="w-5 h-5" />
          </button>

          {/* Red Teams End Call / Leave Meeting Button */}
          <button
            onClick={handleEndSession}
            title="Leave / End Meeting and rate peer"
            className="px-5 sm:px-6 h-12 rounded-2xl bg-[#ea3546] hover:bg-[#d62737] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-[0_4px_20px_rgba(234,53,70,0.4)] hover:scale-[1.02] transition-all cursor-pointer ml-2"
          >
            <PhoneOff className="w-4 h-4" />
            <span>{isHost ? 'End Call' : 'Leave'}</span>
          </button>
        </div>

        {/* Right: Security & Lock State Pill */}
        <div className="hidden sm:flex items-center gap-2">
          {isHost && (
            <button
              onClick={() => toggleRoomLock(!isRoomLocked)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isRoomLocked
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-white/5 hover:bg-white/10 text-[#8fa9bb] hover:text-white border border-white/5'
              }`}
              title="Lock meeting to prevent new participants"
            >
              {isRoomLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isRoomLocked ? 'Room Locked' : 'Lock Room'}</span>
            </button>
          )}
        </div>
      </footer>

      {/* Security & Room Verification Modal */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-[rgba(0,210,255,0.35)] bg-gradient-to-b from-[#072439] to-[#010e19] p-6 text-white shadow-2xl space-y-5 relative">
            <button
              onClick={() => setIsSecurityModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-[#7c97aa] hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#20f5a2]/20 to-[#00cfff]/20 border border-[#20f5a2]/40 flex items-center justify-center text-[#20f5a2]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Meeting Security & Privacy</h3>
                <p className="text-xs text-[#8fa9bb]">SpeakMate Microsoft Teams Room Protection</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[#718b9e] block">Encryption Architecture:</span>
                <strong className="text-[#20f5a2] block">AES-256 WebRTC Direct Media Streams</strong>
                <p className="text-[11px] text-[#8fa9bb] mt-0.5">
                  Audio, video, and screen shares are transmitted directly between participants peer-to-peer.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                <div>
                  <strong className="block text-white">Meeting Lock</strong>
                  <span className="text-[11px] text-[#718b9e]">
                    {isRoomLocked ? 'No new users may enter' : 'Open for peers with Room ID'}
                  </span>
                </div>
                {isHost && (
                  <button
                    onClick={() => toggleRoomLock(!isRoomLocked)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      isRoomLocked ? 'bg-amber-400 text-[#00131c]' : 'bg-[#20f5a2] text-[#00131c]'
                    }`}
                  >
                    {isRoomLocked ? 'Unlock Room' : 'Lock Room'}
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#718b9e]">Unique Room ID:</span>
                  <span className="font-mono text-[#00cfff] font-bold">{activeRoom?.id}</span>
                </div>
                <button
                  onClick={handleCopyShareLink}
                  className="w-full py-2 rounded-lg bg-[rgba(0,210,255,0.15)] hover:bg-[rgba(0,210,255,0.25)] text-white text-xs font-semibold transition-colors"
                >
                  {copiedLink ? 'Invite Link Copied!' : 'Copy Direct Invite Link'}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(false)}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Security Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Room Confirmation Dialog */}
      {isLeaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-[rgba(0,210,255,0.3)] bg-gradient-to-b from-[#09253d] to-[#020e1a] p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Leave Teams Meeting?</h3>
                <p className="text-xs text-[#8ca8ba]">Your camera, audio, and screen session will end.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsLeaveConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#8ca8ba] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Stay in Meeting
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeaveConfirmOpen(false);
                  if (localStream) localStream.getTracks().forEach((track) => track.stop());
                  if (screenStream) screenStream.getTracks().forEach((track) => track.stop());
                  leaveRoom();
                  onNavigate('rooms');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
              >
                Leave Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Room Peer Feedback Modal */}
      <PostSessionFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={handleFeedbackDismiss}
        onSubmitted={handleFeedbackComplete}
        sessionData={{
          roomId: activeRoom?.id || 'SM-SESSION',
          practiceMode: activeRoom?.mode || practiceMode,
          durationFormatted: formatTimer(seconds),
          partnerName: partnerName,
        }}
      />
    </div>
  );
};
