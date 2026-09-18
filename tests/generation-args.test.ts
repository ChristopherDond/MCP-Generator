import Handlebars from "handlebars";
import "../src/core/templating";

function schemaFor(type: string): { type: string } {
  return { type };
}

describe("hasBodyParam", () => {
  const helper = Handlebars.helpers.hasBodyParam as (params: Array<{ in: string }>) => boolean;

  it.each([
    { params: [{ in: "body" }], expected: true },
    { params: [{ in: "query" }, { in: "body" }], expected: true },
    { params: [{ in: "query" }], expected: false },
    { params: [], expected: false },
    { params: [{ in: "path" }, { in: "header" }, { in: "cookie" }], expected: false },
    { params: [{ in: "BODY" }], expected: false },
  ])("detects body in $params", ({ params, expected }) => {
    expect(helper(params)).toBe(expected);
  });

  it("handles undefined", () => {
    expect(helper(undefined as unknown as Array<{ in: string }>)).toBe(false);
  });

  it("handles null", () => {
    expect(helper(null as unknown as Array<{ in: string }>)).toBe(false);
  });
});

describe("generation arg control", () => {
  it.each([
    { args: [{ name: "x", required: true }], required: ["x"], optional: [] },
    { args: [{ name: "x", required: false }], required: [], optional: ["x"] },
    {
      args: [
        { name: "a", required: true },
        { name: "b", required: false },
        { name: "c", required: true },
      ],
      required: ["a", "c"],
      optional: ["b"],
    },
    { args: [], required: [], optional: [] },
  ])("splits required and optional", ({ args, required, optional }) => {
    const requiredHelper = Handlebars.helpers.requiredParams as (p: Array<{ required: boolean }>) => Array<{ name: string }>;
    const optionalHelper = Handlebars.helpers.optionalParams as (p: Array<{ required: boolean }>) => Array<{ name: string }>;
    expect(requiredHelper(args as Array<{ required: boolean }>).map((p) => (p as { name: string }).name)).toEqual(required);
    expect(optionalHelper(args as Array<{ required: boolean }>).map((p) => (p as { name: string }).name)).toEqual(optional);
  });

  it.each([
    { type: "string", ts: "string" },
    { type: "number", ts: "number" },
    { type: "boolean", ts: "boolean" },
    { type: "object", ts: "Record<string, unknown>" },
    { type: "array", ts: "unknown[]" },
    { type: "unknown-thing", ts: "string" },
  ])("maps $type to ts $ts", ({ type, ts }) => {
    const helper = Handlebars.helpers.tsType as (t: string) => string;
    expect(helper(type)).toBe(ts);
  });

  it.each([
    { type: "string", go: "string" },
    { type: "number", go: "float64" },
    { type: "boolean", go: "bool" },
    { type: "array", go: "[]any" },
    { type: "object", go: "map[string]any" },
  ])("maps $type to go $go", ({ type, go }) => {
    const helper = Handlebars.helpers.goType as (t: string) => string;
    expect(helper(type)).toBe(go);
  });

  it.each([
    { params: [{ params: [{ name: "h", in: "header" }] }], expected: ["h"] },
    { params: [{ params: [{ name: "q", in: "query" }] }], expected: [] },
    { params: [], expected: [] },
    {
      params: [
        { params: [{ name: "h", in: "header" }] },
        { params: [{ name: "h", in: "header" }, { name: "k", in: "header" }] },
      ],
      expected: ["h", "k"],
    },
  ])("collects header params", ({ params, expected }) => {
    const helper = Handlebars.helpers.allHeaderParams as (
      tools: Array<{ params: Array<{ name: string; in: string }> }>
    ) => Array<{ name: string }>;
    expect(helper(params).map((p) => p.name)).toEqual(expected);
  });

  it.each([schemaFor("string"), schemaFor("number"), schemaFor("object")])("keeps schema type", (schema) => {
    expect(schema.type).toMatch(/string|number|object/);
  });
});
