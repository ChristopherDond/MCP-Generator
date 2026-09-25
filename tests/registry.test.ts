import fs from "fs";
import os from "os";
import path from "path";
import { fetchSpecToCwd } from "../src/core/registry";
import { validateRemoteUrl } from "../src/core/security";

describe("fetchSpecToCwd", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("saves a registry spec to a custom path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-registry-"));
    const target = path.join(tmpDir, "nested", "custom-spec.json");

    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "application/json",
        "content-length": "11",
      }),
      text: async () => '{"ok":true}',
    } as any);

    const saved = await fetchSpecToCwd("petstore", target);

    expect(saved).toBe(target);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, "utf-8")).toBe('{"ok":true}');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects non-HTTPS URLs without calling fetch", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "application/json",
        "content-length": "11",
      }),
      text: async () => '{"ok":true}',
    } as any);

    expect(() => validateRemoteUrl("http://example.com/spec.json")).toThrow(
      /Only HTTPS/
    );
    expect(() => validateRemoteUrl("http://127.0.0.1:9/spec.json")).toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects unknown registry keys without calling fetch", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    await expect(fetchSpecToCwd("nope-unknown")).rejects.toThrow(
      /Unknown registry key/
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects removed registry keys without calling fetch", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    await expect(fetchSpecToCwd("azure")).rejects.toThrow(/was removed/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
