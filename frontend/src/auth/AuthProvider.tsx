import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { configureAuth } from "@/lib/api";

const PRIVY_APP_ID =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ??
  "cmrb1gi9b000r0cjly6tupaz7";

const GUEST_KEY = "dw-guest-id";

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  /** true when signed in via wallet/email (not guest) */
  connected: boolean;
  userId: string | null;
  wallet: string | null;
  /** Instant entry — never blocks on a third-party SDK. */
  enter: () => void;
  /** Optional wallet/email sign-in (Privy). */
  login: () => void;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}

function Bridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [guestId, setGuestId] = useState<string | null>(
    () => localStorage.getItem(GUEST_KEY),
  );

  const wallet = wallets[0]?.address ?? null;
  const privyUserId = user?.id ?? null;
  const userId = privyUserId ?? guestId;
  const isAuthed = authenticated || Boolean(guestId);

  // Identity is invisible plumbing: mint a local id automatically so no
  // page ever gates on "connect". This is an agent's console, not a SaaS.
  useEffect(() => {
    if (!authenticated && !guestId) {
      const id = `guest-${crypto.randomUUID().slice(0, 12)}`;
      localStorage.setItem(GUEST_KEY, id);
      setGuestId(id);
    }
  }, [authenticated, guestId]);

  // Wire the API client to Privy's token + the user id (guest ids ride the
  // x-user-id dev header; the server accepts them in permissive mode).
  useEffect(() => {
    configureAuth(
      async () => (authenticated ? await getAccessToken().catch(() => null) : null),
      userId,
    );
  }, [authenticated, userId, getAccessToken]);

  const value = useMemo<AuthState>(
    () => ({
      ready: true, // guest path means the app is always ready to enter
      authenticated: isAuthed,
      connected: authenticated,
      userId,
      wallet,
      enter: () => {
        if (isAuthed) return;
        const id = `guest-${crypto.randomUUID().slice(0, 12)}`;
        localStorage.setItem(GUEST_KEY, id);
        setGuestId(id);
      },
      login: () => {
        // Real sign-in when available; never a dead click — fall back to guest.
        if (ready && !authenticated) {
          try {
            login();
            return;
          } catch {
            /* fall through to guest */
          }
        }
        if (!isAuthed) {
          const id = `guest-${crypto.randomUUID().slice(0, 12)}`;
          localStorage.setItem(GUEST_KEY, id);
          setGuestId(id);
        }
      },
      logout: () => {
        localStorage.removeItem(GUEST_KEY);
        setGuestId(null);
        if (authenticated) void logout();
      },
    }),
    [ready, authenticated, isAuthed, userId, wallet, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#ffb020",
          walletChainType: "ethereum-only",
        },
        embeddedWallets: { createOnLogin: "users-without-wallets" },
        loginMethods: ["email", "wallet"],
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}
