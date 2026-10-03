import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  Sparkles,
  MessageSquare,
  Smile,
  X,
  Radio,
  FileText,
} from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  onClose?: () => void;
  isFloating?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose, isFloating = false }) => {
  const { chatMessages, sendChatMessage, activeRoom, sendTyping, typingUsers, toggleReaction } = useSocket();
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const availableReactions = ['👍', '👏', '🎯', '💡', '🔥'];

  const quickPrompts = [
    'Could you elaborate on that?',
    'What was your key takeaway?',
    'In my opinion, we should also consider...',
    'To summarize the main points...',
    'Great point! Let’s explore further.',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTyping(true, activeRoom?.id, 'room');

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      sendTyping(false, activeRoom?.id, 'room');
    }, 1500);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendTyping(false, activeRoom?.id, 'room');
    sendChatMessage(inputText.trim(), activeRoom?.id, 'room');
    setInputText('');
  };

  const handleQuickPrompt = (prompt: string) => {
    sendChatMessage(prompt, activeRoom?.id, 'room');
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    toggleReaction(msgId, emoji, activeRoom?.id, 'room');
    setShowEmojiFor(null);
  };

  const typingNames = Object.entries(typingUsers)
    .filter(([name, isTyping]) => isTyping && name !== (user?.fullName || 'Student'))
    .map(([name]) => name);

  return (
    <div
      className={`flex flex-col h-full rounded-3xl border border-[rgba(0,210,255,0.22)] bg-[rgba(2,16,30,0.9)] backdrop-blur-2xl shadow-2xl overflow-hidden ${
        isFloating ? 'max-h-[550px]' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(0,210,255,0.15)] bg-[rgba(3,25,45,0.65)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center text-[#00131c]">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <span>Session Chat</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#20f5a2] animate-pulse" />
            </h3>
            <span className="text-[10px] text-[#71899b]">
              {activeRoom ? activeRoom.participants.length : 1} student{activeRoom && activeRoom.participants.length > 1 ? 's' : ''} in room
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-[#728b9e] hover:text-white p-1 rounded-lg focus:outline-none cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Prompts Carousel for Student Communication */}
      <div className="px-3.5 py-2 border-b border-[rgba(0,210,255,0.08)] bg-[rgba(1,11,22,0.4)] flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
        <span className="text-[#647c8f] text-[10px] uppercase font-bold shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#20f5a2]" /> Prompts:
        </span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickPrompt(prompt)}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-[rgba(0,210,255,0.2)] bg-[rgba(3,28,45,0.6)] text-[#c5daf0] hover:border-[#20f5a2] hover:text-[#20f5a2] hover:bg-[rgba(32,245,162,0.08)] transition-all cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6c8699]">
            <MessageSquare className="w-8 h-8 text-[rgba(0,210,255,0.3)] mb-2" />
            <p className="text-xs font-semibold text-[#8fa9bc]">No messages yet</p>
            <p className="text-[11px] max-w-[200px] mt-1 text-[#607b8f]">
              Share speaking notes, questions, or vocabulary feedback during this session.
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            if (msg.isSystem || msg.type === 'system') {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="inline-block text-[10px] text-[#69889d] bg-[rgba(2,18,34,0.7)] border border-[rgba(0,210,255,0.12)] px-3 py-1 rounded-full">
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
                <div className={`flex gap-2 max-w-[85%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isOwn && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-[#00131c] bg-gradient-to-br from-[#20f5a2] to-[#00aaff] shadow-sm">
                      {msg.initial || msg.sender.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-xs shadow-md ${
                        isOwn
                          ? 'bg-gradient-to-r from-[rgba(32,245,162,0.18)] to-[rgba(0,207,255,0.15)] border border-[rgba(32,245,162,0.35)] text-white'
                          : 'bg-[rgba(4,24,40,0.85)] border border-[rgba(0,210,255,0.18)] text-[#dbeaf5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span
                          className={`font-bold text-[10px] ${
                            isOwn ? 'text-[#20f5a2]' : 'text-[#00cfff]'
                          }`}
                        >
                          {isOwn ? 'You' : msg.sender}
                        </span>
                        <span className="text-[9px] text-[#71899b]">{msg.timestamp}</span>
                      </div>
                      <p className="leading-relaxed break-words">{msg.text}</p>
                    </div>

                    {/* Reactions Bar */}
                    <div className="flex items-center gap-1">
                      {msg.reactions &&
                        msg.reactions
                          .filter((r) => r.count > 0)
                          .map((r, rIdx) => {
                            const reactedByMe = r.users.includes(user?.fullName || 'Student');
                            return (
                              <button
                                key={rIdx}
                                onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border transition-all ${
                                  reactedByMe
                                    ? 'border-[#20f5a2] bg-[rgba(32,245,162,0.15)] text-[#20f5a2]'
                                    : 'border-[rgba(0,210,255,0.2)] bg-[rgba(2,18,34,0.6)] text-[#8ea4b8]'
                                }`}
                              >
                                <span>{r.emoji}</span>
                                <span>{r.count}</span>
                              </button>
                            );
                          })}

                      {/* Add reaction trigger */}
                      <div className="relative">
                        <button
                          onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#6b8599] hover:text-[#20f5a2] cursor-pointer"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                        {showEmojiFor === msg.id && (
                          <div className="absolute bottom-5 left-0 z-30 flex items-center gap-1 p-1 rounded-xl bg-[#031526] border border-[rgba(0,210,255,0.25)] shadow-xl">
                            {availableReactions.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className="w-6 h-6 flex items-center justify-center text-xs hover:bg-[rgba(32,245,162,0.15)] rounded transition-colors cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isOwn && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-[#00131c] bg-gradient-to-br from-[#20f5a2] to-[#00aaff] shadow-sm">
                      {msg.initial || (user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'S')}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="px-4 py-1 text-[10px] text-[#20f5a2] flex items-center gap-1.5 bg-[rgba(1,15,30,0.6)] border-t border-[rgba(0,210,255,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#20f5a2] animate-ping" />
          <span>{typingNames.join(', ')} typing...</span>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSend} className="p-3 border-t border-[rgba(0,210,255,0.15)] bg-[rgba(2,14,26,0.85)] flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Send a speaking note or reply..."
          className="flex-1 bg-[rgba(1,15,30,0.85)] border border-[rgba(0,200,255,0.22)] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#5a7689] focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2] transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#20f5a2] to-[#00cfff] text-[#00131c] font-bold text-xs flex items-center justify-center hover:shadow-[0_0_15px_rgba(32,245,162,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
