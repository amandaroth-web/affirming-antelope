// Offline check of toOpenAIStrictSchema/stripNulls against the core schemas.
//   node apps/web/scripts/check-openai-schemas.mjs
// Asserts: strict-mode rules hold at every level, the core schemas are not
// mutated, and model output with nulls for optional fields maps back to the
// core shape (optional keys absent, never null). Loads TypeScript via jiti.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(fileURLToPath(import.meta.url));
const core = await jiti.import("../../../packages/core/src/prompts/index.ts");
const { toOpenAIStrictSchema, stripNulls } = await jiti.import("../src/lib/ai/providers/openai-schema.ts");

const SUPPORTED = new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "const", "anyOf", "description", "title", "minimum", "maximum", "minItems", "maxItems", "pattern", "format"]);
let checks = 0;

function assertStrict(node, path) {
  for (const k of Object.keys(node)) assert.ok(SUPPORTED.has(k), `${path}: unsupported keyword ${k}`);
  if (node.anyOf) node.anyOf.forEach((s, i) => assertStrict(s, `${path}.anyOf[${i}]`));
  if (node.items) assertStrict(node.items, `${path}.items`);
  const isObject = node.type === "object" || (Array.isArray(node.type) && node.type.includes("object"));
  if (isObject) {
    assert.equal(node.additionalProperties, false, `${path}: additionalProperties must be false`);
    assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), `${path}: every property must be required`);
    for (const [k, v] of Object.entries(node.properties)) assertStrict(v, `${path}.${k}`);
  }
  if (Array.isArray(node.type) && node.type.includes("null") && node.enum) {
    assert.ok(node.enum.includes(null), `${path}: nullable enum must list null`);
  }
  checks++;
}

const schemas = { observer: core.OBSERVER_SCHEMA, coach: core.COACH_SCHEMA, drill: core.DRILL_FEEDBACK_SCHEMA };
for (const [name, schema] of Object.entries(schemas)) {
  const before = JSON.stringify(schema);
  const strict = toOpenAIStrictSchema(schema);
  assertStrict(strict, name);
  assert.equal(JSON.stringify(schema), before, `${name}: core schema was mutated`);
}

// Observer: optional move/talk/intensity/stance become nullable and are stripped.
const obsStrict = toOpenAIStrictSchema(core.OBSERVER_SCHEMA).properties.annotations.items.properties;
assert.deepEqual(obsStrict.intensity.type, ["integer", "null"]);
assert.equal(obsStrict.intensity.minimum, -2);
assert.equal(obsStrict.intensity.maximum, 2);
assert.ok(obsStrict.move.enum.includes(null) && obsStrict.move.enum.includes("complex-reflection"));
assert.equal(obsStrict.turnId.type, "string", "required fields stay non-null");

const observerOut = stripNulls(
  {
    annotations: [
      { turnId: "t1", speaker: "learner", move: "open-question", talk: null, intensity: null, stance: null, note: "Asked." },
      { turnId: "t2", speaker: "employee", move: null, talk: "sustain", intensity: -1, stance: "sustain", note: "Hedged." },
    ],
  },
  core.OBSERVER_SCHEMA,
);
assert.deepEqual(observerOut, {
  annotations: [
    { turnId: "t1", speaker: "learner", move: "open-question", note: "Asked." },
    { turnId: "t2", speaker: "employee", talk: "sustain", intensity: -1, stance: "sustain", note: "Hedged." },
  ],
});

// Drill: optional strength is absent when null, kept when present.
const drillBase = { move: "simple-reflection", hitTarget: true, observation: "o", possibleResponses: ["a"], tryNext: "t" };
assert.deepEqual(stripNulls({ ...drillBase, strength: null }, core.DRILL_FEEDBACK_SCHEMA), drillBase);
assert.deepEqual(stripNulls({ ...drillBase, strength: "s" }, core.DRILL_FEEDBACK_SCHEMA), { ...drillBase, strength: "s" });

// Coach has no optional fields: converted schema is the original plus nothing nullable.
assert.ok(!JSON.stringify(toOpenAIStrictSchema(core.COACH_SCHEMA)).includes('"null"'));

console.log(`ok: ${checks} schema nodes strict-valid; null stripping matches the core shapes`);
