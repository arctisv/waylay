"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "@/lib/local/react";
import { errorText, type FunctionReturnType } from "@/lib/local/functions";
import { api } from "@/lib/local/api";
import { MAX_MEMORY_LENGTH } from "@/lib/local/backend/userMemory";


/* Client bindings for the Memory settings tab. Memories are read through
   actions (lib/local/backend/userMemory.ts) rather than a live query, so
   there's nothing reactive to subscribe to: these hooks fetch once when the
   tab opens and refetch after a write. Edits and removals land in the list
   first so it never waits on the write — a failure puts the old row back
   and rethrows, and the calling card turns that into a toast. */

/* The editor's cap: the same limit the backend keeps. */
export const MAX_MEMORY_CONTENT = MAX_MEMORY_LENGTH;

export type Memory = FunctionReturnType<
  typeof api.userMemory.listMemories
>["memories"][number];


/** The user's memories, plus every way to change them. `memories` is
 *  undefined until the first load answers. */
export function useMemories(enabled: boolean) {
  const listMemories = useAction(api.userMemory.listMemories);
  const addMemory = useAction(api.userMemory.addMemory);
  const editMemory = useAction(api.userMemory.editMemory);
  const forgetMemory = useAction(api.userMemory.forgetMemory);

  const [memories, setMemories] = useState<Memory[] | undefined>(undefined);
  /* What the backend says it holds. The local list has no page cap, so
     this equals `memories.length`; the card owns up to any gap anyway. */
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const result = await listMemories({});
      setMemories(result.memories);
      setTotalItems(result.totalItems);
      setError(null);
    } catch (caught) {
      setMemories([]);
      setError(errorText(caught, "Couldn't load your memories."));
    }
  }, [listMemories]);

  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    loadedRef.current = true;
    void refresh();
  }, [enabled, refresh]);

  const add = useCallback(
    async (content: string, isStatic: boolean) => {
      const created = await addMemory({ content, isStatic });
      // The backend answers with the row it wrote; if it ever doesn't, fall
      // back to a refetch rather than showing a list missing the new memory.
      if (created) {
        setMemories((prev) => [created, ...(prev ?? [])]);
        setTotalItems((count) => count + 1);
      } else {
        await refresh();
      }
    },
    [addMemory, refresh],
  );

  const edit = useCallback(
    async (id: string, content: string) => {
      const previous = memories;
      setMemories((prev) =>
        prev?.map((row) => (row.id === id ? { ...row, memory: content } : row)),
      );
      try {
        // Adopt the row that came back (its fresh timestamp) — keeping our
        // own `isStatic`, which an edit never changes.
        const updated = await editMemory({ id, content });
        if (updated) {
          setMemories((prev) =>
            prev?.map((row) =>
              row.id === id
                ? { ...row, ...updated, isStatic: row.isStatic }
                : row,
            ),
          );
        }
      } catch (caught) {
        setMemories(previous);
        throw caught;
      }
    },
    [editMemory, memories],
  );

  const forget = useCallback(
    async (id: string) => {
      const previous = memories;
      const previousTotal = totalItems;
      setMemories((prev) => prev?.filter((row) => row.id !== id));
      setTotalItems((count) => Math.max(0, count - 1));
      try {
        await forgetMemory({ id });
      } catch (caught) {
        setMemories(previous);
        setTotalItems(previousTotal);
        throw caught;
      }
    },
    [forgetMemory, memories, totalItems],
  );

  /** Empty the list without a refetch — for after a full wipe. */
  const clear = useCallback(() => {
    setMemories([]);
    setTotalItems(0);
  }, []);

  return { memories, totalItems, error, refresh, add, edit, forget, clear };
}
