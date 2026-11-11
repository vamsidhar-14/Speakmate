import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Plus,
  ArrowUpRight,
  Users,
  Lock,
  Globe,
  Check,
  AlertCircle,
  Copy,
  RefreshCw,
  Search,
  Sparkles,
  KeyRound,
  Radio,
  DoorOpen,
  ShieldCheck,
  X,
  Zap,
  Clock,
  UserCheck,
  Award,
  Target,
} from 'lucide-react';
import { PracticeMode, OnlineStudent } from '../types';

interface RoomsPageProps {
  onNavigate: (tab: string, mode?: PracticeMode) => void;
}

export const RoomsPage: React.FC<RoomsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const {
    publicRooms,
    createRoom,
    joinRoom,
    lookupRoom,
    verifyRoom,
    isConnected,
    isSearchingMatch,
    searchStatus,
    latestMatchData,
    incomingMatchInvite,
    findPartner,
    cancelFindPartner,
    sendMatchInvite,
    acceptMatchInvite,
    declineMatchInvite,
    clearMatchInvite,
    onlineStudents,
    socket,
  } = useSocket();

  const [activeTab, setActiveTab] = useState<'quick-match' | 'join' | 'create'>('quick-match');
  const [roomType, setRoomType] = useState<'public' | 'private'>('public');
  const [capacity, setCapacity] = useState<number>(2);
  const [selectedMode, setSelectedMode] = useState<PracticeMode>('General Communication');

  // Quick Match State
  const [quickMatchTopic, setQuickMatchTopic] = useState<PracticeMode>('Technical Interview');
  const [quickMatchLevel, setQuickMatchLevel] = useState<string>(() => user?.level || 'Intermediate');
  const [quickMatchFormat, setQuickMatchFormat] = useState<'one-to-one' | 'small-group'>('one-to-one');
  const [searchTimer, setSearchTimer] = useState<number>(0);
  const [matchSuccessData, setMatchSuccessData] = useState<any | null>(null);
  const [invitingPeerSocketId, setInvitingPeerSocketId] = useState<string | null>(null);

  // Custom Unique Room ID state for creation
  const generateRandomRoomId = () => `SM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const [customRoomId, setCustomRoomId] = useState<string>(generateRandomRoomId);
  const [copiedCreateId, setCopiedCreateId] = useState(false);
  const [copiedListRoomId, setCopiedListRoomId] = useState<string | null>(null);

  // Join by unique Room ID state
  const [joinInputId, setJoinInputId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    status: 'idle' | 'found' | 'not-found' | 'error';
    room?: any;
    message?: string;
  }>({ status: 'idle' });

  // Modal for answering correct unique room ID when clicking to join
  const [selectedRoomToJoin, setSelectedRoomToJoin] = useState<any | null>(null);
  const [modalAnswerId, setModalAnswerId] = useState('');
  const [modalAnswerError, setModalAnswerError] = useState<string | null>(null);
  const [isModalVerifying, setIsModalVerifying] = useState(false);

  // List of active modes
  const practiceModes: PracticeMode[] = [
    'Technical Interview',
    'HR & Behavioral Interview',
    'General Communication',
    'Group Discussion',
    'Casual Chit-Chat',
  ];

  const skillLevelTiers = [
    { id: 'Beginner', label: 'Beginner', desc: 'Grammar, vocabulary & fundamentals' },
    { id: 'Intermediate', label: 'Intermediate', desc: 'Fluent conversational practice & questions' },
    { id: 'Advanced', label: 'Advanced', desc: 'Complex debate, articulation & technical nuance' },
    { id: 'Native / Fluent', label: 'Fluent', desc: 'Professional polish & executive presence' },
  ];

  // Helper for computing skill tier rank
  const getSkillTierRank = (lvl?: string) => {
    if (!lvl) return 2;
    const l = lvl.toLowerCase();
    if (l.includes('begin') || l.includes('basic') || l.includes('a1') || l.includes('a2')) return 1;
    if (l.includes('inter') || l.includes('b1') || l.includes('b2')) return 2;
    if (l.includes('adv') || l.includes('c1')) return 3;
    if (l.includes('fluent') || l.includes('native') || l.includes('expert') || l.includes('c2')) return 4;
    return 2;
  };

  // Helper for peer compatibility
  const computePeerCompatibility = (peerLevel: string, peerTopic: string) => {
    const userRank = getSkillTierRank(quickMatchLevel);
    const peerRank = getSkillTierRank(peerLevel);
    const diff = Math.abs(userRank - peerRank);

    const isTopicMatch = (peerTopic || '').toLowerCase().trim() === quickMatchTopic.toLowerCase().trim();
    let score = isTopicMatch ? 50 : 35;
    if (diff === 0) score += 50;
    else if (diff === 1) score += 35;
    else score += 15;

    return {
      score: Math.min(100, score),
      isSimilarSkill: diff <= 1,
      isExactLevel: diff === 0,
      isTopicMatch,
    };
  };

  // Active online peers compatible with the selected criteria
  const compatibleOnlinePeers = onlineStudents.filter((st) => {
    if (st.name === user?.fullName) return false;
    if (st.socketId && socket?.id && st.socketId === socket.id) return false;
    if (st.status !== 'AVAILABLE') return false;
    const comp = computePeerCompatibility(st.level, st.mode);
    return comp.isSimilarSkill;
  });

  // Track search timer while searching
  useEffect(() => {
    let interval: any;
    if (isSearchingMatch) {
      setSearchTimer(0);
      interval = setInterval(() => {
        setSearchTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setSearchTimer(0);
    }
    return () => clearInterval(interval);
  }, [isSearchingMatch]);

  const navigatedRoomIdRef = useRef<string | null>(null);

  // Real-time auto-navigation when match is found
  useEffect(() => {
    const handleQuickMatch = (e: any) => {
      const match = e.detail;
      if (match?.room && navigatedRoomIdRef.current !== match.room.id) {
        navigatedRoomIdRef.current = match.room.id;
        setMatchSuccessData(match);
        setTimeout(() => {
          onNavigate('room', (match.room.mode as PracticeMode) || quickMatchTopic);
        }, 1500);
      }
    };

    window.addEventListener('fluencis:quick-match-found', handleQuickMatch);
    window.addEventListener('speakmate:quick-match-found', handleQuickMatch);
    return () => {
      window.removeEventListener('fluencis:quick-match-found', handleQuickMatch);
      window.removeEventListener('speakmate:quick-match-found', handleQuickMatch);
    };
  }, [onNavigate, quickMatchTopic]);

  // Also sync latestMatchData if received via context
  useEffect(() => {
    if (latestMatchData && latestMatchData.room && navigatedRoomIdRef.current !== latestMatchData.room.id) {
      navigatedRoomIdRef.current = latestMatchData.room.id;
      setMatchSuccessData(latestMatchData);
      const timer = setTimeout(() => {
        onNavigate('room', (latestMatchData.room.mode as PracticeMode) || quickMatchTopic);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [latestMatchData, onNavigate, quickMatchTopic]);

  // Refresh public rooms from backend
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendRooms, setBackendRooms] = useState<any[]>(publicRooms);

  const fetchRoomsFromBackend = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setBackendRooms(data.rooms);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch rooms from backend:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setBackendRooms(publicRooms);
  }, [publicRooms]);

  // Auto-fill room ID if invited via link or pending session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('joinRoom') || params.get('room');
      const pending = urlId || sessionStorage.getItem('pendingJoinRoomId');
      if (pending && pending.trim()) {
        const clean = pending.trim();
        setJoinInputId(clean);
        setActiveTab('join');
      }
    }
  }, []);

  const handleCopyCreateId = () => {
    navigator.clipboard.writeText(customRoomId.trim());
    setCopiedCreateId(true);
    setTimeout(() => setCopiedCreateId(false), 2000);
  };

  const handleStartQuickMatch = () => {
    findPartner(quickMatchTopic, quickMatchFormat, quickMatchLevel);
  };

  const handleCancelQuickMatch = () => {
    cancelFindPartner();
  };

  const handleInvitePeer = (peer: OnlineStudent) => {
    if (!peer.socketId) return;
    setInvitingPeerSocketId(peer.socketId);
    sendMatchInvite(peer.socketId, quickMatchTopic, quickMatchLevel);
    setTimeout(() => setInvitingPeerSocketId(null), 4000);
  };

  const handleCreate = () => {
    const finalRoomId = customRoomId.trim() || generateRandomRoomId();
    createRoom(roomType, selectedMode, capacity, finalRoomId);
    onNavigate('room', selectedMode);
  };

  const handleVerifyRoom = async () => {
    const cleanId = joinInputId.trim();
    if (!cleanId) {
      setVerifyResult({ status: 'not-found', message: 'Please enter a Room ID (e.g. vamsi@2317 or SM-XXXXXX)' });
      return;
    }

    setIsVerifying(true);
    setVerifyResult({ status: 'idle' });

    try {
      const res = await lookupRoom(cleanId);
      if (res.exists && res.room) {
        setVerifyResult({
          status: 'found',
          room: res.room,
          message: `Room found! Hosted by ${res.room.host}`,
        });
      } else {
        setVerifyResult({
          status: 'not-found',
          message: res.message || `Room "${cleanId}" does not exist or has already closed.`,
        });
      }
    } catch {
      setVerifyResult({
        status: 'error',
        message: 'Could not connect to room server. Please check connection.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleJoinByInputId = async () => {
    const cleanId = joinInputId.trim();
    if (!cleanId) {
      setVerifyResult({ status: 'not-found', message: 'Please enter a Room ID (e.g. vamsi@2317 or SM-XXXXXX)' });
      return;
    }

    setIsVerifying(true);
    setVerifyResult({ status: 'idle' });

    try {
      const res = await lookupRoom(cleanId);
      if (res.exists && res.room) {
        joinRoom(cleanId);
        onNavigate('room', (res.room.mode as PracticeMode) || selectedMode);
      } else {
        setVerifyResult({
          status: 'not-found',
          message: res.message || `Room "${cleanId}" does not exist or has expired. Please verify with the host.`,
        });
      }
    } catch {
      joinRoom(cleanId);
      onNavigate('room', selectedMode);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleJoinDirect = (roomId: string, mode?: string) => {
    joinRoom(roomId);
    onNavigate('room', (mode as PracticeMode) || selectedMode);
  };

  const handleOpenJoinModal = (room: any) => {
    setSelectedRoomToJoin(room);
    setModalAnswerId('');
    setModalAnswerError(null);
  };

  const handleConfirmAnswerAndJoin = async () => {
    if (!selectedRoomToJoin) return;
    const entered = modalAnswerId.trim();
    const target = (selectedRoomToJoin.id || '').trim();

    if (!entered) {
      setModalAnswerError('Please type the Unique Room ID to verify and join.');
      return;
    }

    if (entered.toLowerCase() !== target.toLowerCase()) {
      setModalAnswerError(
        `Incorrect Room ID! To enter ${selectedRoomToJoin.host}'s room, you must enter the exact unique Room ID: "${target}".`
      );
      return;
    }

    setIsModalVerifying(true);
    setModalAnswerError(null);
    try {
      const res = await verifyRoom(target, entered);
      if (res.valid) {
        joinRoom(target);
        setSelectedRoomToJoin(null);
        onNavigate('room', (selectedRoomToJoin.mode as PracticeMode) || selectedMode);
      } else {
        setModalAnswerError(res.message || 'Verification failed. Please check the Room ID.');
      }
    } catch {
      joinRoom(target);
      setSelectedRoomToJoin(null);
      onNavigate('room', (selectedRoomToJoin.mode as PracticeMode) || selectedMode);
    } finally {
      setIsModalVerifying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 relative z-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20f5a2] shadow-[0_0_10px_#20f5a2] animate-pulse" />
            <p className="text-xs font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
              FLUENCIS REAL-TIME BACKEND ROOMS
            </p>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Join or Create a{' '}
            <span className="bg-gradient-to-r from-[#20f5a2] to-[#00cfff] bg-clip-text text-transparent">
              Practice Room.
            </span>
          </h1>
          <p className="text-sm text-[#9eb6c8] max-w-xl leading-relaxed">
            Connect directly with classmates using a unique Room ID, or create a custom room with real-time audio, video, and live peer feedback.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl border border-[rgba(0,220,255,0.25)] bg-[rgba(3,28,45,0.7)] shrink-0 min-w-[200px] flex items-center justify-between gap-4">
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-[#6e889b] mb-1">
              Backend Status
            </span>
            <strong className="text-xs text-[#20f5a2] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#20f5a2]' : 'bg-amber-400'}`} />
              {isConnected ? 'Real Backend Connected' : 'Connecting to Server...'}
            </strong>
          </div>
          <button
            onClick={fetchRoomsFromBackend}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-[#7896a9] hover:text-[#20f5a2] hover:bg-white/5 transition-colors cursor-pointer"
            title="Refresh active rooms from backend"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#20f5a2]' : ''}`} />
          </button>
        </div>
      </section>

      {/* Main Panel */}
      <section className="p-6 sm:p-9 rounded-3xl border border-[rgba(0,210,255,0.2)] bg-gradient-to-br from-[rgba(10,50,75,0.62)] to-[rgba(2,15,30,0.92)] shadow-2xl backdrop-blur-xl space-y-8">
        {/* Action Toggle (Quick Match vs Join with Unique ID vs Create with Unique ID) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab('quick-match')}
            className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all cursor-pointer ${
              activeTab === 'quick-match'
                ? 'border-[#20f5a2] bg-gradient-to-br from-[rgba(32,245,162,0.18)] to-[rgba(0,170,255,0.12)] shadow-[0_0_30px_rgba(32,245,162,0.2)] translate-y-[-2px]'
                : 'border-[rgba(0,210,255,0.22)] bg-[rgba(1,15,30,0.55)] hover:border-[#20f5a2]'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#20f5a2]/25 to-[#00cfff]/25 border border-[rgba(32,245,162,0.4)] flex items-center justify-center text-[#20f5a2] shrink-0 shadow-[0_0_15px_rgba(32,245,162,0.3)]">
              <Zap className="w-5 h-5 fill-[#20f5a2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <strong className="block text-sm text-white">Quick Match</strong>
                <span className="text-[9px] uppercase font-extrabold bg-[#20f5a2] text-[#00131c] px-1.5 py-0.5 rounded-full">
                  SMART
                </span>
              </div>
              <span className="text-xs text-[#8fa9bb] block leading-relaxed">
                Auto-find an active peer with similar skill level &amp; topic.
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all cursor-pointer ${
              activeTab === 'join'
                ? 'border-[#20f5a2] bg-gradient-to-br from-[rgba(32,245,162,0.12)] to-[rgba(0,170,255,0.08)] shadow-[0_0_25px_rgba(32,245,162,0.12)] translate-y-[-2px]'
                : 'border-[rgba(0,210,255,0.22)] bg-[rgba(1,15,30,0.55)] hover:border-[#20f5a2]'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[rgba(32,245,162,0.17)] to-[rgba(0,170,255,0.17)] border border-[rgba(0,220,255,0.22)] flex items-center justify-center text-[#20f5a2] shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <strong className="block text-sm text-white mb-1">Join by Room ID</strong>
              <span className="text-xs text-[#8fa9bb] block leading-relaxed">
                Enter a unique room code from your peer or select an active public room.
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'border-[#20f5a2] bg-gradient-to-br from-[rgba(32,245,162,0.12)] to-[rgba(0,170,255,0.08)] shadow-[0_0_25px_rgba(32,245,162,0.12)] translate-y-[-2px]'
                : 'border-[rgba(0,210,255,0.22)] bg-[rgba(1,15,30,0.55)] hover:border-[#20f5a2]'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[rgba(32,245,162,0.17)] to-[rgba(0,170,255,0.17)] border border-[rgba(0,220,255,0.22)] flex items-center justify-center text-[#20f5a2] shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <strong className="block text-sm text-white mb-1">Create Unique Room</strong>
              <span className="text-xs text-[#8fa9bb] block leading-relaxed">
                Choose a custom Room ID or generate one, set capacity, and invite classmates.
              </span>
            </div>
          </button>
        </div>

        {/* WORKSPACE AREA: QUICK MATCH */}
        {activeTab === 'quick-match' && (
          <div className="space-y-8 pt-4 border-t border-[rgba(0,210,255,0.15)] animate-in fade-in duration-200">
            {/* Quick Match Hero Banner */}
            <div className="p-6 sm:p-7 rounded-2xl border border-[rgba(32,245,162,0.3)] bg-gradient-to-br from-[rgba(32,245,162,0.1)] via-[rgba(0,190,255,0.07)] to-[rgba(1,15,30,0.85)] relative overflow-hidden space-y-4 shadow-xl">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-[#20f5a2]/15 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#20f5a2] animate-ping" />
                    <span className="text-[11px] font-extrabold tracking-widest text-[#20f5a2] uppercase">
                      ⚡ REAL-TIME SKILL-BASED MATCHMAKING
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Smart Instant Pair
                  </h2>
                  <p className="text-xs text-[#9eb6c8] max-w-xl leading-relaxed">
                    Our real-time engine scans online students to pair you with someone at a complementary skill level (±1 tier) for your chosen topic. Once paired, you are automatically launched into a private room.
                  </p>
                </div>

                <div className="px-4 py-2.5 rounded-xl border border-[#20f5a2]/30 bg-black/40 backdrop-blur-md shrink-0 flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#20f5a2] shadow-[0_0_8px_#20f5a2] animate-pulse" />
                  <span className="text-xs font-semibold text-white">
                    <strong className="text-[#20f5a2]">{compatibleOnlinePeers.length}</strong> compatible student{compatibleOnlinePeers.length === 1 ? '' : 's'} online
                  </span>
                </div>
              </div>

              {/* Match Found State Banner */}
              {matchSuccessData && (
                <div className="p-5 rounded-2xl border-2 border-[#20f5a2] bg-[rgba(32,245,162,0.18)] shadow-[0_0_35px_rgba(32,245,162,0.35)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#20f5a2] to-[#00cfff] text-[#00131c] flex items-center justify-center font-black text-xl shadow-lg shrink-0">
                      ⚡
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-base">
                          Match Found! Paired with {matchSuccessData.partner?.name || 'Classmate'}
                        </strong>
                        <span className="text-xs bg-[#20f5a2] text-[#00131c] font-bold px-2.5 py-0.5 rounded-full">
                          {matchSuccessData.matchScore || 95}% Match
                        </span>
                      </div>
                      <p className="text-xs text-[#d2f8e8] mt-0.5">
                        {matchSuccessData.reason || `Practicing ${quickMatchTopic}`} · Room{' '}
                        <strong className="font-mono text-white underline">{matchSuccessData.roomId}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-white bg-[#00131c]/60 px-4 py-2 rounded-xl border border-white/20">
                    <span className="w-2 h-2 rounded-full bg-[#20f5a2] animate-ping" />
                    <span>Launching Room...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Criteria Selectors (Topic, Skill Level, Format) */}
            <div className="space-y-6">
              {/* Step 1: Select Topic */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-widest text-[#20f5a2] uppercase flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-[#20f5a2]" />
                    <span>STEP 1: PREFERRED PRACTICE TOPIC</span>
                  </span>
                  <span className="text-[11px] text-[#7896a9]">Matches students focusing on this track</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {practiceModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setQuickMatchTopic(mode)}
                      className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        quickMatchTopic === mode
                          ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.12)] text-white shadow-[0_0_15px_rgba(32,245,162,0.15)]'
                          : 'border-[rgba(0,210,255,0.18)] bg-[rgba(1,15,30,0.5)] text-[#8fa9bb] hover:border-[#20f5a2]/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles
                          className={`w-4 h-4 ${
                            quickMatchTopic === mode ? 'text-[#20f5a2]' : 'text-[#6e889b]'
                          }`}
                        />
                        <span className="text-xs font-semibold">{mode}</span>
                      </div>
                      {quickMatchTopic === mode && (
                        <Check className="w-4 h-4 text-[#20f5a2] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Select Skill Level */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-widest text-[#20f5a2] uppercase flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#20f5a2]" />
                    <span>STEP 2: YOUR CURRENT SKILL LEVEL</span>
                  </span>
                  <span className="text-[11px] text-[#00cfff] font-mono">
                    Balanced matching: within ±1 skill tier
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {skillLevelTiers.map((tier) => {
                    const isSelected = quickMatchLevel === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setQuickMatchLevel(tier.id)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-full ${
                          isSelected
                            ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.14)] text-white shadow-[0_0_20px_rgba(32,245,162,0.18)]'
                            : 'border-[rgba(0,210,255,0.18)] bg-[rgba(1,15,30,0.5)] text-[#8fa9bb] hover:border-[#20f5a2]/60 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <strong className="text-sm font-bold text-white">{tier.label}</strong>
                          {isSelected && <Check className="w-4 h-4 text-[#20f5a2]" />}
                        </div>
                        <p className="text-[11px] text-[#71899b] leading-relaxed">
                          {tier.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Session Format */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold tracking-widest text-[#20f5a2] uppercase flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#20f5a2]" />
                  <span>STEP 3: MATCH FORMAT</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <button
                    type="button"
                    onClick={() => setQuickMatchFormat('one-to-one')}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      quickMatchFormat === 'one-to-one'
                        ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.12)] text-white'
                        : 'border-[rgba(0,210,255,0.18)] bg-[rgba(1,15,30,0.5)] text-[#8fa9bb]'
                    }`}
                  >
                    <div>
                      <strong className="block text-xs font-bold text-white">1-to-1 Live Practice</strong>
                      <span className="text-[10px] text-[#71899b]">Pair with 1 student (2 total)</span>
                    </div>
                    {quickMatchFormat === 'one-to-one' && <Check className="w-4 h-4 text-[#20f5a2]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickMatchFormat('small-group')}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      quickMatchFormat === 'small-group'
                        ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.12)] text-white'
                        : 'border-[rgba(0,210,255,0.18)] bg-[rgba(1,15,30,0.5)] text-[#8fa9bb]'
                    }`}
                  >
                    <div>
                      <strong className="block text-xs font-bold text-white">Small Group Practice</strong>
                      <span className="text-[10px] text-[#71899b]">Up to 4 students</span>
                    </div>
                    {quickMatchFormat === 'small-group' && <Check className="w-4 h-4 text-[#20f5a2]" />}
                  </button>
                </div>
              </div>
            </div>

            {/* ACTION & RADAR CONTROLS */}
            <div className="p-6 rounded-2xl border border-[rgba(0,210,255,0.22)] bg-[rgba(2,16,30,0.7)] space-y-6">
              {!isSearchingMatch ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                  <div className="space-y-1 text-center sm:text-left">
                    <strong className="text-white text-sm sm:text-base block">
                      Ready to practice? Click below to begin live matchmaking.
                    </strong>
                    <p className="text-xs text-[#71899b]">
                      Matches you with active students with similar proficiency ({quickMatchLevel} ±1 tier) focusing on {quickMatchTopic}.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartQuickMatch}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] via-[#00e1ff] to-[#00a6ff] shadow-[0_8px_30px_rgba(32,245,162,0.35)] hover:shadow-[0_12px_40px_rgba(32,245,162,0.5)] hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2.5 cursor-pointer shrink-0"
                  >
                    <Zap className="w-5 h-5 fill-[#00131c]" />
                    <span>Find Practice Match Now</span>
                  </button>
                </div>
              ) : (
                /* LIVE RADAR SCANNING STATE */
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-5 animate-in fade-in duration-300">
                  {/* Concentric Radar Rings */}
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-[#20f5a2]/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full border border-[#00cfff]/30 animate-pulse" />
                    <div className="absolute inset-5 rounded-full border border-[#20f5a2]/40" />
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center text-[#00131c] shadow-[0_0_25px_rgba(32,245,162,0.6)]">
                      <Zap className="w-7 h-7 fill-[#00131c] animate-bounce" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 text-[#20f5a2]" />
                      <span className="font-mono text-xs font-bold text-[#20f5a2]">
                        Searching: 00:{searchTimer < 10 ? `0${searchTimer}` : searchTimer}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Scanning Active Classmates...
                    </h3>
                    <p className="text-xs text-[#8fa9bb] max-w-md">
                      {searchStatus?.message || `Looking for practice partner in "${quickMatchTopic}" with "${quickMatchLevel}" skill tier.`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white font-medium">
                      Topic: <strong className="text-[#00cfff]">{quickMatchTopic}</strong>
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white font-medium">
                      Skill: <strong className="text-[#20f5a2]">{quickMatchLevel}</strong>
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white font-medium">
                      Format: <strong className="text-white">{quickMatchFormat}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelQuickMatch}
                    className="px-6 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-bold hover:bg-rose-500/20 hover:border-rose-500/50 transition-colors cursor-pointer"
                  >
                    Cancel Matchmaking
                  </button>
                </div>
              )}
            </div>

            {/* LIVE ONLINE STUDENTS MATCHING RADAR LIST */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
                    ACTIVE CLASSMATES WITH COMPATIBLE SKILLS
                  </span>
                  <p className="text-xs text-[#71899b]">
                    Live active students currently connected to the server
                  </p>
                </div>
                <span className="text-xs text-[#20f5a2] font-semibold">
                  {compatibleOnlinePeers.length} matching peer{compatibleOnlinePeers.length === 1 ? '' : 's'} online
                </span>
              </div>

              {compatibleOnlinePeers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {compatibleOnlinePeers.map((peer, idx) => {
                    const comp = computePeerCompatibility(peer.level, peer.mode);
                    const isInvitingThis = invitingPeerSocketId === peer.socketId;

                    return (
                      <div
                        key={peer.socketId || idx}
                        className="p-4 rounded-2xl border border-[rgba(0,210,255,0.2)] bg-[rgba(2,18,32,0.6)] flex items-center justify-between gap-3 hover:border-[#20f5a2]/60 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#20f5a2] to-[#00aaff] text-[#00131c] font-black text-sm flex items-center justify-center shrink-0">
                            {peer.name ? peer.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <strong className="text-sm text-white truncate">{peer.name}</strong>
                              <span className="text-[9px] bg-[#20f5a2]/20 text-[#20f5a2] px-1.5 py-0.5 rounded-full font-bold uppercase">
                                {comp.score}% MATCH
                              </span>
                            </div>
                            <p className="text-[11px] text-[#71899b] truncate">
                              Skill: <span className="text-white font-medium">{peer.level}</span> · Topic: <span className="text-[#00cfff]">{peer.mode}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleInvitePeer(peer)}
                          disabled={isInvitingThis}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[rgba(32,245,162,0.15)] border border-[#20f5a2]/40 text-[#20f5a2] hover:bg-[#20f5a2] hover:text-[#00131c] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{isInvitingThis ? 'Inviting...' : 'Instant Match'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center space-y-2">
                  <p className="text-xs text-[#8fa9bb]">
                    No other classmates are currently in the queue for this specific topic and skill tier.
                  </p>
                  <p className="text-[11px] text-[#607a8c]">
                    Click <strong>Find Practice Match Now</strong> to queue up, or open a second browser window to test live pairing!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE AREA: JOIN ROOM */}
        {activeTab === 'join' && (
          <div className="space-y-8 pt-4 border-t border-[rgba(0,210,255,0.15)]">
            {/* Join by Unique Room ID Card */}
            <div className="p-6 rounded-2xl border border-[rgba(0,210,255,0.25)] bg-[rgba(1,15,30,0.7)] space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#20f5a2]" />
                <span className="text-[11px] font-bold tracking-widest text-[#20f5a2] uppercase">
                  ENTER UNIQUE ROOM ID
                </span>
              </div>
              <p className="text-xs text-[#8fa9bb]">
                Have a room code from a classmate or study partner? Type it below to connect directly to the real backend room.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={joinInputId}
                    onChange={(e) => {
                      setJoinInputId(e.target.value);
                      setVerifyResult({ status: 'idle' });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyRoom();
                    }}
                    placeholder="e.g. vamsi@2317 or SM-7K9A2B"
                    className="w-full px-4 py-3.5 rounded-xl bg-[rgba(3,25,42,0.8)] border border-[rgba(0,200,255,0.25)] text-white text-sm font-mono tracking-wider focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2]"
                  />
                  {joinInputId && (
                    <button
                      onClick={() => setJoinInputId('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6e889b] hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  onClick={handleVerifyRoom}
                  disabled={isVerifying || !joinInputId.trim()}
                  className="px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-[rgba(0,190,255,0.15)] border border-[rgba(0,210,255,0.35)] text-white hover:border-[#20f5a2] hover:bg-[#20f5a2] hover:text-[#00131c] transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>{isVerifying ? 'Checking...' : 'Check Room'}</span>
                </button>

                <button
                  onClick={handleJoinByInputId}
                  disabled={!joinInputId.trim()}
                  className="px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.4)] hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <DoorOpen className="w-4 h-4" />
                  <span>Join Room</span>
                </button>
              </div>

              {/* Verification status preview box */}
              {verifyResult.status === 'found' && verifyResult.room && (
                <div className="p-4 rounded-xl border border-[#20f5a2]/40 bg-[rgba(32,245,162,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] text-[#00131c] font-bold flex items-center justify-center text-sm">
                      {verifyResult.room.host ? verifyResult.room.host.charAt(0).toUpperCase() : 'H'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-xs sm:text-sm">
                          {verifyResult.room.host}'s Room ({verifyResult.room.id})
                        </strong>
                        <span className="text-[10px] bg-[#20f5a2]/20 text-[#20f5a2] px-2 py-0.5 rounded-full font-bold uppercase">
                          Live Now
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8fa9bb]">
                        Mode: <span className="text-[#00cfff] font-medium">{verifyResult.room.mode}</span> ·{' '}
                        Participants: <strong className="text-white">{verifyResult.room.participantCount} / {verifyResult.room.capacity}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinDirect(verifyResult.room.id, verifyResult.room.mode)}
                    disabled={verifyResult.room.isFull}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#20f5a2] text-[#00131c] hover:shadow-[0_0_20px_rgba(32,245,162,0.5)] transition-all cursor-pointer disabled:opacity-40"
                  >
                    {verifyResult.room.isFull ? 'Room Full' : 'Enter Room Now →'}
                  </button>
                </div>
              )}

              {verifyResult.status === 'not-found' && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{verifyResult.message}</span>
                </div>
              )}
            </div>

            {/* Public Rooms List from Real Backend */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
                    AVAILABLE PUBLIC PRACTICE ROOMS
                  </span>
                  <p className="text-xs text-[#71899b]">Active rooms broadcast from the live server</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#20f5a2] font-semibold">
                    {backendRooms.length} room{backendRooms.length === 1 ? '' : 's'} live
                  </span>
                </div>
              </div>

              {backendRooms.length > 0 ? (
                <div className="grid gap-3">
                  {backendRooms.map((room) => {
                    const isFull = room.participants.length >= room.capacity;
                    return (
                      <div
                        key={room.id}
                        className="p-4 rounded-2xl border border-[rgba(0,210,255,0.18)] bg-[rgba(1,15,30,0.55)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[rgba(0,210,255,0.4)] transition-all"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center font-bold text-sm text-[#00131c] shrink-0">
                            {room.host ? room.host.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="block text-sm text-white">{room.host}'s Practice Session</strong>
                              <span className="text-[10px] font-mono text-[#00cfff] bg-[rgba(0,207,255,0.1)] px-2 py-0.5 rounded border border-[rgba(0,207,255,0.2)]">
                                {room.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#71899b] mt-0.5">
                              {room.mode} ·{' '}
                              <span className={isFull ? 'text-rose-400 font-bold' : 'text-[#20f5a2]'}>
                                {room.participants.length} / {room.capacity} students
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(room.id);
                              setCopiedListRoomId(room.id);
                              setTimeout(() => setCopiedListRoomId(null), 2000);
                            }}
                            title={copiedListRoomId === room.id ? 'Copied Room ID!' : 'Copy Room ID'}
                            className="p-2 rounded-xl text-[#6e889b] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            {copiedListRoomId === room.id ? (
                              <Check className="w-3.5 h-3.5 text-[#20f5a2]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleJoinDirect(room.id, room.mode)}
                            disabled={isFull}
                            className="px-4 py-2 rounded-xl font-bold text-xs bg-[rgba(0,170,255,0.12)] border border-[rgba(0,220,255,0.4)] text-white hover:border-[#20f5a2] hover:bg-[#20f5a2] hover:text-[#00131c] transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                          >
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>{isFull ? 'Room Full' : 'Join Room'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl border border-dashed border-[rgba(0,210,255,0.2)] bg-[rgba(1,15,30,0.4)] space-y-2">
                  <p className="text-xs text-[#8fa9bb]">
                    No public rooms are active right now. Be the first to create one!
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="text-xs text-[#20f5a2] font-bold hover:underline"
                  >
                    Create a unique room now →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE AREA: CREATE ROOM */}
        {activeTab === 'create' && (
          <div className="space-y-6 pt-4 border-t border-[rgba(0,210,255,0.15)]">
            {/* Step 1: Unique Room ID */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
                  STEP 1: UNIQUE ROOM ID
                </span>
                <button
                  type="button"
                  onClick={() => setCustomRoomId(generateRandomRoomId())}
                  className="text-xs text-[#00cfff] hover:text-[#20f5a2] flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate New ID</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customRoomId}
                  onChange={(e) => setCustomRoomId(e.target.value)}
                  placeholder="e.g. vamsi@2317 or custom room ID"
                  className="flex-1 px-4 py-3 rounded-xl bg-[rgba(3,25,42,0.8)] border border-[rgba(0,200,255,0.25)] text-white text-sm font-mono tracking-wider focus:outline-none focus:border-[#20f5a2]"
                />
                <button
                  type="button"
                  onClick={handleCopyCreateId}
                  className="px-4 py-3 rounded-xl border border-[rgba(0,210,255,0.25)] bg-[rgba(1,15,30,0.6)] text-[#8fa9bb] hover:text-[#20f5a2] hover:border-[#20f5a2] transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Copy Room ID to share with partner"
                >
                  {copiedCreateId ? <Check className="w-4 h-4 text-[#20f5a2]" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCreateId ? 'Copied!' : 'Copy ID'}</span>
                </button>
              </div>
              <p className="text-[11px] text-[#71899b]">
                Share this unique ID with your study partner so they can join directly.
              </p>
            </div>

            {/* Step 2: Practice Mode */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
                STEP 2: SELECT PRACTICE FOCUS
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {practiceModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      selectedMode === mode
                        ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.12)] text-[#20f5a2] font-bold'
                        : 'border-[rgba(0,210,255,0.15)] bg-[rgba(1,15,30,0.5)] text-[#8fa9bb] hover:border-[#20f5a2]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Privacy */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
                STEP 3: CHOOSE PRIVACY
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => setRoomType('public')}
                  className={`p-4 rounded-xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                    roomType === 'public'
                      ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.1)] text-white'
                      : 'border-[rgba(0,210,255,0.2)] bg-[rgba(1,15,30,0.5)] text-[#9fb5c6]'
                  }`}
                >
                  <Globe className="w-5 h-5 text-[#20f5a2]" />
                  <div>
                    <strong className="block text-xs text-white">Public Room</strong>
                    <span className="text-[11px] text-[#71899b]">Visible to other students in the room directory</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRoomType('private')}
                  className={`p-4 rounded-xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                    roomType === 'private'
                      ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.1)] text-white'
                      : 'border-[rgba(0,210,255,0.2)] bg-[rgba(1,15,30,0.5)] text-[#9fb5c6]'
                  }`}
                >
                  <Lock className="w-5 h-5 text-[#00cfff]" />
                  <div>
                    <strong className="block text-xs text-white">Private Room</strong>
                    <span className="text-[11px] text-[#71899b]">Only peers with your unique Room ID can enter</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 4: Capacity */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
                STEP 4: MAXIMUM PARTICIPANTS
              </span>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {[
                  { num: 2, label: '1-to-1' },
                  { num: 3, label: 'Small' },
                  { num: 4, label: 'Group' },
                  { num: 5, label: 'Group' },
                  { num: 8, label: 'Team' },
                ].map((cap) => (
                  <button
                    key={cap.num}
                    type="button"
                    onClick={() => setCapacity(cap.num)}
                    className={`py-3.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      capacity === cap.num
                        ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.12)] text-[#20f5a2]'
                        : 'border-[rgba(0,210,255,0.18)] bg-[rgba(1,15,30,0.5)] hover:border-[#20f5a2]'
                    }`}
                  >
                    <strong className="block text-lg font-bold">{cap.num}</strong>
                    <span className="block text-[10px] text-[#71899b]">{cap.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCreate}
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-xs sm:text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.4)] hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  Create Room &quot;{customRoomId}&quot; ({roomType.toUpperCase()}, {capacity} Max)
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Unique Room ID Answer & Verification Modal */}
      {selectedRoomToJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-[rgba(0,210,255,0.35)] bg-gradient-to-b from-[#051c2c] to-[#010e19] p-6 sm:p-8 shadow-2xl space-y-6 relative">
            <button
              onClick={() => {
                setSelectedRoomToJoin(null);
                setModalAnswerError(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#7896a9] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#20f5a2]/20 to-[#00cfff]/20 border border-[rgba(32,245,162,0.4)] flex items-center justify-center text-[#20f5a2]">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase block">
                  ROOM ID VERIFICATION
                </span>
                <h3 className="text-lg font-bold text-white">
                  Join {selectedRoomToJoin.host}&apos;s Room
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[rgba(1,15,30,0.6)] border border-[rgba(0,200,255,0.18)] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#8fa9bb]">
                <span>Focus Track:</span>
                <span className="text-white font-medium">{selectedRoomToJoin.mode}</span>
              </div>
              <div className="flex justify-between items-center text-[#8fa9bb]">
                <span>Participants:</span>
                <span className="text-[#20f5a2] font-semibold">
                  {selectedRoomToJoin.participants?.length || 0} / {selectedRoomToJoin.capacity}
                </span>
              </div>
              <div className="flex justify-between items-center text-[#8fa9bb] pt-1 border-t border-white/5">
                <span>Room Code Hint:</span>
                <span className="font-mono text-[#00cfff] font-bold">{selectedRoomToJoin.id}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#8fa9bb]">
                Please enter the correct Unique Room ID to confirm:
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={modalAnswerId}
                  onChange={(e) => {
                    setModalAnswerId(e.target.value);
                    setModalAnswerError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmAnswerAndJoin();
                  }}
                  placeholder={`e.g. ${selectedRoomToJoin.id}`}
                  className="w-full px-4 py-3.5 rounded-xl bg-[rgba(2,18,32,0.9)] border border-[rgba(0,210,255,0.3)] text-white font-mono text-sm tracking-wider focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2]"
                />
                <button
                  type="button"
                  onClick={() => setModalAnswerId(selectedRoomToJoin.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#20f5a2] hover:underline"
                >
                  Auto-fill
                </button>
              </div>

              {modalAnswerError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalAnswerError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRoomToJoin(null);
                  setModalAnswerError(null);
                }}
                className="flex-1 py-3.5 rounded-xl border border-[rgba(0,210,255,0.2)] bg-white/5 hover:bg-white/10 text-[#8fa9bb] hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAnswerAndJoin}
                disabled={isModalVerifying || !modalAnswerId.trim()}
                className="flex-1 py-3.5 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isModalVerifying ? 'Verifying...' : 'Confirm & Join'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Quick Match Challenge Modal */}
      {incomingMatchInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#20f5a2] bg-gradient-to-b from-[#051c2c] to-[#010e19] p-6 sm:p-7 shadow-[0_0_50px_rgba(32,245,162,0.35)] space-y-5 relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#20f5a2] to-[#00cfff] text-[#00131c] flex items-center justify-center font-black text-xl shadow-lg shrink-0">
                ⚡
              </div>
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-[#20f5a2] uppercase block">
                  LIVE QUICK MATCH REQUEST
                </span>
                <h3 className="text-base font-bold text-white">
                  {incomingMatchInvite.fromName} wants to practice!
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,200,255,0.2)] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#8fa9bb]">
                <span>Classmate:</span>
                <strong className="text-white">{incomingMatchInvite.fromName}</strong>
              </div>
              <div className="flex justify-between items-center text-[#8fa9bb]">
                <span>Skill Level:</span>
                <span className="text-[#20f5a2] font-semibold">{incomingMatchInvite.fromLevel}</span>
              </div>
              <div className="flex justify-between items-center text-[#8fa9bb]">
                <span>Practice Topic:</span>
                <span className="text-[#00cfff] font-medium">{incomingMatchInvite.mode}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#7896a9] leading-relaxed">
              Accepting will automatically launch a private 1-to-1 video room for you and {incomingMatchInvite.fromName}.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => declineMatchInvite(incomingMatchInvite)}
                className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[#8fa9bb] hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => acceptMatchInvite(incomingMatchInvite)}
                className="flex-1 py-3 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_4px_20px_rgba(32,245,162,0.35)] hover:shadow-[0_6px_25px_rgba(32,245,162,0.5)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-[#00131c]" />
                <span>Accept &amp; Enter Room</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
