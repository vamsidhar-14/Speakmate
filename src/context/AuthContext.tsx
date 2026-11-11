import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, PublicProfile, UserPracticeMetrics } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/error';

export const OWNER_EMAIL = 'amireddysrinivas1978@gmail.com';

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  course: string;
  branch: string;
  year: string;
  level: string;
  goal: string;
  interests?: string;
  preferredPracticeModes?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isOwner: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signup: (signupData: SignupPayload) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updatedData: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resendVerificationEmail: () => Promise<{ success: boolean; message?: string; error?: string }>;
  deleteAccount: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (guestName?: string) => Promise<{ success: boolean; error?: string }>;
  recordPracticeSession: (durationSeconds: number) => Promise<UserPracticeMetrics>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const inFlightSyncRef = useRef<Map<string, Promise<UserProfile>>>(new Map());

  const isOwner = Boolean(
    (user?.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) ||
    (firebaseUser?.email && firebaseUser.email.toLowerCase() === OWNER_EMAIL.toLowerCase())
  );

  const clearAuthError = () => setAuthError(null);

  // Synchronize or initialize user profile in Firestore
  const syncUserProfile = async (currentFirebaseUser: User): Promise<UserProfile> => {
    const uid = currentFirebaseUser.uid;
    const emailAddr = (currentFirebaseUser.email || '').toLowerCase();
    const userIsAdmin = emailAddr === OWNER_EMAIL.toLowerCase();
    const safeDisplayName =
      currentFirebaseUser.displayName && currentFirebaseUser.displayName.trim().length >= 1
        ? currentFirebaseUser.displayName.trim().slice(0, 100)
        : 'Student';
    const safeEmail = currentFirebaseUser.email ? currentFirebaseUser.email.trim().toLowerCase() : '';

    const userDocRef = doc(db, 'users', uid);

    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data() as UserProfile;
        const storedMetrics = (() => {
          try {
            const m = localStorage.getItem(`fluencisPracticeMetrics_${data.fullName || uid}`);
            return m ? JSON.parse(m) : null;
          } catch { return null; }
        })();
        const profile: UserProfile = {
          ...data,
          practiceMetrics: data.practiceMetrics || storedMetrics || {
            totalPracticeMinutes: 0,
            totalSessionsCount: 0,
            currentStreakDays: 0,
          },
          uid,
          email: safeEmail || data.email,
          emailVerified: currentFirebaseUser.emailVerified,
          role: userIsAdmin ? 'admin' : (data.role || 'student'),
          isOwner: userIsAdmin,
        };
        setUser(profile);
        return profile;
      }
    } catch (err: any) {
      console.warn('Firestore profile lookup note:', err);
    }

    // Initialize fresh profile
    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      uid,
      fullName: safeDisplayName,
      email: safeEmail,
      course: 'B.Tech',
      branch: 'CSE',
      year: '1st Year',
      level: 'Beginner',
      goal: 'Placement Preparation',
      interests: 'AI & Engineering',
      preferredPracticeModes: '1-to-1 Practice',
      createdAt: now,
      updatedAt: now,
      profileCompleted: true,
      availabilityStatus: 'AVAILABLE',
      emailVerified: currentFirebaseUser.emailVerified,
      role: userIsAdmin ? 'admin' : 'student',
      isOwner: userIsAdmin,
    };

    try {
      await setDoc(
        userDocRef,
        {
          ...newProfile,
          serverCreatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Private profile write note:', err);
    }

    try {
      const publicProfileRef = doc(db, 'publicProfiles', uid);
      await setDoc(
        publicProfileRef,
        {
          uid,
          displayName: safeDisplayName,
          course: newProfile.course,
          branch: newProfile.branch,
          year: newProfile.year,
          communicationLevel: newProfile.level,
          practiceModes: newProfile.preferredPracticeModes,
          interests: newProfile.interests,
          availabilityStatus: 'AVAILABLE',
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Public matchmaking profile write note:', err);
    }

    setUser(newProfile);
    return newProfile;
  };

  // Deduplicated synchronization handler
  const getOrSyncUserProfile = async (currentFirebaseUser: User): Promise<UserProfile> => {
    const uid = currentFirebaseUser.uid;
    const existing = inFlightSyncRef.current.get(uid);
    if (existing) {
      return existing;
    }
    const syncPromise = syncUserProfile(currentFirebaseUser).finally(() => {
      inFlightSyncRef.current.delete(uid);
    });
    inFlightSyncRef.current.set(uid, syncPromise);
    return syncPromise;
  };

  // Centralized Firebase Authentication State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentFirebaseUser) => {
      setFirebaseUser(currentFirebaseUser);

      if (currentFirebaseUser) {
        try {
          await getOrSyncUserProfile(currentFirebaseUser);
        } catch (err: any) {
          console.warn('Firestore user fetch note:', err?.message || err);
          const emailAddr = (currentFirebaseUser.email || '').toLowerCase();
          const userIsAdmin = emailAddr === OWNER_EMAIL.toLowerCase();
          setUser({
            uid: currentFirebaseUser.uid,
            fullName: currentFirebaseUser.displayName || 'Student',
            email: currentFirebaseUser.email || '',
            role: userIsAdmin ? 'admin' : 'student',
            isOwner: userIsAdmin,
            course: 'B.Tech',
            branch: 'CSE',
            year: '1st Year',
            level: 'Beginner',
            goal: 'Placement Preparation',
            emailVerified: currentFirebaseUser.emailVerified,
          });
        }
      } else {
        try {
          const storedGuest = localStorage.getItem('fluencisGuestUser') || localStorage.getItem('speakMateGuestUser');
          if (storedGuest) {
            setUser(JSON.parse(storedGuest));
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real Firebase Login
  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = email.trim();

    if (!cleanEmail || !pass) {
      const err = 'Please enter both your email address and password.';
      setAuthError(err);
      return { success: false, error: err };
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      await getOrSyncUserProfile(userCredential.user);
      return { success: true };
    } catch (err: any) {
      let friendlyError = 'Unable to sign in. Please verify your credentials.';
      const code = err.code || '';

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        friendlyError = 'Incorrect email or password. Please check your credentials and try again.';
      } else if (code === 'auth/invalid-email') {
        friendlyError = 'Please provide a valid email address.';
      } else if (code === 'auth/too-many-requests') {
        friendlyError = 'Too many failed login attempts. Please reset your password or wait a few minutes.';
      } else if (code === 'auth/user-disabled') {
        friendlyError = 'This student account has been suspended or disabled.';
      } else if (code === 'auth/network-request-failed') {
        friendlyError = 'Network connection problem. Please check your internet connection.';
      }

      setAuthError(friendlyError);
      return { success: false, error: friendlyError };
    }
  };

  // Google Sign-In with Firebase Auth
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      if (userCredential.user) {
        await getOrSyncUserProfile(userCredential.user);
      }
      return { success: true };
    } catch (err: any) {
      console.error('Google Sign-in note:', err);
      // If user was successfully authenticated via popup, continue to app
      if (auth.currentUser) {
        try {
          await getOrSyncUserProfile(auth.currentUser);
        } catch {
          // Non-blocking
        }
        return { success: true };
      }
      let friendlyError = 'Google sign-in could not be completed.';
      if (err.code === 'auth/popup-closed-by-user') {
        friendlyError = 'Sign-in popup was closed before completing.';
      } else if (err.code === 'auth/popup-blocked') {
        friendlyError = 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        friendlyError = 'Sign-in request was cancelled.';
      } else if (err.code === 'auth/network-request-failed') {
        friendlyError = 'Network error. Please check your internet connection.';
      }
      setAuthError(friendlyError);
      return { success: false, error: friendlyError };
    }
  };

  // Real Firebase Signup
  const signup = async (signupData: SignupPayload): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = signupData.email.trim().toLowerCase();
    const cleanName = signupData.fullName.trim();

    // Client-side validations
    if (!cleanName || cleanName.length < 2) {
      const err = 'Please provide your full student name (at least 2 characters).';
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      const err = 'Please provide a valid college or personal email address.';
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!signupData.password || signupData.password.length < 6) {
      const err = 'Password must be at least 6 characters long for account security.';
      setAuthError(err);
      return { success: false, error: err };
    }

    if (signupData.confirmPassword && signupData.password !== signupData.confirmPassword) {
      const err = 'Your passwords do not match. Please re-enter them carefully.';
      setAuthError(err);
      return { success: false, error: err };
    }

    try {
      // 1. Create account with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, signupData.password);
      const uid = userCredential.user.uid;

      // 2. Send email verification
      try {
        await sendEmailVerification(userCredential.user);
      } catch (verifyErr) {
        console.warn('Email verification send note:', verifyErr);
      }

      // 3. Create private user profile in Firestore: users/{uid}
      const newPrivateProfile: UserProfile = {
        uid,
        fullName: cleanName,
        email: cleanEmail,
        course: signupData.course || 'B.Tech',
        branch: signupData.branch || 'CSE',
        year: signupData.year || '1st Year',
        level: signupData.level || 'Beginner',
        goal: signupData.goal || 'Career Preparation',
        interests: signupData.interests || 'General Discussion',
        preferredPracticeModes: signupData.preferredPracticeModes || '1-to-1 Practice',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profileCompleted: true,
        availabilityStatus: 'AVAILABLE',
        emailVerified: false,
      };

      await setDoc(doc(db, 'users', uid), {
        ...newPrivateProfile,
        serverCreatedAt: serverTimestamp(),
      });

      // 4. Create sanitized public profile in Firestore: publicProfiles/{uid}
      // Strictly no email, password, or private account data
      const newPublicProfile: PublicProfile = {
        uid,
        displayName: cleanName,
        course: signupData.course || 'B.Tech',
        branch: signupData.branch || 'CSE',
        year: signupData.year || '1st Year',
        communicationLevel: signupData.level || 'Beginner',
        practiceModes: signupData.preferredPracticeModes || '1-to-1 Practice',
        interests: signupData.interests || 'General Discussion',
        availabilityStatus: 'AVAILABLE',
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'publicProfiles', uid), newPublicProfile);

      setUser(newPrivateProfile);
      return { success: true };
    } catch (err: any) {
      let friendlyError = 'Failed to create student account. Please try again.';
      const code = err.code || '';

      if (code === 'auth/email-already-in-use') {
        friendlyError = 'An account with this email address already exists. Please log in instead.';
      } else if (code === 'auth/invalid-email') {
        friendlyError = 'The email address format is invalid.';
      } else if (code === 'auth/weak-password') {
        friendlyError = 'Your password is too weak. Please use at least 6 characters with mixed numbers/letters.';
      } else if (code === 'auth/network-request-failed') {
        friendlyError = 'Network error. Please verify your internet connection.';
      }

      setAuthError(friendlyError);
      return { success: false, error: friendlyError };
    }
  };

  // Guest / Fast Student Access for peer practice
  const loginAsGuest = async (guestName?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanName = (guestName || '').trim() || `Student ${Math.floor(100 + Math.random() * 900)}`;
      const guestUid = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const guestMetrics = (() => {
        try {
          const m = localStorage.getItem(`fluencisPracticeMetrics_${cleanName}`);
          return m ? JSON.parse(m) : { totalPracticeMinutes: 0, totalSessionsCount: 0, currentStreakDays: 0 };
        } catch {
          return { totalPracticeMinutes: 0, totalSessionsCount: 0, currentStreakDays: 0 };
        }
      })();

      const guestProfile: UserProfile = {
        uid: guestUid,
        fullName: cleanName,
        email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.fluencis.app`,
        role: 'student',
        course: 'B.Tech',
        branch: 'CSE',
        year: '3rd Year',
        level: 'Intermediate',
        goal: 'Campus Placement & Speaking Practice',
        interests: 'Tech Interviews & Group Discussions',
        preferredPracticeModes: '1-to-1 Practice',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profileCompleted: true,
        availabilityStatus: 'AVAILABLE',
        emailVerified: true,
        practiceMetrics: guestMetrics,
      };
      setUser(guestProfile);
      localStorage.setItem('fluencisGuestUser', JSON.stringify(guestProfile));
      localStorage.setItem('speakMateGuestUser', JSON.stringify(guestProfile));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not start guest session' };
    }
  };

  // Record practice session duration and update streak in real time
  const recordPracticeSession = async (durationSeconds: number): Promise<UserPracticeMetrics> => {
    if (durationSeconds < 5) {
      return (
        user?.practiceMetrics || {
          totalPracticeMinutes: 0,
          totalSessionsCount: 0,
          currentStreakDays: 0,
        }
      );
    }

    const minutes = Math.max(1, Math.round(durationSeconds / 60));
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    const storageKey = `fluencisPracticeMetrics_${user?.fullName || 'student'}`;
    let baseMetrics: UserPracticeMetrics = user?.practiceMetrics || {
      totalPracticeMinutes: 0,
      totalSessionsCount: 0,
      currentStreakDays: 0,
      lastPracticedDate: '',
      historyDates: [],
    };

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.totalPracticeMinutes > baseMetrics.totalPracticeMinutes) {
          baseMetrics = parsed;
        }
      }
    } catch {}

    let streak = baseMetrics.currentStreakDays || 0;
    if (baseMetrics.lastPracticedDate === today) {
      if (streak === 0) streak = 1;
    } else if (baseMetrics.lastPracticedDate === yesterday) {
      streak += 1;
    } else {
      streak = 1;
    }

    const history = Array.from(new Set([...(baseMetrics.historyDates || []), today]));

    const updatedMetrics: UserPracticeMetrics = {
      totalPracticeMinutes: (baseMetrics.totalPracticeMinutes || 0) + minutes,
      totalSessionsCount: (baseMetrics.totalSessionsCount || 0) + 1,
      currentStreakDays: streak,
      lastPracticedDate: today,
      historyDates: history,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedMetrics));
    } catch {}

    if (user) {
      const updatedUser: UserProfile = {
        ...user,
        practiceMetrics: updatedMetrics,
      };
      setUser(updatedUser);

      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userDocRef, {
            practiceMetrics: updatedMetrics,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Could not update practiceMetrics in Firestore:', e);
        }
      } else {
        try {
          localStorage.setItem('fluencisGuestUser', JSON.stringify(updatedUser));
        } catch {}
      }
    }

    return updatedMetrics;
  };

  // Real Firebase Logout
  const logout = async () => {
    try {
      localStorage.removeItem('fluencisGuestUser');
      localStorage.removeItem('speakMateGuestUser');
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (err: any) {
      localStorage.removeItem('fluencisGuestUser');
      localStorage.removeItem('speakMateGuestUser');
      setUser(null);
      setFirebaseUser(null);
    }
  };

  // Update Profile in Firestore
  const updateProfile = async (updatedData: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!user || !auth.currentUser) {
      return { success: false, error: 'You must be logged in to update your profile.' };
    }

    try {
      const uid = auth.currentUser.uid;
      const updatedProfile = {
        ...user,
        ...updatedData,
        updatedAt: new Date().toISOString(),
      };

      // 1. Update private profile: users/{uid}
      // Strip immutable keys to comply with Firestore rules (uid, email, createdAt cannot be mutated)
      const { uid: _u, email: _e, createdAt: _c, ...safeUpdates } = updatedData as any;
      const privateRef = doc(db, 'users', uid);
      await updateDoc(privateRef, {
        ...safeUpdates,
        updatedAt: new Date().toISOString(),
      });

      // 2. Update sanitized public profile: publicProfiles/{uid}
      const publicRef = doc(db, 'publicProfiles', uid);
      const publicUpdates: Partial<PublicProfile> = {
        updatedAt: new Date().toISOString(),
      };
      if (updatedData.fullName) publicUpdates.displayName = updatedData.fullName;
      if (updatedData.course) publicUpdates.course = updatedData.course;
      if (updatedData.branch) publicUpdates.branch = updatedData.branch;
      if (updatedData.year) publicUpdates.year = updatedData.year;
      if (updatedData.level) publicUpdates.communicationLevel = updatedData.level;
      if (updatedData.availabilityStatus) publicUpdates.availabilityStatus = updatedData.availabilityStatus;
      if (updatedData.interests) publicUpdates.interests = updatedData.interests;

      await setDoc(publicRef, publicUpdates, { merge: true });

      setUser(updatedProfile);
      return { success: true };
    } catch (err: any) {
      console.error('Profile update error:', err);
      return { success: false, error: err.message || 'Failed to update profile.' };
    }
  };

  // Password Reset Email
  const sendPasswordReset = async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return { success: false, error: 'Please enter your registered email address.' };
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: 'Password reset link sent! Please check your inbox and spam folder.',
      };
    } catch (err: any) {
      let friendlyError = 'Could not send password reset email. Please try again.';
      const code = err.code || '';
      if (code === 'auth/user-not-found') {
        friendlyError = 'No student account found with this email address.';
      } else if (code === 'auth/invalid-email') {
        friendlyError = 'Please provide a valid email address.';
      }
      return { success: false, error: friendlyError };
    }
  };

  // Resend Email Verification
  const resendVerificationEmail = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!auth.currentUser) {
      return { success: false, error: 'No active session found.' };
    }

    try {
      await sendEmailVerification(auth.currentUser);
      return {
        success: true,
        message: 'A fresh verification email has been sent to your address. Please check your inbox.',
      };
    } catch (err: any) {
      let msg = 'Failed to send verification email. Please try again later.';
      if (err.code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a few minutes before requesting another verification email.';
      }
      return { success: false, error: msg };
    }
  };

  // Account Deletion Flow
  const deleteAccount = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!auth.currentUser || !user) {
      return { success: false, error: 'You must be logged in to delete your account.' };
    }

    try {
      const currentUser = auth.currentUser;
      const uid = currentUser.uid;

      // Reauthenticate before sensitive deletion if password provided
      if (currentUser.email && password) {
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // 1. Delete Firestore private data
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) {
        console.warn('Private profile deletion warning:', e);
      }

      // 2. Delete Firestore public profile data
      try {
        await deleteDoc(doc(db, 'publicProfiles', uid));
      } catch (e) {
        console.warn('Public profile deletion warning:', e);
      }

      // 3. Delete Firebase Authentication user
      await deleteUser(currentUser);

      setUser(null);
      setFirebaseUser(null);
      return { success: true };
    } catch (err: any) {
      let friendlyError = 'Account deletion failed.';
      if (err.code === 'auth/wrong-password') {
        friendlyError = 'Incorrect password. Reauthentication failed.';
      } else if (err.code === 'auth/requires-recent-login') {
        friendlyError = 'For security, please log out and log in again before deleting your account.';
      }
      return { success: false, error: friendlyError };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoggedIn: !!user,
        isLoading,
        isOwner,
        authError,
        clearAuthError,
        login,
        loginWithGoogle,
        signup,
        logout,
        updateProfile,
        sendPasswordReset,
        resendVerificationEmail,
        deleteAccount,
        loginAsGuest,
        recordPracticeSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
