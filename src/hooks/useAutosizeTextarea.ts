'use client';

import { useLayoutEffect, type RefObject } from 'react';

/** Grows a textarea with its content. The CSS max-height decides where it starts scrolling. */
export function useAutosizeTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}
