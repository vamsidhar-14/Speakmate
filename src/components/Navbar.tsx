import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeMode } from '../types';
import { Moon, Palette, LogOut, Menu, X, Sparkles, MessageSquare, Video, ShieldCheck } from 'lucide-react';
import { FluencisLogo } from './FluencisLogo';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenGlobalChat?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenGlobalChat }) => {
  const { user, isLoggedIn, isOwner, logout } = useAuth();
  const { isConnected, onlineStudents, unreadCommunityCount } = useSocket();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'practice', label: 'Practice' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'ai-coach', label: 'AI Coach' },
    { id: 'progress', label: 'Progress' },
  ];

  const themes: { id: ThemeMode; label: string; dotColor: string }[] = [
    { id: 'dark', label: 'Deep Navy (Original)', dotColor: '#20f5a2' },
    { id: 'midnight', label: 'Midnight Obsidian', dotColor: '#00ff9d' },
    { id: 'ocean', label: 'Oceanic Teal', dotColor: '#22d3ee' },
    { id: 'studio', label: 'Studio Slate', dotColor: '#60a5fa' },
  ];

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    setCurrentTab('landing');
  };

  return (
    <nav className={`${!isLoggedIn && currentTab === 'landing' ? 'aether-nav ' : ''}h-[72px] px-4 md:px-8 lg:px-14 flex items-center justify-between border-b border-[rgba(0,200,255,0.16)] bg-[rgba(2,11,24,0.85)] backdrop-blur-xl sticky top-0 z-50 transition-colors`}>
      {/* Brand Logo */}
      <button
        onClick={() => setCurrentTab(isLoggedIn ? 'dashboard' : 'landing')}
        className="group flex items-center gap-2.5 focus:outline-none cursor-pointer"
      >
        <FluencisLogo size={38} showText={true} textClassName="text-2xl" badgeText="Student" />
      </button>

      {/* Desktop Navigation Links */}
      {isLoggedIn ? (
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => {
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setCurrentTab(link.id)}
                className={`text-sm font-medium transition-colors relative py-1 focus:outline-none ${
                  isActive ? 'text-white' : 'text-[#9fb5c6] hover:text-[#20f5a2]'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-[-18px] left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#20f5a2] to-[#00bfff] shadow-[0_0_10px_#20f5a2]" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setCurrentTab('landing')}
            className={`aether-nav-link text-sm font-medium ${
              currentTab === 'landing' ? 'text-white' : 'text-[#9fb5c6] hover:text-white'
            }`}
          >
            Home
          </button>
          <a href="#how-it-works" className="aether-nav-link text-sm font-medium text-[#9fb5c6] hover:text-white">
            How It Works
          </a>
          <a href="#about" className="aether-nav-link text-sm font-medium text-[#9fb5c6] hover:text-white">
            About
          </a>
        </div>
      )}

      {/* Right Controls: Theme + User / Login */}
      <div className="flex items-center gap-3">
        {/* Real-time connection badge */}
        <div
          title={isConnected ? 'Connected to Fluencis Server' : 'Connecting to Server...'}
          className="hidden lg:flex items-center gap-1.5 text-xs text-[#8fa9bb] bg-[rgba(1,15,30,0.6)] border border-[rgba(0,200,255,0.18)] px-2.5 py-1 rounded-full"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-[#20f5a2] shadow-[0_0_8px_#20f5a2]'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-[11px] font-medium">
            {isConnected ? 'Server Live' : 'Connecting'}
          </span>
        </div>

        {/* Real-Time Community Chat Button */}
        {onOpenGlobalChat && (
          <button
            onClick={onOpenGlobalChat}
            title="Open Student Community Chat"
            className="relative flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl border border-[rgba(0,210,255,0.25)] bg-[rgba(1,17,31,0.7)] text-[#c5daf0] hover:text-[#20f5a2] hover:border-[#20f5a2] transition-all focus:outline-none cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-[#20f5a2]" />
            <span className="hidden sm:inline text-xs font-semibold">Chat</span>
            {unreadCommunityCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-r from-[#20f5a2] to-[#00cfff] text-[#00131c] text-[10px] font-extrabold flex items-center justify-center shadow-[0_0_10px_#20f5a2] animate-bounce">
                {unreadCommunityCount > 9 ? '9+' : unreadCommunityCount}
              </span>
            )}
          </button>
        )}

        {/* Theme Picker Dropdown */}
        <div className="relative">
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            title="Switch Theme / Dark Mode"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-[rgba(0,210,255,0.25)] bg-[rgba(1,17,31,0.7)] text-[#9fb5c6] hover:text-[#20f5a2] hover:border-[#20f5a2] transition-colors focus:outline-none cursor-pointer"
          >
            <Palette className="w-4 h-4" />
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 py-2 rounded-2xl bg-[#031422] border border-[rgba(0,210,255,0.25)] shadow-2xl shadow-black z-50">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-[#6e889b]">
                Dark Mode Palette
              </div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    theme === t.id
                      ? 'text-[#20f5a2] bg-[rgba(32,245,162,0.1)] font-semibold'
                      : 'text-[#c0d4e4] hover:bg-[rgba(0,180,255,0.08)]'
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: t.dotColor }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoggedIn && user ? (
          <div className="flex items-center gap-3">
            {/* User chip */}
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-[#00131c] bg-gradient-to-br from-[#20f5a2] to-[#00aaff] shadow-[0_0_15px_rgba(0,210,255,0.3)]">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'S'}
                </div>
                {isOwner && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-[9px] font-black text-black flex items-center justify-center shadow-md"
                    title="Platform Owner / Administrator"
                  >
                    ★
                  </span>
                )}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-white group-hover:text-[#20f5a2] transition-colors leading-tight flex items-center gap-1.5">
                  <span>{user.fullName || 'Student'}</span>
                  {isOwner ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 rounded-full">
                      Owner
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium text-[#7fa3b7] bg-[rgba(0,210,255,0.08)] border border-[rgba(0,210,255,0.2)] px-1.5 py-0.2 rounded-full">
                      Student
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#71899b]">
                  {isOwner ? 'Platform Admin' : `${user.branch || 'Student'} · ${user.year || '1st Year'}`}
                </div>
              </div>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              title="Logout"
              className="px-3 py-1.5 rounded-lg border border-[rgba(0,210,255,0.3)] bg-[rgba(0,120,180,0.08)] text-xs text-[#b9ccda] hover:text-white hover:border-[#20f5a2] hover:bg-[rgba(32,245,162,0.08)] transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCurrentTab('login')}
              className="px-4 py-1.5 rounded-full border border-[#00d9ff] text-white text-xs font-semibold hover:bg-gradient-to-r hover:from-[#20f5a2] hover:to-[#00aaff] hover:text-[#00131c] hover:shadow-[0_0_18px_rgba(0,220,255,0.4)] transition-all"
            >
              Login
            </button>
            <button
              onClick={() => setCurrentTab('signup')}
              className="aether-cta px-4 py-1.5 rounded-full bg-gradient-to-r from-[#20f5a2] to-[#00aaff] text-[#00131c] text-xs font-bold shadow-[0_4px_16px_rgba(0,210,255,0.25)] hover:shadow-[0_6px_22px_rgba(32,245,162,0.45)] hover:translate-y-[-1px] transition-all"
            >
              Join Free
            </button>
          </div>
        )}

        {/* Mobile menu hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-[#8fa9bb] hover:text-white focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-[72px] left-0 right-0 bg-[#020d1c] border-b border-[rgba(0,200,255,0.2)] p-4 flex flex-col gap-2 z-50 shadow-2xl">
          {isLoggedIn ? (
            <>
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    setCurrentTab(link.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium ${
                    currentTab === link.id
                      ? 'bg-[rgba(32,245,162,0.12)] text-[#20f5a2]'
                      : 'text-[#9eb6c8] hover:bg-[rgba(0,180,255,0.06)]'
                  }`}
                >
                  {link.label}
                </button>
              ))}
              {onOpenGlobalChat && (
                <button
                  onClick={() => {
                    onOpenGlobalChat();
                    setMobileMenuOpen(false);
                  }}
                  className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#20f5a2] bg-[rgba(32,245,162,0.1)] flex items-center justify-between"
                >
                  <span>💬 Community Chat</span>
                  {unreadCommunityCount > 0 && (
                    <span className="bg-[#20f5a2] text-[#00131c] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadCommunityCount} new
                    </span>
                  )}
                </button>
              )}
              <div className="pt-2 border-t border-[rgba(0,200,255,0.1)] flex justify-between items-center px-1">
                <span className="text-xs text-[#6e889b]">Signed in as {user?.fullName}</span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-rose-400 font-semibold px-2 py-1"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setCurrentTab('landing');
                  setMobileMenuOpen(false);
                }}
                className="text-left px-3 py-2 text-sm text-[#9eb6c8]"
              >
                Home
              </button>
              <button
                onClick={() => {
                  setCurrentTab('login');
                  setMobileMenuOpen(false);
                }}
                className="text-left px-3 py-2 text-sm text-[#9eb6c8]"
              >
                Login
              </button>
              <button
                onClick={() => {
                  setCurrentTab('signup');
                  setMobileMenuOpen(false);
                }}
                className="text-left px-3 py-2 text-sm text-[#20f5a2] font-bold"
              >
                Create Account
              </button>
            </>
          )}
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-[rgba(0,210,255,0.3)] bg-gradient-to-b from-[#09253d] to-[#020e1a] p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Log Out of Fluencis?</h3>
                <p className="text-xs text-[#8ca8ba]">You will need to sign in again to access practice rooms.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#8ca8ba] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Stay Signed In
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
