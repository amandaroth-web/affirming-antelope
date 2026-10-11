// Adapts the core JSON schemas to OpenAI strict structured outputs, and maps the
// model's output back to the core shape. No imports, so scripts can load it directly.
//
// Strict mode needs every property listed in `required` and
// `additionalProperties: false` on every object. An optional field becomes
// required-but-nullable; stripNulls() removes those nulls again, so callers see
// exactly the shape the core schema (and its TypeScript type) describes: the
// optional key is absent, never null.

type Schema = Record<string, unknown>;

/** Keywords strict mode accepts (developers.openai.com/api/docs/guides/structured-outputs). */
const SUPPORTED = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  "anyOf",
  "description",
  "title",
  "$ref",
  "$defs",
  "definitions",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
]);

function isObj(v: unknown): v is Schema {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isContiguousIntegerEnum(s: Schema): s is Schema & { enum: number[] } {
  if (s.type !== "integer" || !Array.isArray(s.enum) || s.enum.length === 0) return false;
  const vals = [...(s.enum as unknown[])];
  if (!vals.every((v) => Number.isInteger(v))) return false;
  const sorted = (vals as number[]).sort((a, b) => a - b);
  return sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
}

function convert(node: Schema): Schema {
  const out: Schema = {};
  for (const [k, v] of Object.entries(node)) {
    if (!SUPPORTED.has(k)) continue; // e.g. default, examples, minLength, allOf, not
    out[k] = v;
  }

  // An integer enum over a contiguous range ([-2..2]) is the same constraint as
  // minimum/maximum, which strict mode documents explicitly.
  if (isContiguousIntegerEnum(out)) {
    const vals = out.enum;
    delete (out as Schema).enum;
    out.minimum = Math.min(...vals);
    out.maximum = Math.max(...vals);
  }

  if (isObj(out.items)) out.items = convert(out.items);
  if (Array.isArray(out.anyOf)) out.anyOf = out.anyOf.map((s) => (isObj(s) ? convert(s) : s));
  for (const defsKey of ["$defs", "definitions"]) {
    if (isObj(out[defsKey])) {
      out[defsKey] = Object.fromEntries(
        Object.entries(out[defsKey] as Schema).map(([n, s]) => [n, isObj(s) ? convert(s) : s]),
      );
    }
  }

  if (isObj(out.properties)) {
    const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
    const props: Schema = {};
    for (const [name, child] of Object.entries(out.properties)) {
      if (!isObj(child)) continue;
      const c = convert(child);
      props[name] = required.has(name) ? c : nullable(c);
    }
    out.properties = props;
    out.required = Object.keys(props);
    out.additionalProperties = false;
  } else if (out.type === "object") {
    out.properties = {};
    out.required = [];
    out.additionalProperties = false;
  }
  return out;
}

/** Same schema, plus null. */
function nullable(s: Schema): Schema {
  if (typeof s.type === "string" && s.type !== "object" && s.type !== "array" && !("anyOf" in s)) {
    const out: Schema = { ...s, type: [s.type, "null"] };
    if (Array.isArray(s.enum)) out.enum = [...s.enum, null];
    return out;
  }
  const { description, ...rest } = s;
  return { anyOf: [rest, { type: "null" }], ...(description ? { description } : {}) };
}

/** A strict-mode copy of a core schema. The core schema is not modified. */
export function toOpenAIStrictSchema(schema: Schema): Schema {
  if (schema.type !== "object") throw new Error("OpenAI strict schemas need an object at the root.");
  return convert(schema);
}

/**
 * Removes the nulls toOpenAIStrictSchema allowed for optional properties, guided
 * by the original (core) schema, so the result matches the core type.
 */
export function stripNulls(value: unknown, schema: Schema): unknown {
  if (Array.isArray(value)) {
    const items = isObj(schema.items) ? schema.items : {};
    return value.map((v) => stripNulls(v, items));
  }
  if (!isObj(value) || !isObj(schema.properties)) return value;
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  const props = schema.properties as Schema;
  const out: Schema = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === null && !required.has(k)) continue;
    out[k] = stripNulls(v, isObj(props[k]) ? (props[k] as Schema) : {});
  }
  return out;
}
