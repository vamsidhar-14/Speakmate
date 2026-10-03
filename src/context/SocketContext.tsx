import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { RoomData, ChatMessage, OnlineStudent, RoomParticipant, PeerFeedback } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  publicRooms: RoomData[];
  onlineStudents: OnlineStudent[];
  activeRoom: RoomData | null;
  chatMessages: ChatMessage[];
  communityChatMessages: ChatMessage[];
  typingUsers: { [key: string]: boolean };
  unreadCommunityCount: number;
  resetUnreadCommunityCount: () => void;
  isSearchingMatch: boolean;
  searchStatus: { message: string; mode?: string; level?: string; compatibleCount?: number; compatibleStudents?: any[] } | null;
  latestMatchData: { roomId: string; room: any; partner?: any; matchScore?: number; reason?: string } | null;
  clearLatestMatchData: () => void;
  incomingMatchInvite: { fromSocketId: string; fromName: string; fromLevel: string; mode: string } | null;
  peerFeedbacks: PeerFeedback[];
  roomError: string | null;
  clearRoomError: () => void;
  createRoom: (type: 'public' | 'private', mode: string, capacity: number, customId?: string) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  lookupRoom: (roomId: string) => Promise<{ exists: boolean; room?: any; message?: string }>;
  verifyRoom: (targetRoomId: string, enteredRoomId: string) => Promise<{ valid: boolean; room?: any; message: string }>;
  submitFeedback: (feedback: PeerFeedback) => Promise<{ success: boolean; feedback?: PeerFeedback }>;
  refreshFeedbacks: () => Promise<void>;
  sendChatMessage: (text: string, roomId?: string, channelId?: string) => void;
  sendCommunityMessage: (text: string) => void;
  sendTyping: (isTyping: boolean, roomId?: string, channelId?: string) => void;
  toggleReaction: (messageId: string, emoji: string, roomId?: string, channelId?: string) => void;
  findPartner: (mode: string, format?: string, level?: string) => void;
  cancelFindPartner: () => void;
  sendMatchInvite: (targetSocketId: string, mode: string, level?: string) => void;
  acceptMatchInvite: (invite: any) => void;
  declineMatchInvite: (invite: any) => void;
  clearMatchInvite: () => void;
  endConversation: () => void;
  toggleMediaState: (isMuted?: boolean, isVideoOff?: boolean) => void;
  handRaisedUsers: { [socketId: string]: boolean };
  toggleHandRaise: (isRaised: boolean) => void;
  toggleRoomLock: (locked: boolean) => void;
  kickParticipant: (targetSocketId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [publicRooms, setPublicRooms] = useState<RoomData[]>([]);
  const [onlineStudents, setOnlineStudents] = useState<OnlineStudent[]>([]);
  const [activeRoom, setActiveRoom] = useState<RoomData | null>(() => {
    try {
      const stored = localStorage.getItem('speakMateActiveRoom');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [communityChatMessages, setCommunityChatMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: boolean }>({});
  const [unreadCommunityCount, setUnreadCommunityCount] = useState<number>(0);
  const [isSearchingMatch, setIsSearchingMatch] = useState<boolean>(false);
  const [searchStatus, setSearchStatus] = useState<{
    message: string;
    mode?: string;
    level?: string;
    compatibleCount?: number;
    compatibleStudents?: any[];
  } | null>(null);
  const [latestMatchData, setLatestMatchData] = useState<{
    roomId: string;
    room: any;
    partner?: any;
    matchScore?: number;
    reason?: string;
  } | null>(null);
  const [incomingMatchInvite, setIncomingMatchInvite] = useState<{
    fromSocketId: string;
    fromName: string;
    fromLevel: string;
    mode: string;
  } | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const clearRoomError = () => setRoomError(null);
  const [handRaisedUsers, setHandRaisedUsers] = useState<{ [socketId: string]: boolean }>({});
  const [peerFeedbacks, setPeerFeedbacks] = useState<PeerFeedback[]>(() => {
    try {
      const stored = localStorage.getItem('speakMatePeerFeedbacks');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const userRef = useRef(user);
  userRef.current = user;

  const activeRoomRef = useRef<RoomData | null>(activeRoom);
  activeRoomRef.current = activeRoom;

  const refreshFeedbacks = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/feedback/${encodeURIComponent(user.fullName)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.received)) {
          setPeerFeedbacks(data.received);
          localStorage.setItem('speakMatePeerFeedbacks', JSON.stringify(data.received));
        }
      }
    } catch (err) {
      console.warn('Could not fetch peer feedback list:', err);
    }
  };

  useEffect(() => {
    refreshFeedbacks();
  }, [user?.fullName]);

  useEffect(() => {
    // Dynamic host connection with long-polling first upgradeable to websocket
    const socketInstance = io({
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected with ID:', socketInstance.id);
      setIsConnected(true);

      const currentUser = userRef.current;
      if (currentUser) {
        socketInstance.emit('student-online', {
          name: currentUser.fullName,
          level: currentUser.level,
          goal: currentUser.goal,
          mode: 'General Communication',
        });
      }

      // Re-join active practice room only if user was in a live session
      try {
        const activeRoomId = sessionStorage.getItem('currentPracticeRoomId');
        if (activeRoomId && activeRoomId.trim()) {
          socketInstance.emit('join-room', {
            roomId: activeRoomId.trim(),
            studentName: currentUser?.fullName || 'Student',
            userProfile: currentUser,
          });
        }
      } catch {}
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      setIsConnected(false);
    });

    socketInstance.on('public-rooms', (rooms: RoomData[]) => {
      setPublicRooms(Array.isArray(rooms) ? rooms : []);
    });

    socketInstance.on('online-students', (students: OnlineStudent[]) => {
      setOnlineStudents(Array.isArray(students) ? students : []);
    });

    socketInstance.on('community-messages', (messages: ChatMessage[]) => {
      setCommunityChatMessages(Array.isArray(messages) ? messages : []);
    });

    socketInstance.on('new-community-message', (msg: ChatMessage) => {
      setCommunityChatMessages((prev) => [...prev, msg]);
      setUnreadCommunityCount((prev) => prev + 1);
    });

    socketInstance.on('user-typing', (data: { sender: string; isTyping: boolean }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.sender]: data.isTyping,
      }));
    });

    socketInstance.on('message-reaction-updated', (data: { messageId: string; reactions: any[]; channelId?: string }) => {
      if (data.channelId === 'community') {
        setCommunityChatMessages((prev) =>
          prev.map((msg) => (msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg))
        );
      } else {
        setChatMessages((prev) =>
          prev.map((msg) => (msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg))
        );
      }
    });

    socketInstance.on('peer-feedback-received', (fb: PeerFeedback) => {
      setPeerFeedbacks((prev) => {
        const updated = [fb, ...prev.filter((f) => f.id !== fb.id)];
        localStorage.setItem('speakMatePeerFeedbacks', JSON.stringify(updated));
        return updated;
      });
    });

    socketInstance.on('room-created', (room: RoomData) => {
      setActiveRoom(room);
      setChatMessages(room.chatMessages || []);
      localStorage.setItem('speakMateActiveRoom', JSON.stringify(room));
    });

    socketInstance.on('room-state', (room: RoomData) => {
      setActiveRoom(room);
      if (room.chatMessages) {
        setChatMessages(room.chatMessages);
      }
      localStorage.setItem('speakMateActiveRoom', JSON.stringify(room));
    });

    socketInstance.on('room-joined', (room: RoomData) => {
      setActiveRoom(room);
      if (room.chatMessages) {
        setChatMessages(room.chatMessages);
      }
      localStorage.setItem('speakMateActiveRoom', JSON.stringify(room));
      sessionStorage.setItem('currentPracticeRoomId', room.id);
    });

    socketInstance.on('student-joined', (data: { socketId: string; name: string; profile?: any }) => {
      setActiveRoom((prev) => {
        if (!prev) return null;
        if (prev.participants.some((p) => p.socketId === data.socketId)) return prev;
        const newPart: RoomParticipant = {
          socketId: data.socketId,
          name: data.name,
          initial: data.name.charAt(0).toUpperCase() || 'S',
          role: 'Participant',
          level: data.profile?.level || 'Beginner',
          goal: data.profile?.goal || 'General Communication',
          isMuted: false,
          isVideoOff: false,
        };
        const updated = {
          ...prev,
          participants: [...prev.participants, newPart],
        };
        localStorage.setItem('speakMateActiveRoom', JSON.stringify(updated));
        return updated;
      });
    });

    socketInstance.on('participant-left', (data: { socketId: string; name?: string }) => {
      setActiveRoom((prev) => {
        if (!prev) return null;
        const filtered = prev.participants.filter((p) => p.socketId !== data.socketId);
        const updated = {
          ...prev,
          participants: filtered,
        };
        localStorage.setItem('speakMateActiveRoom', JSON.stringify(updated));
        return updated;
      });
    });

    socketInstance.on('participant-media-changed', (data: { socketId: string; isMuted?: boolean; isVideoOff?: boolean }) => {
      setActiveRoom((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          participants: prev.participants.map((p) => {
            if (p.socketId === data.socketId) {
              return {
                ...p,
                isMuted: typeof data.isMuted === 'boolean' ? data.isMuted : p.isMuted,
                isVideoOff: typeof data.isVideoOff === 'boolean' ? data.isVideoOff : p.isVideoOff,
              };
            }
            return p;
          }),
        };
        localStorage.setItem('speakMateActiveRoom', JSON.stringify(updated));
        return updated;
      });
    });

    socketInstance.on('new-message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socketInstance.on('match-found', (data: { roomId: string; room: RoomData; partner?: any; matchScore?: number; reason?: string }) => {
      setIsSearchingMatch(false);
      setSearchStatus(null);
      setActiveRoom(data.room);
      setLatestMatchData(data);
      if (data.room.chatMessages) {
        setChatMessages(data.room.chatMessages);
      }
      localStorage.setItem('speakMateActiveRoom', JSON.stringify(data.room));
      sessionStorage.setItem('currentPracticeRoomId', data.roomId);
      window.dispatchEvent(new CustomEvent('speakmate:quick-match-found', { detail: data }));
    });

    socketInstance.on('match-searching', (data?: any) => {
      setIsSearchingMatch(true);
      if (data) setSearchStatus(data);
    });

    socketInstance.on('incoming-match-invite', (invite: any) => {
      setIncomingMatchInvite(invite);
    });

    socketInstance.on('match-invite-declined', (data: { message: string }) => {
      setRoomError(data.message || 'Quick Match invitation was declined.');
    });

    socketInstance.on('search-cancelled', () => {
      setIsSearchingMatch(false);
      setSearchStatus(null);
    });

    socketInstance.on('room-error', (err: { message: string }) => {
      setRoomError(err.message || 'Room error occurred');
      sessionStorage.removeItem('currentPracticeRoomId');
      localStorage.removeItem('speakMateActiveRoom');
      setActiveRoom(null);
      setIsSearchingMatch(false);
      setSearchStatus(null);
    });

    socketInstance.on('participant-hand-raised', (data: { socketId: string; name: string; isRaised: boolean }) => {
      setHandRaisedUsers((prev) => ({
        ...prev,
        [data.socketId]: data.isRaised,
      }));
    });

    socketInstance.on('room-lock-changed', (data: { roomId: string; locked: boolean; message: string }) => {
      setActiveRoom((prev) => (prev && prev.id === data.roomId ? { ...prev, locked: data.locked } : prev));
      if (data.message) {
        setRoomError(data.message);
      }
    });

    socketInstance.on('kicked-from-room', (data: { message: string }) => {
      setActiveRoom(null);
      localStorage.removeItem('speakMateActiveRoom');
      sessionStorage.removeItem('currentPracticeRoomId');
      setLatestMatchData(null);
      setRoomError(data.message || 'You were removed from the room by the host.');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Update online user details when user profile changes
  useEffect(() => {
    if (socket && socket.connected && user) {
      socket.emit('student-online', {
        name: user.fullName,
        level: user.level,
        goal: user.goal,
        mode: 'General Communication',
      });
    }
  }, [user, socket]);

  const createRoom = (type: 'public' | 'private', mode: string, capacity: number, customId?: string) => {
    const cleanId = (customId || '').trim();
    const roomId = cleanId || `SM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const hostName = user?.fullName || 'Student';

    // Optimistically initialize active room immediately so RoomPage never falls back to SM-ROOM
    const newRoom: RoomData = {
      id: roomId,
      type,
      mode,
      capacity,
      host: hostName,
      participants: [
        {
          socketId: socket?.id || 'local',
          name: hostName,
          initial: hostName.charAt(0).toUpperCase() || 'S',
          role: 'Host',
          level: user?.level || 'Beginner',
          goal: user?.goal || 'General Communication',
        },
      ],
      createdAt: new Date().toISOString(),
      chatMessages: [],
    };

    setActiveRoom(newRoom);
    localStorage.setItem('speakMateActiveRoom', JSON.stringify(newRoom));
    sessionStorage.setItem('currentPracticeRoomId', roomId);

    // Call REST endpoint immediately
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoom),
    }).catch(() => {});

    if (socket) {
      socket.emit('create-room', {
        id: roomId,
        type,
        mode,
        capacity,
        hostName,
        userProfile: user,
      });
    }
  };

  const joinRoom = (roomId: string) => {
    const cleanId = (roomId || '').trim();
    if (!cleanId) return;

    sessionStorage.setItem('currentPracticeRoomId', cleanId);

    const currentUser = userRef.current || user;
    const myName = currentUser?.fullName || 'Student';

    // If room is known in publicRooms, adopt its true host and metadata
    const existing = publicRooms.find((r) => r.id.toLowerCase() === cleanId.toLowerCase());
    if (existing) {
      const roomWithMe: RoomData = {
        ...existing,
        participants: existing.participants.some((p) => p.name.trim().toLowerCase() === myName.trim().toLowerCase())
          ? existing.participants
          : [
              ...existing.participants,
              {
                socketId: socket?.id || 'local',
                name: myName,
                initial: myName.charAt(0).toUpperCase() || 'S',
                role: 'Participant',
                level: currentUser?.level || 'Beginner',
                goal: currentUser?.goal || 'General Communication',
                isMuted: false,
                isVideoOff: false,
              },
            ],
      };
      setActiveRoom(roomWithMe);
      localStorage.setItem('speakMateActiveRoom', JSON.stringify(roomWithMe));
    }

    if (socket) {
      socket.emit('join-room', {
        roomId: cleanId,
        studentName: myName,
        userProfile: currentUser,
      });
    }

    // Also fetch updated room from backend REST, but preserve self if already joined
    fetch(`/api/rooms/${encodeURIComponent(cleanId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.exists && data.room) {
          setActiveRoom((prev) => {
            const serverRoom: RoomData = data.room;
            const hasMe = serverRoom.participants.some(
              (p) => p.socketId === socket?.id || p.name.trim().toLowerCase() === myName.trim().toLowerCase()
            );
            const myPart: RoomParticipant = {
              socketId: socket?.id || 'local',
              name: myName,
              initial: myName.charAt(0).toUpperCase() || 'S',
              role: 'Participant',
              level: currentUser?.level || 'Beginner',
              goal: currentUser?.goal || 'General Communication',
              isMuted: false,
              isVideoOff: false,
            };
            const updatedParticipants = hasMe
              ? serverRoom.participants
              : [...serverRoom.participants, myPart];

            const merged = {
              ...serverRoom,
              participants: updatedParticipants,
              chatMessages: prev?.chatMessages && prev.chatMessages.length > 0 ? prev.chatMessages : serverRoom.chatMessages || [],
            };
            localStorage.setItem('speakMateActiveRoom', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(() => {});
  };

  const lookupRoom = (roomId: string): Promise<{ exists: boolean; room?: any; message?: string }> => {
    return new Promise((resolve) => {
      const cleanId = (roomId || '').trim();
      if (!cleanId) {
        resolve({ exists: false, message: 'Please provide a valid Room ID' });
        return;
      }

      fetch(`/api/rooms/${encodeURIComponent(cleanId)}`)
        .then((res) => res.json())
        .then((data) => resolve(data))
        .catch(() => {
          if (socket && socket.connected) {
            socket.emit('lookup-room', cleanId, (res: any) => resolve(res));
          } else {
            resolve({ exists: false, message: 'Could not connect to room server.' });
          }
        });
    });
  };

  const verifyRoom = async (targetRoomId: string, enteredRoomId: string): Promise<{ valid: boolean; room?: any; message: string }> => {
    try {
      const res = await fetch('/api/rooms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoomId: targetRoomId.trim(),
          enteredRoomId: enteredRoomId.trim(),
        }),
      });
      const data = await res.json();
      return {
        valid: data.valid || false,
        room: data.room,
        message: data.message || (data.valid ? 'Room verified successfully!' : 'Invalid Room ID'),
      };
    } catch {
      // Fallback to socket lookup if offline or proxy error
      const lookup = await lookupRoom(enteredRoomId.trim());
      if (lookup.exists && lookup.room) {
        if (targetRoomId && targetRoomId.trim().toLowerCase() !== enteredRoomId.trim().toLowerCase()) {
          return {
            valid: false,
            message: `Room ID "${enteredRoomId}" does not match the chosen room. Please enter the correct unique ID.`,
          };
        }
        return {
          valid: true,
          room: lookup.room,
          message: 'Room verified via live server connection!',
        };
      }
      return {
        valid: false,
        message: lookup.message || 'Could not verify room. Please check the unique Room ID.',
      };
    }
  };

  const submitFeedback = async (
    feedback: PeerFeedback
  ): Promise<{ success: boolean; feedback?: PeerFeedback }> => {
    try {
      if (socket && socket.connected) {
        socket.emit('submit-feedback', feedback);
      }
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });

      if (res.ok) {
        const data = await res.json();
        const saved = data.feedback || feedback;
        setPeerFeedbacks((prev) => [saved, ...prev.filter((f) => f.id !== saved.id)]);
        return { success: true, feedback: saved };
      }
      return { success: true, feedback };
    } catch (err) {
      console.error('Failed to submit peer feedback:', err);
      return { success: false };
    }
  };

  const clearLatestMatchData = () => {
    setLatestMatchData(null);
  };

  const leaveRoom = () => {
    if (activeRoom) {
      if (socket) {
        socket.emit('leave-room', activeRoom.id);
      }
      setActiveRoom(null);
      setChatMessages([]);
      localStorage.removeItem('speakMateActiveRoom');
      sessionStorage.removeItem('currentPracticeRoomId');
      setLatestMatchData(null);
      setIsSearchingMatch(false);
      setSearchStatus(null);
    } else {
      sessionStorage.removeItem('currentPracticeRoomId');
      localStorage.removeItem('speakMateActiveRoom');
      setLatestMatchData(null);
    }
  };

  const sendChatMessage = (text: string, roomId?: string, channelId?: string) => {
    if (!socket || !text.trim()) return;
    const targetRoomId = roomId || activeRoom?.id;
    socket.emit('send-message', {
      roomId: targetRoomId,
      channelId: channelId || (targetRoomId ? 'room' : 'community'),
      text: text.trim(),
      sender: user?.fullName || 'Student',
      initial: user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'S',
    });
  };

  const sendCommunityMessage = (text: string) => {
    if (!socket || !text.trim()) return;
    socket.emit('send-message', {
      channelId: 'community',
      text: text.trim(),
      sender: user?.fullName || 'Student',
      initial: user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'S',
    });
  };

  const sendTyping = (isTyping: boolean, roomId?: string, channelId?: string) => {
    if (!socket) return;
    socket.emit('typing', {
      roomId: roomId || activeRoom?.id,
      channelId: channelId || (roomId || activeRoom?.id ? 'room' : 'community'),
      sender: user?.fullName || 'Student',
      isTyping,
    });
  };

  const toggleReaction = (messageId: string, emoji: string, roomId?: string, channelId?: string) => {
    if (!socket) return;
    socket.emit('add-reaction', {
      messageId,
      emoji,
      userName: user?.fullName || 'Student',
      roomId: roomId || activeRoom?.id,
      channelId: channelId || (roomId || activeRoom?.id ? 'room' : 'community'),
    });
  };

  const resetUnreadCommunityCount = () => {
    setUnreadCommunityCount(0);
  };

  const findPartner = (mode: string, format?: string, level?: string) => {
    if (!socket) return;
    const targetLevel = level || user?.level || 'Intermediate';
    setIsSearchingMatch(true);
    socket.emit('find-partner', {
      name: user?.fullName || 'Student',
      mode,
      format: format || 'one-to-one',
      level: targetLevel,
      goal: user?.goal || 'Fluency & Confidence',
    });
  };

  const cancelFindPartner = () => {
    if (!socket) return;
    socket.emit('cancel-search');
    setIsSearchingMatch(false);
    setSearchStatus(null);
  };

  const sendMatchInvite = (targetSocketId: string, mode: string, level?: string) => {
    if (!socket) return;
    socket.emit('instant-match-invite', {
      targetSocketId,
      mode,
      level: level || user?.level || 'Intermediate',
      name: user?.fullName || 'Student',
    });
  };

  const acceptMatchInvite = (invite: any) => {
    if (!socket) return;
    socket.emit('accept-match-invite', {
      fromSocketId: invite.fromSocketId,
      mode: invite.mode,
      level: user?.level || 'Intermediate',
      name: user?.fullName || 'Student',
    });
    setIncomingMatchInvite(null);
  };

  const declineMatchInvite = (invite: any) => {
    if (!socket) return;
    socket.emit('decline-match-invite', {
      fromSocketId: invite.fromSocketId,
      name: user?.fullName || 'Student',
    });
    setIncomingMatchInvite(null);
  };

  const clearMatchInvite = () => {
    setIncomingMatchInvite(null);
  };

  const endConversation = () => {
    if (!socket || !activeRoom) return;
    socket.emit('end-conversation', activeRoom.id);
    leaveRoom();
  };

  const toggleMediaState = (isMuted?: boolean, isVideoOff?: boolean) => {
    if (!socket || !activeRoom) return;
    socket.emit('media-toggle', {
      roomId: activeRoom.id,
      isMuted,
      isVideoOff,
    });
  };

  const toggleHandRaise = (isRaised: boolean) => {
    if (!socket || !activeRoom) return;
    socket.emit('raise-hand', { roomId: activeRoom.id, isRaised });
    if (socket.id) {
      setHandRaisedUsers((prev) => ({ ...prev, [socket.id!]: isRaised }));
    }
  };

  const toggleRoomLock = (locked: boolean) => {
    if (!socket || !activeRoom) return;
    socket.emit('toggle-room-lock', { roomId: activeRoom.id, locked });
    setActiveRoom((prev) => (prev ? { ...prev, locked } : null));
  };

  const kickParticipant = (targetSocketId: string) => {
    if (!socket || !activeRoom) return;
    socket.emit('kick-participant', { roomId: activeRoom.id, targetSocketId });
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        publicRooms,
        onlineStudents,
        activeRoom,
        chatMessages,
        communityChatMessages,
        typingUsers,
        unreadCommunityCount,
        resetUnreadCommunityCount,
        isSearchingMatch,
        searchStatus,
        latestMatchData,
        clearLatestMatchData,
        incomingMatchInvite,
        peerFeedbacks,
        roomError,
        clearRoomError,
        createRoom,
        joinRoom,
        leaveRoom,
        lookupRoom,
        verifyRoom,
        submitFeedback,
        refreshFeedbacks,
        sendChatMessage,
        sendCommunityMessage,
        sendTyping,
        toggleReaction,
        findPartner,
        cancelFindPartner,
        sendMatchInvite,
        acceptMatchInvite,
        declineMatchInvite,
        clearMatchInvite,
        endConversation,
        toggleMediaState,
        handRaisedUsers,
        toggleHandRaise,
        toggleRoomLock,
        kickParticipant,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
