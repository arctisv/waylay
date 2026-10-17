import { db, type LocalDatabase } from "./db";

/* How Waylay's local backend is written: each function is defined once with
   typed arguments and result, the way the hosted backend defined its server
   functions. The `api` object (./api.ts) points straight at these
   definitions, so the screens call them by the same names and every type
   flows through without a code generator. */

export type QueryCtx = { db: LocalDatabase };
export type MutationCtx = { db: LocalDatabase };
export type ActionCtx = { db: LocalDatabase };

export type QueryDefinition<Args, Result> = {
  kind: "query";
  handler: (ctx: QueryCtx, args: Args) => Result;
};

export type MutationDefinition<Args, Result> = {
  kind: "mutation";
  handler: (ctx: MutationCtx, args: Args) => Result | Promise<Result>;
};

export type ActionDefinition<Args, Result> = {
  kind: "action";
  handler: (ctx: ActionCtx, args: Args) => Promise<Result>;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- the "any definition" bounds below. */
export type AnyQuery = QueryDefinition<any, any>;
export type AnyMutation = MutationDefinition<any, any>;
export type AnyAction = ActionDefinition<any, any>;
export type AnyFunction = AnyQuery | AnyMutation | AnyAction;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A query reads synchronously from the in-memory tables. */
export function query<Args = Record<string, never>, Result = unknown>(
  handler: (ctx: QueryCtx, args: Args) => Result,
): QueryDefinition<Args, Result> {
  return { kind: "query", handler };
}

/** A mutation writes to the tables. */
export function mutation<Args = Record<string, never>, Result = unknown>(
  handler: (ctx: MutationCtx, args: Args) => Result | Promise<Result>,
): MutationDefinition<Args, Result> {
  return { kind: "mutation", handler };
}

/** An action does slower work, like running the model. */
export function action<Args = Record<string, never>, Result = unknown>(
  handler: (ctx: ActionCtx, args: Args) => Promise<Result>,
): ActionDefinition<Args, Result> {
  return { kind: "action", handler };
}

export type FunctionArgs<F extends AnyFunction> = Parameters<F["handler"]>[1];

export type FunctionReturnType<F extends AnyFunction> = Awaited<ReturnType<F["handler"]>>;

/** Runs a mutation or action once the database has loaded. */
export async function runFunction<F extends AnyMutation | AnyAction>(
  definition: F,
  args: FunctionArgs<F>,
): Promise<FunctionReturnType<F>> {
  await db.load();
  return (await definition.handler({ db }, args ?? {})) as FunctionReturnType<F>;
}

/** Runs a query once, outside React. */
export async function runQuery<Q extends AnyQuery>(
  definition: Q,
  args: FunctionArgs<Q>,
): Promise<FunctionReturnType<Q>> {
  await db.load();
  return definition.handler({ db }, args ?? {}) as FunctionReturnType<Q>;
}

/** An error whose `data` is a sentence meant for the person using the app. */
export class AppError<T = string> extends Error {
  readonly data: T;

  constructor(data: T) {
    super(typeof data === "string" ? data : "Something went wrong");
    this.name = "AppError";
    this.data = data;
  }
}

/** The sentence to show for a failed call, or `fallback` when there's none. */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof AppError && typeof error.data === "string") return error.data;
  if (error instanceof Error && error.message) return error.message.split("\n")[0].trim() || fallback;
  return fallback;
}
