import type { LocalModel } from "./models";

/* The system prompt. Small models follow short, concrete rules far better
   than long ones, so this is Whirl's personality pared down to what a 1-3B
   model can actually hold onto, plus the context only this device knows:
   the date, the person's own instructions, and what Waylay remembers. */

export type PromptContext = {
  family: LocalModel["family"];
  /** Free-text "how should Waylay respond" from Personalization. */
  preferences: string | null;
  memories: string[];
  /** Whether the model may save new memories. */
  memoryEnabled: boolean;
  /** What they asked to be called, from General settings. */
  name: string | null;
  /** Measurement system from General settings; "auto" follows their region. */
  units: "auto" | "metric" | "imperial";
  now: Date;
};

const PERSONALITY = [
  "You are Waylay, a private AI assistant that runs entirely on this person's device. Nothing they write ever leaves it.",
  "Talk like a clever, warm friend: direct, concise and human, never bland or robotic. Match their tone, language and length.",
  "Lead with the answer. Keep replies short unless they ask for detail. Skip praise, filler and sign-offs.",
  "Be honest. If you are unsure or don't know, say so plainly. Never make up facts, numbers, names, quotes, links or sources.",
  "For maths, logic and code, think carefully and check your work before you answer.",
  "Use Markdown when it helps: short paragraphs, bullet lists for options, numbered lists for steps, fenced code blocks with a language tag for code, $$...$$ for maths.",
  "You can't browse the internet or open links, and you don't know about recent events.",
].join("\n");

function dateLine(now: Date): string {
  const date = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `It is ${date}, ${time} where they are (${zone}).`;
}

type Tool = {
  name: string;
  param: string;
  description: string;
  example: string;
};

function toolsFor(context: PromptContext): Tool[] {
  const tools: Tool[] = [
    {
      name: "calculate",
      param: "expression",
      description: "Works out arithmetic exactly. Use it for any calculation with more than one step.",
      example: "(12.5 * 4) / 3",
    },
  ];
  if (context.memoryEnabled) {
    tools.push({
      name: "remember",
      param: "fact",
      description:
        "Saves a lasting fact about the person for future chats, in the third person. Use it only when they share something about themselves worth keeping, or ask you to remember something.",
      example: "Their name is Sam",
    });
  }
  return tools;
}

/* Llama 3.2 was trained to call tools as a bracketed Python-style call. */
function llamaTools(tools: Tool[]): string {
  return [
    "You can call these functions. If one would help, reply with only the call, in exactly this format and nothing else:",
    "[function_name(parameter='value')]",
    "",
    ...tools.map(
      (tool) => `- ${tool.name}(${tool.param}): ${tool.description} Example: [${tool.name}(${tool.param}='${tool.example}')]`,
    ),
    "",
    "If no function is needed, just answer.",
  ].join("\n");
}

/* Qwen was trained on JSON calls inside <tool_call> tags. */
function qwenTools(tools: Tool[]): string {
  const schemas = tools.map((tool) =>
    JSON.stringify({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: { [tool.param]: { type: "string" } },
          required: [tool.param],
        },
      },
    }),
  );
  return [
    "# Tools",
    "You may call one of these functions to help. Their signatures are inside <tools></tools>:",
    "<tools>",
    ...schemas,
    "</tools>",
    "To call one, reply with only:",
    "<tool_call>",
    '{"name": <function-name>, "arguments": <args-json-object>}',
    "</tool_call>",
    "If no function is needed, just answer.",
  ].join("\n");
}

export function buildSystemPrompt(context: PromptContext): string {
  const sections = [PERSONALITY, dateLine(context.now)];

  if (context.name) sections.push(`Their name is ${context.name}.`);
  if (context.units !== "auto") {
    sections.push(
      context.units === "metric"
        ? "Use metric units (°C, km, kg) unless they ask otherwise."
        : "Use imperial units (°F, miles, pounds) unless they ask otherwise.",
    );
  }

  if (context.preferences?.trim()) {
    sections.push(
      `How they want you to respond, in their own words. Follow it:\n${context.preferences.trim()}`,
    );
  }
  if (context.memories.length > 0) {
    sections.push(
      `What you remember about them. Use it naturally when it's relevant; don't recite it:\n${context.memories
        .map((memory) => `- ${memory}`)
        .join("\n")}`,
    );
  }

  const tools = toolsFor(context);
  sections.push(context.family === "qwen" ? qwenTools(tools) : llamaTools(tools));
  return sections.join("\n\n");
}

export const THREAD_TITLE_PROMPT = [
  "Title the chat from its first message.",
  "Return only a 2-5 word, under-50-character Title Case topic. No quotes, punctuation, filler, answer, or 'New Thread'.",
  'Examples: "write an ocean poem" -> Ocean Poem; "debug this Python crash" -> Python Crash Debugging; "hi" -> Greeting.',
].join("\n");

export const THREAD_TITLE_FROM_TRANSCRIPT_PROMPT = [
  "Title the chat from the whole conversation, not just its opening line.",
  "Name what the conversation actually became; if it wandered, title where it spent its time.",
  "Return only a 2-5 word, under-50-character Title Case topic. No quotes, punctuation, filler, answer, or 'New Thread'.",
].join("\n");
