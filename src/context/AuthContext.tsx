import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { auth, googleAuthProvider, oAuthClientId } from '../lib/firebase';
import { syncUserProfileToFirestore } from '../services/firestoreService';
import { User } from '../types';
import { saveLoginCookie, getLoginCookie, clearLoginCookie } from '../utils/cookieUtils';

interface AuthResponse {
  success: boolean;
  message: string;
  resetCodeHint?: string;
  isNewUser?: boolean;
}

export interface OtpSendResponse {
  success: boolean;
  message: string;
  isNewUser?: boolean;
  identifier?: string;
  previewCode?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  loginWithGoogle: (rememberMe?: boolean) => Promise<AuthResponse>;
  loginWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResponse>;
  registerWithEmail: (name: string, email: string, password?: string, rememberMe?: boolean) => Promise<AuthResponse>;
  sendOtp: (identifier: string, purpose?: 'signin' | 'signup' | 'any', name?: string) => Promise<OtpSendResponse>;
  verifyOtp: (identifier: string, code: string, name?: string, rememberMe?: boolean) => Promise<AuthResponse>;
  forgotPassword: (email: string) => Promise<AuthResponse>;
  resetPassword: (email: string, code: string, newPassword: string, rememberMe?: boolean) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  updateProfile: (name: string, avatarColor?: string, avatarUrl?: string, bio?: string) => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'morning_music_auth_token';
const REMEMBER_KEY = 'morning_music_remember_me';

function getSafeToken(): string | null {
  try {
    return getLoginCookie() || localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setSafeToken(val: string, rememberMe: boolean = true): void {
  try {
    localStorage.setItem(TOKEN_KEY, val);
    sessionStorage.setItem(TOKEN_KEY, val);
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, 'true');
    }
    // Save 7-day authentication cookie for browser session retention
    saveLoginCookie(val, 7);
  } catch {
    // Ignore storage restriction errors in sandboxed iframes
  }
}

function removeSafeToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    clearLoginCookie();

