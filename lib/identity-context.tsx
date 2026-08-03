"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createAndStoreAnonymousId,
  getStoredAnonymousId,
  getStoredDisplayName,
  storeDisplayName,
} from "@/lib/identity";
import { OnboardingNameDialog } from "@/components/onboarding-name-dialog";

interface IdentityContextValue {
  userId: Id<"users"> | null;
  displayName: string | null;
}

const IdentityContext = createContext<IdentityContextValue>({
  userId: null,
  displayName: null,
});

export function useIdentity() {
  return useContext(IdentityContext);
}

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const getOrCreateAnonymousUser = useMutation(api.users.getOrCreateAnonymousUser);

  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [needsName, setNeedsName] = useState(false);

  // Reads localStorage (an external system unavailable during SSR) once on
  // mount to hydrate identity state — the documented exception to this rule.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storedId = getStoredAnonymousId();
    const storedName = getStoredDisplayName();
    if (storedId && storedName) {
      setAnonymousId(storedId);
      setDisplayName(storedName);
    } else {
      setAnonymousId(storedId ?? createAndStoreAnonymousId());
      setNeedsName(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!anonymousId || !displayName) return;
    getOrCreateAnonymousUser({ anonymousId, displayName }).then(setUserId);
  }, [anonymousId, displayName, getOrCreateAnonymousUser]);

  function handleNameSubmit(name: string) {
    storeDisplayName(name);
    setDisplayName(name);
    setNeedsName(false);
  }

  if (needsName) {
    return <OnboardingNameDialog onSubmit={handleNameSubmit} />;
  }

  return (
    <IdentityContext.Provider value={{ userId, displayName }}>
      {children}
    </IdentityContext.Provider>
  );
}
