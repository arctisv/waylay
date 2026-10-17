import { calculate, formatNumber } from "./calculate";

/* Tool calls written as text by the model, in the format its family was
   trained on, and what running one produces. A reply only counts as a tool
   call when the whole of it is the call: small models sometimes mention a
   function mid-answer, and that must stay prose. */

export type ToolCall = { name: string; args: Record<string, string> };

export type ToolResult = {
  /** Fed back to the model so it can finish the answer. */
  feedback: string;
  /** An activity phase for the transcript. */
  phase?: { kind: string; label?: string; items?: { expression?: string; result?: string; error?: string }[]; error?: string };
  /** Id of a memory the tool saved. */
  memoryId?: string;
};

const LLAMA_CALL = /^\[\s*([a-z_]+)\(([\s\S]*)\)\s*\]$/i;
const QWEN_CALL = /^<tool_call>\s*([\s\S]*?)\s*<\/tool_call>$/;

function parseLlamaArgs(source: string): Record<string, string> | null {
  const args: Record<string, string> = {};
  const pattern = /([a-z_]+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi;
  let match: RegExpExecArray | null;
  let consumed = 0;
  while ((match = pattern.exec(source))) {
    args[match[1]] = match[2].slice(1, -1).replace(/\\(.)/g, "$1");
    consumed += 1;
  }
  return consumed > 0 ? args : null;
}

export function parseToolCall(text: string): ToolCall | null {
  const trimmed = text.trim();
  const llama = LLAMA_CALL.exec(trimmed);
  if (llama) {
    const args = parseLlamaArgs(llama[2]);
    return args ? { name: llama[1], args } : null;
  }
  const qwen = QWEN_CALL.exec(trimmed);
  if (qwen) {
    try {
      const parsed = JSON.parse(qwen[1]) as { name?: unknown; arguments?: unknown };
      if (typeof parsed.name !== "string" || !parsed.arguments || typeof parsed.arguments !== "object") return null;
      const args = Object.fromEntries(
        Object.entries(parsed.arguments as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
      );
      return { name: parsed.name, args };
    } catch {
      return null;
    }
  }
  return null;
}

/** While a reply streams: could this still turn out to be a tool call? */
export function mightBeToolCall(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed === "") return true;
  if ("<tool_call>".startsWith(trimmed) || trimmed.startsWith("<tool_call>")) return true;
  return /^\[\s*[a-z_]*(\(|$)/i.test(trimmed) && !trimmed.includes("\n\n");
}

export type ToolHandlers = {
  remember: (fact: string) => string | null;
};

export function runTool(call: ToolCall, handlers: ToolHandlers): ToolResult | null {
  if (call.name === "calculate") {
    const expression = call.args.expression ?? Object.values(call.args)[0] ?? "";
    try {
      const result = formatNumber(calculate(expression));
      return {
        feedback: `Result of calculate(${expression}): ${result}`,
        phase: { kind: "calc", items: [{ expression, result }] },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "it couldn't be worked out";
      return {
        feedback: `calculate(${expression}) failed: ${message}. Work it out yourself, carefully.`,
        phase: { kind: "calc", error: message, items: [{ expression, error: message }] },
      };
    }
  }
  if (call.name === "remember") {
    const fact = (call.args.fact ?? Object.values(call.args)[0] ?? "").trim();
    if (!fact) return null;
    const memoryId = handlers.remember(fact);
    return {
      feedback: memoryId ? `Saved to memory: ${fact}` : "Memory is turned off, so nothing was saved.",
      memoryId: memoryId ?? undefined,
      phase: memoryId ? { kind: "memory", label: fact } : undefined,
    };
  }
  return null;
}
