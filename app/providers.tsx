"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { ThemeProvider } from "next-themes";
import { IdentityProvider } from "@/lib/identity-context";
import { Toaster } from "@/components/ui/sonner";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <ConvexProvider client={convex}>
        <IdentityProvider>{children}</IdentityProvider>
        <Toaster />
      </ConvexProvider>
    </ThemeProvider>
  );
}
