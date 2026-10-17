/* A small, safe arithmetic evaluator for the calculate tool: numbers,
   + - * / % ^, parentheses, a few constants and functions. No eval. */

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  min: Math.min,
  max: Math.max,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token = { type: "number"; value: number } | { type: "name"; value: string } | { type: "op"; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const source = input.replace(/×/g, "*").replace(/÷/g, "/").replace(/,(?=\d{3}\b)/g, "");
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
    } else if (/[\d.]/.test(char)) {
      const match = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\.?/i.exec(source.slice(index));
      if (!match) throw new Error(`Unexpected "${char}"`);
      tokens.push({ type: "number", value: Number(match[0]) });
      index += match[0].length;
    } else if (/[a-z]/i.test(char)) {
      const match = /^[a-z][a-z0-9]*/i.exec(source.slice(index));
      tokens.push({ type: "name", value: match![0].toLowerCase() });
      index += match![0].length;
    } else if ("+-*/%^(),".includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
    } else {
      throw new Error(`Unexpected "${char}"`);
    }
  }
  return tokens;
}

/** Evaluates an expression like "(12.5 * 4) / 3" or "sqrt(2) ^ 2". */
export function calculate(expression: string): number {
  const tokens = tokenize(expression);
  let position = 0;

  const peek = () => tokens[position];
  const takeOp = (value: string) => {
    const token = peek();
    if (token?.type === "op" && token.value === value) {
      position += 1;
      return true;
    }
    return false;
  };

  const expressionLevel = (): number => {
    let value = term();
    for (;;) {
      if (takeOp("+")) value += term();
      else if (takeOp("-")) value -= term();
      else return value;
    }
  };

  const term = (): number => {
    let value = power();
    for (;;) {
      if (takeOp("*")) value *= power();
      else if (takeOp("/")) value /= power();
      else if (takeOp("%")) value %= power();
      else return value;
    }
  };

  const power = (): number => {
    const base = unary();
    return takeOp("^") ? base ** power() : base;
  };

  const unary = (): number => {
    if (takeOp("-")) return -unary();
    if (takeOp("+")) return unary();
    return primary();
  };

  const primary = (): number => {
    const token = peek();
    if (!token) throw new Error("The expression ends too soon");
    position += 1;
    if (token.type === "number") return token.value;
    if (token.type === "op" && token.value === "(") {
      const value = expressionLevel();
      if (!takeOp(")")) throw new Error("A bracket isn't closed");
      return value;
    }
    if (token.type === "name") {
      if (token.value in CONSTANTS) return CONSTANTS[token.value];
      const fn = FUNCTIONS[token.value];
      if (!fn || !takeOp("(")) throw new Error(`Unknown name "${token.value}"`);
      const args = [expressionLevel()];
      while (takeOp(",")) args.push(expressionLevel());
      if (!takeOp(")")) throw new Error("A bracket isn't closed");
      return fn(...args);
    }
    throw new Error(`Unexpected "${token.value}"`);
  };

  const result = expressionLevel();
  if (position < tokens.length) throw new Error("The expression has extra parts");
  if (!Number.isFinite(result)) throw new Error("The result isn't a finite number");
  return result;
}

/** Formats a result without float noise: 0.1 + 0.2 reads as 0.3. */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US", { useGrouping: false }) : String(Number(value.toPrecision(12)));
}
