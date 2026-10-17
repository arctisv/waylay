"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { jsonEqual } from "@/lib/json-equal";
import { db, type Channel } from "./db";
import {
  runFunction,
  runQuery,
  type AnyAction,
  type AnyMutation,
  type AnyQuery,
  type FunctionArgs,
  type FunctionReturnType,
} from "./functions";

/* The React side of the local backend: useQuery subscribes a component to a
   query and re-renders it only when a table that query read has changed and
   the answer actually differs. Same call shapes the screens were written
   against — `useQuery(api.x.y, args | "skip")`, `useMutation(api.x.y)` —
   so they read the way they always did. */

type Subscription = {
  read: () => unknown;
  subscribe: (listener: () => void) => () => void;
};

/* One live subscription per (query, arguments), shared by every component
   asking the same question, and dropped when the last one unmounts. */
const subscriptions = new Map<AnyQuery, Map<string, Subscription>>();

function argsKey(args: unknown): string {
  return JSON.stringify(args ?? {});
}

function getSubscription(query: AnyQuery, args: unknown, key: string): Subscription {
  let byArgs = subscriptions.get(query);
  if (!byArgs) {
    byArgs = new Map();
    subscriptions.set(query, byArgs);
  }
  const existing = byArgs.get(key);
  if (existing) return existing;

  let value: unknown = undefined;
  let deps: Map<Channel, number> | null = null;
  const listeners = new Set<() => void>();
  let stopWatching: (() => void) | null = null;

  const read = () => {
    if (!db.ready) return undefined;
    if (deps && !db.isStale(deps)) return value;
    const result = db.track(() => query.handler({ db }, args ?? {}));
    deps = result.deps;
    /* Same answer, same object: memoized rows downstream don't re-render. */
    if (!jsonEqual(value, result.value)) value = result.value;
    return value;
  };

  const subscription: Subscription = {
    read,
    subscribe(listener) {
      listeners.add(listener);
      if (!stopWatching) {
        void db.load();
        stopWatching = db.subscribe(() => {
          if (deps && !db.isStale(deps)) return;
          for (const notify of [...listeners]) notify();
        });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stopWatching?.();
        stopWatching = null;
        if (byArgs.get(key) === subscription) byArgs.delete(key);
        if (byArgs.size === 0) subscriptions.delete(query);
      };
    },
  };
  byArgs.set(key, subscription);
  return subscription;
}

const noSubscription = () => () => {};
const noValue = () => undefined;

/** Live result of a query, or `undefined` while storage loads or when skipped. */
export function useQuery<Q extends AnyQuery>(
  query: Q,
  ...rest: [args?: FunctionArgs<Q> | "skip"]
): FunctionReturnType<Q> | undefined {
  const args = rest[0];
  const skip = args === "skip";
  const key = skip ? null : argsKey(args);
  // The key stands in for `args`: same key, same question.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subscription = useMemo(() => (key === null ? null : getSubscription(query, args, key)), [query, key]);
  const subscribe = useCallback(
    (listener: () => void) => (subscription ? subscription.subscribe(listener) : noSubscription()),
    [subscription],
  );
  const read = useCallback(() => (subscription ? subscription.read() : undefined), [subscription]);
  return useSyncExternalStore(subscribe, read, noValue) as FunctionReturnType<Q> | undefined;
}

type QueryRequest = { query: AnyQuery; args?: unknown };

/** Several queries at once. A query that throws comes back as its Error. */
export function useQueries<T extends Record<string, QueryRequest>>(
  requests: T,
): { [K in keyof T]: FunctionReturnType<T[K]["query"]> | Error | undefined } {
  const entries = Object.entries(requests);
  const results: Record<string, unknown> = {};
  for (const [name, request] of entries) {
    try {
      // The request map is a module constant at every call site, so the hook order never changes.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      results[name] = useQuery(request.query, request.args as never);
    } catch (error) {
      results[name] = error instanceof Error ? error : new Error(String(error));
    }
  }
  return results as { [K in keyof T]: FunctionReturnType<T[K]["query"]> | Error | undefined };
}

/** The store an optimistic updater edits. */
export type OptimisticLocalStore = {
  getQuery: <Q extends AnyQuery>(query: Q, args: FunctionArgs<Q>) => FunctionReturnType<Q> | undefined;
  setQuery: <Q extends AnyQuery>(query: Q, args: FunctionArgs<Q>, value: FunctionReturnType<Q>) => void;
  getAllQueries: <Q extends AnyQuery>(
    query: Q,
  ) => Array<{ args: FunctionArgs<Q>; value: FunctionReturnType<Q> | undefined }>;
};

export type ReactMutation<F extends AnyMutation | AnyAction> = ((
  args?: FunctionArgs<F>,
) => Promise<FunctionReturnType<F>>) & {
  /** Local writes land in the same tick, before any updater could paint
   *  ahead of them, so updaters are accepted and never needed. */
  withOptimisticUpdate: (
    update: (store: OptimisticLocalStore, args: FunctionArgs<F>) => void,
  ) => ReactMutation<F>;
};

function bind<F extends AnyMutation | AnyAction>(definition: F): ReactMutation<F> {
  const call = ((args?: FunctionArgs<F>) => runFunction(definition, args as FunctionArgs<F>)) as ReactMutation<F>;
  call.withOptimisticUpdate = () => call;
  return call;
}

export function useMutation<M extends AnyMutation>(mutation: M): ReactMutation<M> {
  return useMemo(() => bind(mutation), [mutation]);
}

export function useAction<A extends AnyAction>(action: A): ReactMutation<A> {
  return useMemo(() => bind(action), [action]);
}

/** Whether the local database is ready. There are no accounts: once storage
 *  has loaded, the person at this browser is "signed in". */
export function useLocalSession(): { isLoading: boolean; isAuthenticated: boolean } {
  const ready = useSyncExternalStore(
    (listener) => {
      void db.load();
      return db.subscribe(listener);
    },
    () => db.ready,
    () => false,
  );
  return { isLoading: !ready, isAuthenticated: ready };
}

/** One-shot calls outside the render cycle. */
export const localClient = {
  query: runQuery,
  mutation: runFunction,
  action: runFunction,
};

export type LocalClient = typeof localClient;

export function useLocalClient(): LocalClient {
  return localClient;
}

