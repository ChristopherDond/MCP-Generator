import fs from "fs";
import path from "path";

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function readHbsLock(file: string): any {
  const raw = fs.readFileSync(file, "utf-8")
    .replace(/\{\{serverName\}\}/g, "__lockcheck__")
    .replace(/\{\{serverVersion\}\}/g, "0.0.0-lockcheck");
  return JSON.parse(raw);
}

function satisfiesCaret(range: string, version: string): boolean {
  const r = range.trim();
  if (!r.startsWith("^")) return true;
  const base = r.slice(1).split(".").map(Number);
  const ver = version.split(".").map(Number);
  if (base[0] !== 0) return ver[0] === base[0] && compare(ver, base) >= 0;
  if (base[1] !== 0) return ver[0] === 0 && ver[1] === base[1] && compare(ver, base) >= 0;
  return ver.join(".") === base.join(".");
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function above(v: string, floor: string): boolean {
  return compare(v.split(".").map(Number), floor.split(".").map(Number)) > 0;
}

describe("scaffold typescript lockfile snapshot", () => {
  const pkgHbs = path.resolve(__dirname, "../src/templates/typescript/package.json.hbs");
  const lockHbs = path.resolve(__dirname, "../src/templates/typescript/package-lock.json.hbs");

  it("root ranges match package.json.hbs", () => {
    const pkg = readJson(pkgHbs);
    const lock = readHbsLock(lockHbs);
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(pkg.devDependencies);
  });

  it("locked SDK satisfies scaffold range", () => {
    const pkg = readJson(pkgHbs);
    const lock = readHbsLock(lockHbs);
    const range = pkg.dependencies["@modelcontextprotocol/sdk"];
    const ver = lock.packages["node_modules/@modelcontextprotocol/sdk"].version;
    expect(satisfiesCaret(range, ver)).toBe(true);
  });

  it("scaffold lockfile carries no vulnerable ip-address", () => {
    const lock = readHbsLock(lockHbs);
    const ver: string = lock.packages["node_modules/ip-address"].version;
    expect(above(ver, "10.5.0")).toBe(true);
  });
});

describe("project lockfile audit guard", () => {
  it("project lockfile carries no vulnerable ip-address", () => {
    const lock = readJson(path.resolve(__dirname, "../package-lock.json"));
    const ver: string = lock.packages["node_modules/ip-address"].version;
    expect(above(ver, "10.5.0")).toBe(true);
  });
});
