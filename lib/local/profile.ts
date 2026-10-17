"use client";

import { useMemo } from "react";

import { useQuery } from "./react";
import { api } from "./api";

/* There are no accounts: the person at this browser is the only user. They
   can give Waylay a name to call them (Settings → General); until then the
   app greets them the way it greets anyone, as "Anon". */

export const LOCAL_USER_ID = "local";

export type LocalUser = {
  id: string;
  firstName: string | null;
  fullName: string | null;
  username: string | null;
  imageUrl: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
};

export function useUser(): { isLoaded: boolean; isSignedIn: boolean; user: LocalUser | null } {
  const profile = useQuery(api.profile.get);
  const user = useMemo<LocalUser | null>(() => {
    if (profile === undefined) return null;
    const name = profile.name?.trim() || null;
    return {
      id: LOCAL_USER_ID,
      firstName: name ? name.split(/\s+/)[0] : null,
      fullName: name,
      username: null,
      imageUrl: null,
      primaryEmailAddress: null,
    };
  }, [profile]);
  return { isLoaded: profile !== undefined, isSignedIn: profile !== undefined, user };
}
