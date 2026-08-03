"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { ThemeProvider } from "next-themes";
import { IdentityProvider } from "@/lib/identity-context";
import { PlayerProvider } from "@/lib/player-context";
import { GlobalPlayerBar } from "@/components/global-player-bar";
import { Toaster } from "@/components/ui/sonner";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <ConvexProvider client={convex}>
        <IdentityProvider>
          <PlayerProvider>
            {children}
            <GlobalPlayerBar />
          </PlayerProvider>
        </IdentityProvider>
        <Toaster />
      </ConvexProvider>
    </ThemeProvider>
  );
}
