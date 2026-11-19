import "server-only";
import { randomInt } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 8;

/** A readable temporary password, e.g. "sal-tiger-4827". Members change it after first sign-in. */
export function temporaryPassword() {
  const words = ["sal", "tiger", "gaur", "dhole", "roller", "meadow", "bamboo", "barasingha", "langur", "owl", "teak", "mahua"];
  const pick = () => words[randomInt(words.length)];
  return `${pick()}-${pick()}-${randomInt(1000, 10000)}`;
}

export function passwordProblem(password: string, confirm?: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 72) return "Use at most 72 characters.";
  if (confirm !== undefined && password !== confirm) return "The two passwords don't match.";
  return null;
}
