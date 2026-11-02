import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Provider with Google Drive file scope
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
// Prompt consent if necessary to always guarantee fresh access token
googleProvider.setCustomParameters({
  prompt: "select_account",
  access_type: "offline",
});

const STORAGE_TOKEN_KEY = "gdrive_music_access_token";
const STORAGE_TOKEN_TIME_KEY = "gdrive_music_token_time";
const TOKEN_MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes (Google tokens standard duration)

// Initialize token from localStorage
let cachedAccessToken: string | null = (() => {
  try {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    return token || null;
  } catch {
    return null;
  }
})();

// Auth Popup Guard: Strictly prevent unrequested or automated interactive Google login popups
let interactiveLoginAllowed = false;
let isSigningIn = false;

/**
 * Runs an explicit interactive Google Sign-In with popup.
 * MUST only be invoked from direct user interaction (e.g., clicking Connect Google Drive or Reconnect button).
 */
export const requestInteractiveGoogleLogin = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn("[AuthGuard] Sign-in already in progress.");
    return null;
  }

  try {
    interactiveLoginAllowed = true;
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal memperoleh token akses Google Drive dari hasil login.");
    }
    const token = credential.accessToken;
    setCachedAccessToken(token);
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error("[AuthGuard] Google Sign-In Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
    interactiveLoginAllowed = false;
  }
};

/**
 * Legacy wrapper: Only executes if interactiveLoginAllowed is explicitly enabled or directly invoked.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  return requestInteractiveGoogleLogin();
};

// Enum for Firestore operation types
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// In-memory & persisted token management
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      setCachedAccessToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const isTokenExpired = (): boolean => {
  try {
    const timeStr = localStorage.getItem(STORAGE_TOKEN_TIME_KEY);
    if (!timeStr) return true;
    const age = Date.now() - parseInt(timeStr, 10);
    return age >= TOKEN_MAX_AGE_MS;
  } catch {
    return true;
  }
};

/**
 * Retrieves the currently active Google Drive access token from memory / localStorage.
 * Does NOT prompt user with any login popups.
 */
export const getAccessToken = async (forceFresh: boolean = false): Promise<string | null> => {
  if (forceFresh) {
    return null;
  }

  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  try {
    const stored = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
};

/**
 * SILENT Token Verification and Refresh.
 * STRICTLY FORBIDDEN from opening any Google Login / Account Chooser popups.
 * Returns the valid stored access token or null if re-authentication is required.
 */
export const refreshGoogleDriveToken = async (): Promise<string | null> => {
  try {
    // 1. Check if we have an active token in storage/memory
    const currentToken = await getAccessToken();
    if (currentToken && !isTokenExpired()) {
      return currentToken;
    }

    // 2. If Firebase user is active, silently touch token without opening UI
    if (auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(false);
      } catch (idErr) {
        console.warn("[Auth] Firebase ID token check notice:", idErr);
      }
    }

    // 3. Return existing cached token if available
    return currentToken || null;
  } catch (err) {
    console.warn("[Auth] Silent token check notice:", err);
    return null;
  }
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      localStorage.setItem(STORAGE_TOKEN_TIME_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_TOKEN_TIME_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
};

export const logout = async () => {
  await signOut(auth);
  setCachedAccessToken(null);
};

export const signInWithGooglePopup = googleSignIn;
export const signOutUser = logout;

// Validate connection
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore connection: client is currently offline");
    }
    return false;
  }
}
