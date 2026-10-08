// Three separate AI functions, kept conceptually apart:
//   Role-Player (realism), Observer (analysis), Coach (teaching).
// The drill coach is a lightweight Coach for single drill responses.

export * from "./rolePlayer";
export * from "./observer";
export * from "./coach";
export * from "./drillCoach";

/** Intended model per AI role. The API layer may adjust. */
export const MODEL_ROLES = {
  rolePlayer: "claude-sonnet-5-5",
  observer: "claude-opus-5-5",
  coach: "claude-opus-5-5",
  drillCoach: "claude-sonnet-5-5",
} as const;

export type ModelRole = keyof typeof MODEL_ROLES;
