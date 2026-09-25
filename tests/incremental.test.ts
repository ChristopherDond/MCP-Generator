import fs from "fs";
import os from "os";
import path from "path";
import { extractHandlers, injectHandlers, GO_DEFAULT_STUB_PATTERN, PY_DEFAULT_STUB_PATTERN, TS_DEFAULT_STUB_PATTERN } from "../src/core/incremental";

const languages = [
  { lang: "typescript", prefix: "//", indent: "    ", code: ['const message = "preserved";', 'return message;'], stub: 'return "default";', pattern: TS_DEFAULT_STUB_PATTERN },
  { lang: "go", prefix: "//", indent: "\t\t", code: ['message := "preserved"', 'return message'], stub: 'return "default"', pattern: GO_DEFAULT_STUB_PATTERN },
  { lang: "python", prefix: "#", indent: "    ", code: ['message = "preserved"', 'return message'], stub: 'return "default"', pattern: PY_DEFAULT_STUB_PATTERN },
];

describe("incremental marker preservation", () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-markers-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  describe.each(languages)("$lang round-trip", ({ prefix, indent, code, stub, pattern }) => {
    it.each(["\n", "\r\n"])("preserves full marker lines and surrounding content with %j", (eol) => {
      const start = `${indent}${prefix} @@mcp-gen:start:get_pets  `;
      const end = `${indent}${prefix} @@mcp-gen:end:get_pets  `;
      const before = ["outside before", start].join(eol) + eol;
      const after = [end, "outside between", `${indent}${prefix} @@mcp-gen:start:other`, `${indent}${stub}`, `${indent}${prefix} @@mcp-gen:end:other`, "outside after"].join(eol);
      const customCode = code.map((line) => indent + line).join(eol);
      const customized = before + customCode + eol + after;
      const rendered = before + indent + stub + eol + after;
      const file = path.join(tmpDir, "server.txt");
      fs.writeFileSync(file, customized);

      const extracted = extractHandlers(file);
      expect(extracted.handlers.get("get_pets")).toBe(customCode);
      const injected = injectHandlers(rendered, extracted, pattern);
      expect(injected.result).toBe(customized);
      expect(injected.preserved).toEqual(["get_pets"]);

      fs.writeFileSync(file, injected.result);
      const roundTrip = extractHandlers(file);
      expect(roundTrip).toEqual(extracted);
      expect(injectHandlers(rendered, roundTrip, pattern)).toEqual(injected);
      expect(injectHandlers(injected.result, roundTrip, pattern)).toEqual({ result: customized, preserved: [] });
    });
  });

  it("extracts guard <generated:handlers:name> blocks like legacy markers", () => {
    const file = path.join(tmpDir, "guard.txt");
    const content = [
      "outside before",
      "// <generated:handlers:get_pets>",
      '    const message = "preserved";',
      "// </generated:handlers>",
      "outside after",
    ].join("\n");
    fs.writeFileSync(file, content);
    const extracted = extractHandlers(file);
    expect(extracted.handlers.get("get_pets")).toBe('    const message = "preserved";');
  });

  it("legacy @@ markers survive surrounding region comments", () => {
    const file = path.join(tmpDir, "legacy-region.txt");
    const start = `    // @@mcp-gen:start:get_pets`;
    const end = `    // @@mcp-gen:end:get_pets`;
    const customized = [
      "// <generated:handlers>",
      start,
      '    const message = "preserved";',
      end,
      "// </generated:handlers>",
    ].join("\n");
    fs.writeFileSync(file, customized);
    const extracted = extractHandlers(file);
    expect(extracted.handlers.get("get_pets")).toBe('    const message = "preserved";');
    const rendered = customized.replace('const message = "preserved";', 'return "default";');
    const injected = injectHandlers(rendered, extracted, TS_DEFAULT_STUB_PATTERN);
    expect(injected.result).toBe(customized);
    expect(injected.preserved).toEqual(["get_pets"]);
  });
});
