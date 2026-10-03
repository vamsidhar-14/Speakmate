import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  Sparkles,
  MessageSquare,
  Users,
  Smile,
  X,
  Radio,
  CheckCheck,
  ChevronDown,
} from 'lucide-react';
import { ChatMessage } from '../types';

interface GlobalChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToRooms?: () => void;
}

export const GlobalChatDrawer: React.FC<GlobalChatDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToRooms,
}) => {
  const {
    communityChatMessages,
    sendCommunityMessage,
    typingUsers,
    sendTyping,
    toggleReaction,
    onlineStudents,
    resetUnreadCommunityCount,
  } = useSocket();
  const { user } = useAuth();

  const [inputText, setInputText] = useState('');
  const [activeChannel, setActiveChannel] = useState<'all' | 'placements' | 'gd' | 'interview'>('all');
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const availableReactions = ['👍', '🔥', '👏', '💡', '❤️', '🎯'];

  const studentPrompts = [
    'Anyone available for an HR mock interview right now?',
    'Any tips for STAR method on technical project questions?',
    'Looking for 2 people to practice Group Discussion!',
    'How do you explain Docker and Kubernetes simply in interviews?',
    'What filler words do interviewers dislike the most?',
  ];

  useEffect(() => {
    if (isOpen) {
      resetUnreadCommunityCount();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, communityChatMessages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTyping(true, undefined, 'community');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false, undefined, 'community');
    }, 1500);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendTyping(false, undefined, 'community');
    sendCommunityMessage(inputText.trim());
    setInputText('');
  };

  const handleSendPrompt = (prompt: string) => {
    sendCommunityMessage(prompt);
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    toggleReaction(msgId, emoji, undefined, 'community');
    setShowEmojiPickerFor(null);
  };

  const typingNames = Object.entries(typingUsers)
    .filter(([name, isTyping]) => isTyping && name !== (user?.fullName || 'Student'))
    .map(([name]) => name);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md h-full bg-[rgba(2,12,24,0.95)] border-l border-[rgba(0,210,255,0.22)] shadow-2xl backdrop-blur-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[rgba(0,210,255,0.18)] bg-[rgba(3,25,45,0.7)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center text-[#00131c] shadow-[0_0_15px_rgba(0,210,255,0.3)]">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">Student Community Chat</h2>
                <span className="flex items-center gap-1 text-[10px] text-[#20f5a2] bg-[rgba(32,245,162,0.1)] px-2 py-0.5 rounded-full border border-[rgba(32,245,162,0.25)] font-semibold">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-[#20f5a2]" />
                  <span>LIVE</span>
                </span>
              </div>
              <p className="text-[11px] text-[#71899b]">
                {onlineStudents.length} student{onlineStudents.length === 1 ? '' : 's'} online across SpeakMate
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-[rgba(0,210,255,0.2)] text-[#8fa9bb] hover:text-white hover:border-[#20f5a2] hover:bg-[rgba(32,245,162,0.08)] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channels/Filter Tabs */}
        <div className="px-4 py-2.5 border-b border-[rgba(0,210,255,0.1)] bg-[rgba(1,14,28,0.5)] flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: '💬 General' },
            { id: 'placements', label: '🎯 Placements' },
            { id: 'gd', label: '👥 Group Discussion' },
            { id: 'interview', label: '💼 HR Rounds' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveChannel(tab.id as any)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeChannel === tab.id
                  ? 'bg-gradient-to-r from-[rgba(32,245,162,0.2)] to-[rgba(0,207,255,0.18)] border border-[#20f5a2] text-[#20f5a2] font-semibold'
                  : 'bg-[rgba(2,20,35,0.6)] border border-[rgba(0,210,255,0.15)] text-[#8ea4b8] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick Topic Prompts Carousel */}
        <div className="px-4 py-2 border-b border-[rgba(0,210,255,0.08)] bg-[rgba(2,16,30,0.3)] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase font-bold text-[#627d92] shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#20f5a2]" /> Quick Ask:
          </span>
          {studentPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendPrompt(prompt)}
              className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-[rgba(0,210,255,0.2)] bg-[rgba(3,28,45,0.6)] text-[#c5daf0] hover:border-[#20f5a2] hover:text-[#20f5a2] hover:bg-[rgba(32,245,162,0.08)] transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {communityChatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6c8699]">
              <MessageSquare className="w-10 h-10 text-[rgba(0,210,255,0.25)] mb-3" />
              <p className="text-sm font-semibold text-white">No community messages yet</p>
              <p className="text-xs max-w-xs mt-1 text-[#71899b]">
                Be the first to say hello, ask for a partner, or share an interview question!
              </p>
            </div>
          ) : (
            communityChatMessages.map((msg) => {
              if (msg.isSystem || msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-center my-3">
                    <span className="inline-block text-[11px] text-[#7191a7] bg-[rgba(2,20,38,0.85)] border border-[rgba(0,210,255,0.15)] px-3.5 py-1.5 rounded-full shadow-sm">
                      {msg.text} · {msg.timestamp}
                    </span>
                  </div>
                );
              }

              const isOwn = msg.sender === (user?.fullName || 'Student');

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group`}
                >
                  <div className={`flex gap-2.5 max-w-[88%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-md ${
                        isOwn
                          ? 'bg-gradient-to-br from-[#20f5a2] to-[#00aaff] text-[#00131c]'
                          : 'bg-gradient-to-br from-[#00cfff] to-[#0055ff] text-white'
                      }`}
                    >
                      {msg.initial || (msg.sender ? msg.sender.charAt(0).toUpperCase() : 'S')}
                    </div>

                    {/* Bubble Content */}
                    <div className="space-y-1">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-xs shadow-md relative ${
                          isOwn
                            ? 'bg-gradient-to-r from-[rgba(32,245,162,0.18)] to-[rgba(0,207,255,0.15)] border border-[rgba(32,245,162,0.35)] text-white'
                            : 'bg-[rgba(4,24,40,0.85)] border border-[rgba(0,210,255,0.18)] text-[#dbeaf5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span
                            className={`font-bold text-[11px] ${
                              isOwn ? 'text-[#20f5a2]' : 'text-[#00cfff]'
                            }`}
                          >
                            {isOwn ? 'You' : msg.sender}
                          </span>
                          <span className="text-[10px] text-[#71899b]">{msg.timestamp}</span>
                        </div>

                        <p className="leading-relaxed break-words text-xs">{msg.text}</p>
                      </div>

                      {/* Emoji Reactions Bar */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {msg.reactions &&
                          msg.reactions.length > 0 &&
                          msg.reactions
                            .filter((r) => r.count > 0)
                            .map((r, rIdx) => {
                              const reactedByMe = r.users.includes(user?.fullName || 'Student');
                              return (
                                <button
                                  key={rIdx}
                                  onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                    reactedByMe
                                      ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.15)] text-[#20f5a2]'
                                      : 'border-[rgba(0,210,255,0.2)] bg-[rgba(2,18,34,0.6)] text-[#8ea4b8] hover:border-[#20f5a2]'
                                  }`}
                                >
                                  <span>{r.emoji}</span>
                                  <span className="font-semibold text-[10px]">{r.count}</span>
                                </button>
                              );
                            })}

                        {/* Add reaction trigger button */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setShowEmojiPickerFor(
                                showEmojiPickerFor === msg.id ? null : msg.id
                              )
                            }
                            title="Add reaction"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-[#6b8599] hover:text-[#20f5a2] hover:bg-[rgba(32,245,162,0.1)] cursor-pointer"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Emoji Picker Popover */}
                          {showEmojiPickerFor === msg.id && (
                            <div className="absolute bottom-6 left-0 z-30 flex items-center gap-1 p-1 rounded-2xl bg-[#031526] border border-[rgba(0,210,255,0.25)] shadow-xl">
                              {availableReactions.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-[rgba(32,245,162,0.15)] transition-colors cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Live typing indicator */}
        {typingNames.length > 0 && (
          <div className="px-4 py-1 text-[11px] text-[#20f5a2] flex items-center gap-1.5 bg-[rgba(1,15,30,0.6)] border-t border-[rgba(0,210,255,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20f5a2] animate-ping" />
            <span>
              {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        {/* Chat Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3.5 border-t border-[rgba(0,210,255,0.18)] bg-[rgba(2,14,26,0.9)] flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message to all online students..."
            className="flex-1 bg-[rgba(1,15,30,0.85)] border border-[rgba(0,200,255,0.25)] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-[#5a7689] focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2] transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#20f5a2] to-[#00cfff] text-[#00131c] font-bold text-xs flex items-center justify-center hover:shadow-[0_0_15px_rgba(32,245,162,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
