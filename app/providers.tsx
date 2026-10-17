"use client";

import { useEffect } from "react";

import { db } from "@/lib/local/db";

/* Everything lives in this browser, so there's no account or server to
   connect to. Storage starts loading the moment the app mounts. */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void db.load();
  }, []);

  return children;
}
