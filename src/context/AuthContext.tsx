import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  getAccessToken,
  setCachedAccessToken,
  isTokenExpired,
  requestInteractiveGoogleLogin,
} from "../firebase/config";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type DriveAuthState = "CONNECTED" | "REFRESHING" | "REAUTH_REQUIRED" | "DISCONNECTED";

interface AuthContextType {
  user: User | null;
  authStatus: AuthStatus;
  driveAuthState: DriveAuthState;
  isAuthReady: boolean;
  isAuthenticated: boolean;
  hasGoogleDriveAuth: boolean;
  isReauthNeeded: boolean;
  isLoggingIn: boolean;
  isReconnectingDrive: boolean;
  loginWithGoogle: () => Promise<boolean>;
  reconnectGoogleDrive: () => Promise<boolean>;
  notifyReauthRequired: () => void;
  clearReauthRequired: () => void;
  logout: () => Promise<void>;
  getValidAccessToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [hasGoogleDriveAuth, setHasGoogleDriveAuth] = useState<boolean>(false);
  const [driveAuthState, setDriveAuthState] = useState<DriveAuthState>("DISCONNECTED");
  const [isReauthNeeded, setIsReauthNeeded] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isReconnectingDrive, setIsReconnectingDrive] = useState<boolean>(false);

  // 1. Ensure Firebase Auth persistence is explicitly set to browserLocalPersistence
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Could not set Auth persistence to browserLocalPersistence:", err);
    });
  }, []);

  // 2. Auth State Observer - The single source of truth for persistent session
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;

      if (currentUser) {
        // User is logged into the application!
        setUser(currentUser);
        setAuthStatus("authenticated");

        // Check Google Drive token without treating missing token as app logout
        const token = await getAccessToken();
        const valid = Boolean(token);
        setHasGoogleDriveAuth(valid);
        setDriveAuthState(valid ? "CONNECTED" : "REAUTH_REQUIRED");
      } else {
        // User is genuinely not logged in
        setUser(null);
        setAuthStatus("unauthenticated");
        setHasGoogleDriveAuth(false);
        setDriveAuthState("DISCONNECTED");
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Listen to network status changes to verify connection seamlessly
  useEffect(() => {
    const handleOnline = async () => {
      if (auth.currentUser) {
        const token = await getAccessToken();
        const valid = Boolean(token);
        setHasGoogleDriveAuth(valid);
        if (valid) {
          setDriveAuthState("CONNECTED");
          setIsReauthNeeded(false);
        }
      }
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const notifyReauthRequired = useCallback(() => {
    setDriveAuthState("REAUTH_REQUIRED");
    setIsReauthNeeded(true);
  }, []);

  const clearReauthRequired = useCallback(() => {
    setIsReauthNeeded(false);
    if (hasGoogleDriveAuth) {
      setDriveAuthState("CONNECTED");
    }
  }, [hasGoogleDriveAuth]);

  // 3. Explicit Interactive Login with Google (triggered only by user action)
  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoggingIn(true);
      const res = await requestInteractiveGoogleLogin();
      if (res?.accessToken) {
        setCachedAccessToken(res.accessToken);
        setHasGoogleDriveAuth(true);
        setDriveAuthState("CONNECTED");
        setIsReauthNeeded(false);
        setUser(res.user);
        setAuthStatus("authenticated");
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  // 4. Explicit Reconnect Google Drive without logging user out of the application
  const reconnectGoogleDrive = useCallback(async (): Promise<boolean> => {
    try {
      setIsReconnectingDrive(true);
      const res = await requestInteractiveGoogleLogin();
      if (res?.accessToken) {
        setCachedAccessToken(res.accessToken);
        setHasGoogleDriveAuth(true);
        setDriveAuthState("CONNECTED");
        setIsReauthNeeded(false);
        return true;
      }
      return false;
    } catch (error: any) {
      console.warn("[Auth] Google Drive re-authorization warning:", error);
      return false;
    } finally {
      setIsReconnectingDrive(false);
    }
  }, []);

  // 5. Get valid access token with graceful purely-silent refresh (NO POPUPS)
  const getValidAccessToken = useCallback(
    async (forceRefresh: boolean = false): Promise<string | null> => {
      const cached = await getAccessToken(forceRefresh);
      if (cached && !isTokenExpired() && !forceRefresh) {
        return cached;
      }

      if (cached && !forceRefresh) {
        return cached; // still return cached rather than null if offline
      }

      return cached;
    },
    []
  );

  // 6. Manual Logout ONLY - Triggered exclusively by user action
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setCachedAccessToken(null);
      setUser(null);
      setAuthStatus("unauthenticated");
      setHasGoogleDriveAuth(false);
      setDriveAuthState("DISCONNECTED");
      setIsReauthNeeded(false);
    } catch (error) {
      console.error("[Auth] Logout error:", error);
      throw error;
    }
  }, []);

  const isAuthReady = authStatus !== "loading";
  const isAuthenticated = authStatus === "authenticated" && user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        authStatus,
        driveAuthState,
        isAuthReady,
        isAuthenticated,
        hasGoogleDriveAuth,
        isReauthNeeded,
        isLoggingIn,
        isReconnectingDrive,
        loginWithGoogle,
        reconnectGoogleDrive,
        notifyReauthRequired,
        clearReauthRequired,
        logout,
        getValidAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
