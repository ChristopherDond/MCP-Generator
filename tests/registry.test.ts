import fs from "fs";
import os from "os";
import path from "path";
import { fetchSpecToCwd } from "../src/core/registry";

describe("fetchSpecToCwd", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("saves a registry spec to a custom path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-registry-"));
    const target = path.join(tmpDir, "nested", "custom-spec.json");

    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "{\"ok\":true}",
    } as any);

    const saved = await fetchSpecToCwd("petstore", target);

    expect(saved).toBe(target);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, "utf-8")).toBe("{\"ok\":true}");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});