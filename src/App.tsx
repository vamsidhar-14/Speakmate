import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BackgroundEffects } from './components/BackgroundEffects';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { PracticePage } from './pages/PracticePage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomPage } from './pages/RoomPage';
import { AICoachPage } from './pages/AICoachPage';
import { ProgressPage } from './pages/ProgressPage';
import { GlobalChatDrawer } from './components/GlobalChatDrawer';
import { LiveAIChatbot } from './components/LiveAIChatbot';
import { PracticeMode } from './types';
import { MessageSquare, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const protectedTabs = ['dashboard', 'practice', 'rooms', 'room', 'ai-coach', 'progress'];

const MainApp: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const {
    unreadCommunityCount,
    roomError,
    clearRoomError,
    joinRoom,
    incomingMatchInvite,
    acceptMatchInvite,
    declineMatchInvite,
  } = useSocket();

  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [selectedPracticeMode, setSelectedPracticeMode] = useState<PracticeMode>('General Communication');
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);

  // Global listener for Quick Match connection
  useEffect(() => {
    const handleQuickMatch = (e: any) => {
      const match = e.detail;
      if (match?.room) {
        setSelectedPracticeMode((match.room.mode as PracticeMode) || 'General Communication');
        setCurrentTab('room');
      }
    };
    window.addEventListener('speakmate:quick-match-found', handleQuickMatch);
    return () => window.removeEventListener('speakmate:quick-match-found', handleQuickMatch);
  }, []);

  // Return to rooms dashboard if a room error occurs while in room
  useEffect(() => {
    if (roomError && currentTab === 'room') {
      setCurrentTab('rooms');
    }
  }, [roomError, currentTab]);

  // Read URL parameters on mount for direct invite link (?joinRoom=... or ?room=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const inviteRoom = params.get('joinRoom') || params.get('room');
      if (inviteRoom && inviteRoom.trim()) {
        const cleanId = inviteRoom.trim();
        sessionStorage.setItem('pendingJoinRoomId', cleanId);
        sessionStorage.setItem('currentPracticeRoomId', cleanId);
      }
    }
  }, []);

  // Sync tab with authentication state and auto-join room if invited
  useEffect(() => {
    if (!isLoading) {
      const pendingRoom = sessionStorage.getItem('pendingJoinRoomId');
      if (isLoggedIn) {
        if (pendingRoom) {
          sessionStorage.removeItem('pendingJoinRoomId');
          sessionStorage.setItem('currentPracticeRoomId', pendingRoom);
          joinRoom(pendingRoom);
          setCurrentTab('room');
          // Clean URL parameter without reload
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (currentTab === 'landing' || currentTab === 'login' || currentTab === 'signup') {
          setCurrentTab('dashboard');
        }
      } else if (!isLoggedIn) {
        if (pendingRoom || protectedTabs.includes(currentTab)) {
          setCurrentTab('login');
        }
      }
    }
  }, [isLoggedIn, isLoading]);

  const handleNavigate = (tab: string, mode?: PracticeMode) => {
    if (mode) {
      setSelectedPracticeMode(mode);
    }

    // Protection check
    if (!isLoggedIn && protectedTabs.includes(tab)) {
      setCurrentTab('login');
    } else {
      setCurrentTab(tab);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading Screen while Firebase restores auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020b18] text-white space-y-5 relative selection:bg-[#20f5a2] selection:text-[#00131c]">
        <BackgroundEffects />
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00cfff] flex items-center justify-center font-bold text-3xl text-[#00131c] animate-pulse shadow-[0_0_35px_rgba(32,245,162,0.5)] z-10">
          S
        </div>
        <div className="text-center space-y-1.5 z-10">
          <div className="text-sm font-bold text-white tracking-wide uppercase flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#20f5a2] animate-ping" />
            <span>SpeakMate Authentication</span>
          </div>
          <p className="text-xs text-[#7c9cb0]">Connecting to Firebase Authentication &amp; Firestore...</p>
        </div>
      </div>
    );
  }

  // Active page resolution
  const renderCurrentPage = () => {
    if (!isLoggedIn && protectedTabs.includes(currentTab)) {
      return <LoginPage onNavigate={handleNavigate} />;
    }

    switch (currentTab) {
      case 'landing':
        return <LandingPage onNavigate={handleNavigate} />;
      case 'login':
        return <LoginPage onNavigate={handleNavigate} />;
      case 'signup':
        return <SignupPage onNavigate={handleNavigate} />;
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={handleNavigate}
            onOpenChat={() => setIsGlobalChatOpen(true)}
          />
        );
      case 'practice':
        return <PracticePage initialMode={selectedPracticeMode} onNavigate={handleNavigate} />;
      case 'rooms':
        return <RoomsPage onNavigate={handleNavigate} />;
      case 'room':
        return <RoomPage practiceMode={selectedPracticeMode} onNavigate={handleNavigate} />;
      case 'ai-coach':
        return <AICoachPage />;
      case 'progress':
        return <ProgressPage onNavigate={handleNavigate} />;
      default:
        return <LandingPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-[#20f5a2] selection:text-[#00131c]">
      <BackgroundEffects />
      <Navbar
        currentTab={currentTab}
        setCurrentTab={handleNavigate}
        onOpenGlobalChat={() => setIsGlobalChatOpen(true)}
      />

      {/* In-App Room Notification Toast */}
      {roomError && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm p-4 rounded-2xl bg-[#1f0b0b]/95 border border-rose-500/40 text-white shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in slide-in-from-top-3 duration-200">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm shrink-0">
            !
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-rose-300">Room Notice</div>
            <div className="text-xs text-[#e8d5d5] truncate">{roomError}</div>
          </div>
          <button
            onClick={clearRoomError}
            className="p-1 rounded-lg text-[#b89f9f] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <main className="flex-1 relative z-10">{renderCurrentPage()}</main>

      {/* Floating Real-Time Community Chat Trigger Button */}
      {currentTab !== 'room' && (
        <button
          onClick={() => setIsGlobalChatOpen(true)}
          className="fixed bottom-6 left-6 z-40 px-3.5 py-2.5 rounded-full bg-[rgba(3,25,42,0.85)] border border-[rgba(0,210,255,0.3)] text-white text-xs font-semibold shadow-[0_8px_25px_rgba(0,0,0,0.5)] hover:border-[#20f5a2] hover:text-[#20f5a2] backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer group"
          title="Open Student Community Chat"
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4 text-[#20f5a2]" />
            {unreadCommunityCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#00cfff] absolute -top-1 -right-1 animate-ping" />
            )}
          </div>
          <span className="hidden sm:inline">Peer Chat</span>
          {unreadCommunityCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#20f5a2] text-[#00131c] text-[10px] font-extrabold">
              {unreadCommunityCount > 9 ? '9+' : unreadCommunityCount}
            </span>
          )}
        </button>
      )}

      {/* Real-Time Live AI Chatbot for instant doubts */}
      {currentTab !== 'room' && <LiveAIChatbot />}

      {/* Real-time Global Community Chat Drawer */}
      <GlobalChatDrawer
        isOpen={isGlobalChatOpen}
        onClose={() => setIsGlobalChatOpen(false)}
        onNavigateToRooms={() => {
          setIsGlobalChatOpen(false);
          handleNavigate('rooms');
        }}
      />

      {/* Global Incoming Quick Match Challenge Modal */}
      {incomingMatchInvite && currentTab !== 'room' && (
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
                onClick={() => {
                  acceptMatchInvite(incomingMatchInvite);
                  setSelectedPracticeMode(incomingMatchInvite.mode as PracticeMode);
                  setCurrentTab('room');
                }}
                className="flex-1 py-3 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_4px_20px_rgba(32,245,162,0.35)] hover:shadow-[0_6px_25px_rgba(32,245,162,0.5)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-[#00131c]" />
                <span>Accept &amp; Enter Room</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ThemeProvider>
          <MainApp />
        </ThemeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