    // Only purge auth and session tokens, preserve user library data (likes, playlists)
    const isAuthTokenKey = (key: string) => {
      if (!key) return false;
      const lower = key.toLowerCase();
      return (
        lower.includes('token') ||
        lower.includes('session') ||
        lower.includes('firebase:authUser') ||
        lower.includes('auth_state')
      );
    };

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && isAuthTokenKey(key)) {
        localStorage.removeItem(key);
      }
    }

    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && isAuthTokenKey(key)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage restriction errors in sandboxed iframes
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getSafeToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Load active session from server on startup
  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      const storedToken = getSafeToken();
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.user) {
            setUser(data.user);
            setToken(storedToken);
            setSafeToken(storedToken, true);
          }
        } else if (res.status === 401) {
          // Token explicitly invalid or revoked by server
          removeSafeToken();
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        console.warn('Could not verify existing session:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const openLoginModal = useCallback(() => {
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
  }, []);

  // 1. Sign In with Email and Password
  const loginWithEmail = async (email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Failed to sign in. Please check your credentials.',
        };
      }

      if (data.token && data.user) {
        setSafeToken(data.token, rememberMe);
        setToken(data.token);
        setUser(data.user);
        setIsLoginModalOpen(false);
        return {
          success: true,
          message: data.message || 'Signed in successfully!',
        };
      }

      return {
        success: false,
        message: 'Server did not return a valid session.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Network error connecting to authentication service.',
      };
    }
  };

  // 2. Create Account with Name, Email and Password (password optional)
  const registerWithEmail = async (name: string, email: string, password?: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Failed to create account.',
        };
      }

      if (data.token && data.user) {
        setSafeToken(data.token, rememberMe);
        setToken(data.token);
        setUser(data.user);
        setIsLoginModalOpen(false);
        return {
          success: true,
          message: data.message || 'Account created successfully!',
        };
      }

      return {
        success: false,
        message: 'Server did not return a valid session.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Network error registering account.',
      };
    }
  };

  // 3. Request Password Recovery
  const forgotPassword = async (email: string): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Failed to request password reset code.',
        };
      }
      return {
        success: true,
        message: data.message || 'Password reset code sent to your email.',
        resetCodeHint: data.resetCodeHint,
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Network error processing recovery request.',
      };
    }
  };

  // 4. Verify Reset Code & Set New Password
  const resetPassword = async (email: string, code: string, newPassword: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Failed to reset password.',
        };
      }

      if (data.token && data.user) {
        setSafeToken(data.token, rememberMe);
        setToken(data.token);
        setUser(data.user);
        setIsLoginModalOpen(false);
      }

      return {
        success: true,
        message: data.message || 'Password reset successfully!',
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Network error resetting password.',
      };
    }
  };

  // Google Firebase Auth Sign In
  const loginWithGoogle = async (rememberMe: boolean = false): Promise<AuthResponse> => {
    try {
      // Detect if running inside an Android WebView or native Capacitor environment
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isAndroidWebView = /Android.*wv|Version\/.*Chrome/i.test(userAgent) || (window as any).AndroidBridge;
      const isNative = typeof window !== 'undefined' && (
        (window as any).Capacitor || 
        window.location.protocol === 'capacitor:' || 
        window.location.protocol === 'app:' ||
        window.location.protocol === 'file:' ||
        isAndroidWebView ||
        (window.location.hostname === 'localhost' && !window.location.port && /Android|iPhone|iPad|iPod/i.test(userAgent))
      );

      if (isNative) {
        return {
          success: false,
          message: 'Google blocks web pop-up OAuth inside mobile WebViews (disallowed_useragent). Please sign in using the Email OTP verification below.',
        };
      }

      // Configure Google provider with select_account prompt
      googleAuthProvider.setCustomParameters({
        prompt: 'select_account',
      });

      // Firebase official popup authentication
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          displayName: cred.user.displayName,
          photoUrl: cred.user.photoURL,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Failed to authenticate with Google.',
        };
      }

      if (data.user) {
        const sessionToken = data.token || idToken;
        setSafeToken(sessionToken, rememberMe);
        setToken(sessionToken);
        setUser(data.user);
        setIsLoginModalOpen(false);

        // Synchronize user profile directly to Firestore
        syncUserProfileToFirestore({
          uid: cred.user.uid,
          email: cred.user.email || '',
          displayName: cred.user.displayName || undefined,
          photoUrl: cred.user.photoURL || undefined,
        }).catch((err) => {
          console.warn('Firestore profile sync notification:', err);
        });

        return {
          success: true,
          message: 'Signed in successfully with Google!',
        };
      }

      return {
        success: false,
        message: 'Could not establish user session.',
      };
    } catch (err: any) {
      console.warn('Google sign-in attempt notification:', err);
      const errorCode = err?.code || '';
      const errorMsg = err?.message || String(err);

      if (errorCode === 'auth/popup-closed-by-user') {
        return {
          success: false,
          message: 'Google sign-in window was closed before completing authorization.',
        };
      }

      if (errorCode === 'auth/popup-blocked') {
        return {
          success: false,
          message: 'The sign-in popup was blocked by your browser. Please allow popups for this site, or sign in using Email OTP below.',
        };
      }

      if (errorCode === 'auth/unauthorized-domain') {
        return {
          success: false,
          message: 'This preview domain is not yet in your Firebase Authorized Domains list. Please sign in instantly using the 6-digit Email OTP option below.',
        };
      }

      if (
        errorMsg.includes('Authorization Error') ||
        errorMsg.includes('400') ||
        errorMsg.includes('403') ||
        errorMsg.includes('origin_mismatch') ||
        errorMsg.includes('disallowed_useragent') ||
        errorMsg.includes('access_denied')
      ) {
        return {
          success: false,
          message: 'Google OAuth blocked this environment (Authorization Error). Please sign in instantly using the Email OTP verification below.',
        };
      }

      return {
        success: false,
        message: errorMsg || 'Google sign-in failed. Please use Email OTP sign-in below.',
      };
    }
  };

  // OTP Sign In / Create Account: 1. Send OTP Code
  const sendOtp = async (identifier: string, purpose: 'signin' | 'signup' | 'any' = 'any', name?: string): Promise<OtpSendResponse> => {
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, purpose, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Failed to send OTP verification code.',
        };
      }
      return {
        success: true,
        message: data.message || 'OTP verification code has been dispatched.',
        isNewUser: data.isNewUser,
        identifier: data.identifier,
        previewCode: data.previewCode,
      };
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      return {
        success: false,
        message: err.message || 'Network error while requesting OTP code.',
      };
    }
  };

  // OTP Sign In / Create Account: 2. Verify OTP Code
  const verifyOtp = async (identifier: string, code: string, name?: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Failed to verify OTP code.',
        };
      }

      if (data.token && data.user) {
        setSafeToken(data.token, rememberMe);
        setToken(data.token);
        setUser(data.user);
        setIsLoginModalOpen(false);

        // Authenticate Firebase Client SDK if custom token is minted
        if (data.firebaseCustomToken) {
          try {
            await signInWithCustomToken(auth, data.firebaseCustomToken);
          } catch (fbErr) {
            // Ignored if not configured
          }
        }

        return {
          success: true,
          message: data.message || 'Authenticated successfully!',
          isNewUser: data.isNewUser,
        };
      }

      return {
        success: false,
        message: 'Could not establish session from verification.',
      };
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      return {
        success: false,
        message: err.message || 'Network error while verifying OTP code.',
      };
    }
  };

  // 5. Logout
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore
    }
    const currentToken = token || getSafeToken();
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch (err) {
        console.warn('Logout request failed:', err);
      }
    }
    removeSafeToken();
    setToken(null);
    setUser(null);
  };

  // 5. Update Profile
  const updateProfile = async (name: string, avatarColor?: string, avatarUrl?: string, bio?: string) => {
    const currentToken = token || getSafeToken();
    if (!currentToken) return false;

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ name, avatarColor, avatarUrl, bio }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  // 6. Delete Account (Google Play Policy Compliance)
  const deleteAccount = async (): Promise<boolean> => {
    const currentToken = token || getSafeToken();
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        },
      });
      if (res.ok) {
        await logout();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendOtp,
        verifyOtp,
        forgotPassword,
        resetPassword,
        logout,
        updateProfile,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

