import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { configureAuth } from "@/lib/api";

const PRIVY_APP_ID =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ??
  "cmrb1gi9b000r0cjly6tupaz7";

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  wallet: string | null;
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
  const wallet = wallets[0]?.address ?? null;
  const userId = user?.id ?? null;

  // Wire the API client to Privy's token + (for local dev) the user id.
  useEffect(() => {
    configureAuth(
      async () => (authenticated ? await getAccessToken().catch(() => null) : null),
      userId,
    );
  }, [authenticated, userId, getAccessToken]);

  const value = useMemo<AuthState>(
    () => ({ ready, authenticated, userId, wallet, login, logout }),
    [ready, authenticated, userId, wallet, login, logout],
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
        // email + wallet work with zero extra dashboard config; add "google"
        // in code once it's enabled in the Privy dashboard OAuth settings.
        loginMethods: ["email", "wallet"],
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}
