import fs from "fs";
import os from "os";
import path from "path";
import type { MCPTool } from "../src/core/types";
import {
  parseTagList,
  parseGroupBy,
  loadOperationAllowlistFile,
  filterTools,
  groupTools,
  toGroupMetadata,
} from "../src/core/filter-group";

function tool(over: Partial<MCPTool> & { name: string }): MCPTool {
  return {
    description: over.name,
    method: "GET",
    path: "/default",
    params: [],
    exampleResponse: null,
    tags: [],
    ...over,
  };
}

describe("parseTagList", () => {
  it.each([
    { input: undefined, expected: [] },
    { input: "", expected: [] },
    { input: "  ", expected: [] },
    { input: "pets", expected: ["pets"] },
    { input: "pets,orders", expected: ["pets", "orders"] },
    { input: "pets, orders , inventory", expected: ["pets", "orders", "inventory"] },
    { input: "pets,,orders", expected: ["pets", "orders"] },
    { input: ["pets", "orders"], expected: ["pets", "orders"] },
    { input: ["pets,orders", "inventory"], expected: ["pets", "orders", "inventory"] },
    { input: ["  pets  ", ""], expected: ["pets"] },
  ])("parses $input", ({ input, expected }) => {
    expect(parseTagList(input as string | string[] | undefined)).toEqual(expected);
  });
});

describe("parseGroupBy", () => {
  it.each([
    { input: undefined, expected: undefined },
    { input: "", expected: undefined },
    { input: "   ", expected: undefined },
    { input: "tag", expected: "tag" },
    { input: "path-prefix", expected: "path-prefix" },
    { input: "  tag  ", expected: "tag" },
  ])("parses $input", ({ input, expected }) => {
    expect(parseGroupBy(input)).toBe(expected);
  });

  it.each(["tags", "prefix", "TAG", "group", "none"])("rejects %s", (input) => {
    expect(() => parseGroupBy(input)).toThrow(/Invalid --group-by/);
  });
});

describe("loadOperationAllowlistFile", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-allow-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("returns empty for undefined", () => {
    expect(loadOperationAllowlistFile(undefined)).toEqual([]);
  });

  it("returns empty for blank string", () => {
    expect(loadOperationAllowlistFile("   ")).toEqual([]);
  });

  it("throws for missing file", () => {
    expect(() => loadOperationAllowlistFile(path.join(dir, "nope.txt"))).toThrow(/Allowlist file not found/);
  });

  it("parses JSON array", () => {
    const f = path.join(dir, "allow.json");
    fs.writeFileSync(f, JSON.stringify(["get_pets", "post_pets"]));
    expect(loadOperationAllowlistFile(f)).toEqual(["get_pets", "post_pets"]);
  });

  it("parses newline separated", () => {
    const f = path.join(dir, "allow.txt");
    fs.writeFileSync(f, "get_pets\npost_pets\n");
    expect(loadOperationAllowlistFile(f)).toEqual(["get_pets", "post_pets"]);
  });

  it("parses comma separated", () => {
    const f = path.join(dir, "allow.txt");
    fs.writeFileSync(f, "get_pets, post_pets");
    expect(loadOperationAllowlistFile(f)).toEqual(["get_pets", "post_pets"]);
  });

  it("ignores blank lines", () => {
    const f = path.join(dir, "allow.txt");
    fs.writeFileSync(f, "\nget_pets\n\n  \npost_pets\n");
    expect(loadOperationAllowlistFile(f)).toEqual(["get_pets", "post_pets"]);
  });

  it("returns empty for empty file", () => {
    const f = path.join(dir, "allow.txt");
    fs.writeFileSync(f, "  \n");
    expect(loadOperationAllowlistFile(f)).toEqual([]);
  });

  it("rejects non-array JSON", () => {
    const f = path.join(dir, "allow.json");
    fs.writeFileSync(f, JSON.stringify({ a: 1 }));
    expect(() => loadOperationAllowlistFile(f)).toThrow(/must contain a JSON array/);
  });
});

describe("filterTools", () => {
  const tools = [
    tool({ name: "get_pets", method: "GET", path: "/pets", tags: ["pets"] }),
    tool({ name: "post_pets", method: "POST", path: "/pets", tags: ["pets"], operationId: "createPet" }),
    tool({ name: "get_orders", method: "GET", path: "/orders", tags: ["orders"] }),
    tool({ name: "get_admin", method: "GET", path: "/admin/users", tags: [] }),
  ];

  it("returns all when no filters", () => {
    expect(filterTools(tools, {})).toHaveLength(4);
  });

  it("includes by single tag", () => {
    expect(filterTools(tools, { includeTags: ["pets"] }).map((t) => t.name)).toEqual(["get_pets", "post_pets"]);
  });

  it("includes by multiple tags", () => {
    expect(filterTools(tools, { includeTags: ["pets", "orders"] })).toHaveLength(3);
  });

  it("excludes by tag", () => {
    expect(filterTools(tools, { excludeTags: ["pets"] }).map((t) => t.name)).toEqual(["get_orders", "get_admin"]);
  });

  it("include then exclude narrows", () => {
    expect(filterTools(tools, { includeTags: ["pets", "orders"], excludeTags: ["orders"] }).map((t) => t.name)).toEqual([
      "get_pets",
      "post_pets",
    ]);
  });

  it("filters by path prefix", () => {
    expect(filterTools(tools, { pathPrefix: "/admin" }).map((t) => t.name)).toEqual(["get_admin"]);
  });

  it("path prefix matches nested paths", () => {
    expect(filterTools(tools, { pathPrefix: "/pets" })).toHaveLength(2);
  });

  it("allowlist matches tool name", () => {
    expect(filterTools(tools, { allowlist: ["get_pets"] }).map((t) => t.name)).toEqual(["get_pets"]);
  });

  it("allowlist matches operationId", () => {
    expect(filterTools(tools, { allowlist: ["createPet"] }).map((t) => t.name)).toEqual(["post_pets"]);
  });

  it("allowlist matches METHOD path", () => {
    expect(filterTools(tools, { allowlist: ["GET /orders"] }).map((t) => t.name)).toEqual(["get_orders"]);
  });

  it("allowlist matches METHOD:path", () => {
    expect(filterTools(tools, { allowlist: ["GET:/orders"] }).map((t) => t.name)).toEqual(["get_orders"]);
  });

  it("combines tag include with allowlist", () => {
    expect(
      filterTools(tools, { includeTags: ["pets", "orders"], allowlist: ["get_orders"] }).map((t) => t.name)
    ).toEqual(["get_orders"]);
  });

  it("combines path prefix with tag include", () => {
    expect(filterTools(tools, { includeTags: ["pets"], pathPrefix: "/pets" })).toHaveLength(2);
    expect(filterTools(tools, { includeTags: ["orders"], pathPrefix: "/pets" })).toHaveLength(0);
  });

  it("empty include list means no filtering", () => {
    expect(filterTools(tools, { includeTags: [] })).toHaveLength(4);
  });

  it("unknown tag yields empty", () => {
    expect(filterTools(tools, { includeTags: ["nope"] })).toHaveLength(0);
  });
});

describe("groupTools by tag", () => {
  const tools = [
    tool({ name: "get_pets", method: "GET", path: "/pets", tags: ["pets"] }),
    tool({ name: "post_pets", method: "POST", path: "/pets", tags: ["pets"] }),
    tool({ name: "get_orders", method: "GET", path: "/orders", tags: ["orders"] }),
    tool({ name: "get_misc", method: "GET", path: "/misc", tags: [] }),
  ];

  it("emits one tool per tag plus untagged", () => {
    const grouped = groupTools(tools, "tag");
    expect(grouped).toHaveLength(3);
    expect(grouped.every((g) => g.isGroup)).toBe(true);
  });

  it("names groups deterministically", () => {
    const grouped = groupTools(tools, "tag");
    expect(grouped.map((g) => g.name).sort()).toEqual(["orders_group", "pets_group", "untagged_group"]);
  });

  it("records mode and key", () => {
    const grouped = groupTools(tools, "tag");
    const pets = grouped.find((g) => g.groupKey === "pets")!;
    expect(pets.groupMode).toBe("tag");
    expect(pets.tags).toEqual(["pets"]);
  });

  it("keeps member names", () => {
    const grouped = groupTools(tools, "tag");
    const pets = grouped.find((g) => g.groupKey === "pets")!;
    expect(pets.groupMembers!.map((m) => m.name).sort()).toEqual(["get_pets", "post_pets"]);
  });

  it("requires action param", () => {
    const grouped = groupTools(tools, "tag");
    for (const g of grouped) {
      const action = g.params.find((p) => p.name === "action")!;
      expect(action.required).toBe(true);
      expect(action.enum!.sort()).toEqual(g.groupMembers!.map((m) => m.name).sort());
    }
  });

  it("unions member params as optional", () => {
    const withParams = [
      tool({
        name: "a_one",
        path: "/a/1",
        tags: ["a"],
        params: [{ name: "limit", description: "", type: "number", in: "query", required: true, schema: { type: "integer" } } as MCPTool["params"][number]],
      }),
      tool({
        name: "a_two",
        path: "/a/2",
        tags: ["a"],
        params: [{ name: "q", description: "", type: "string", in: "query", required: false, schema: { type: "string" } } as MCPTool["params"][number]],
      }),
    ];
    const [group] = groupTools(withParams, "tag");
    expect(group.params.map((p) => p.name).sort()).toEqual(["action", "limit", "q"]);
    expect(group.params.find((p) => p.name === "limit")!.required).toBe(false);
  });

  it("avoids colliding with existing tool names", () => {
    const withCollision = [...tools, tool({ name: "pets_group", path: "/x", tags: ["other"] })];
    const grouped = groupTools(withCollision, "tag");
    const pets = grouped.find((g) => g.groupKey === "pets")!;
    expect(pets.name).toBe("pets_group_2");
  });

  it("uses first tag for multi-tag tools", () => {
    const multi = [tool({ name: "m", path: "/m", tags: ["one", "two"] })];
    const [group] = groupTools(multi, "tag");
    expect(group.groupKey).toBe("one");
  });

  it("sanitizes special chars in key", () => {
    const special = [tool({ name: "s", path: "/s", tags: ["Billing V2!"] })];
    const [group] = groupTools(special, "tag");
    expect(group.name).toBe("billing_v2_group");
  });

  it("handles empty input", () => {
    expect(groupTools([], "tag")).toEqual([]);
  });
});

describe("groupTools by path-prefix", () => {
  const tools = [
    tool({ name: "get_pets", method: "GET", path: "/pets", tags: ["pets"] }),
    tool({ name: "get_pet", method: "GET", path: "/pets/{id}", tags: ["pets"] }),
    tool({ name: "get_orders", method: "GET", path: "/orders", tags: ["orders"] }),
  ];

  it("emits one tool per first segment", () => {
    const grouped = groupTools(tools, "path-prefix");
    expect(grouped).toHaveLength(2);
  });

  it("records path-prefix mode", () => {
    const grouped = groupTools(tools, "path-prefix");
    expect(grouped.every((g) => g.groupMode === "path-prefix")).toBe(true);
    expect(grouped.map((g) => g.groupKey).sort()).toEqual(["orders", "pets"]);
  });

  it("groups nested paths under root segment", () => {
    const grouped = groupTools(tools, "path-prefix");
    const pets = grouped.find((g) => g.groupKey === "pets")!;
    expect(pets.groupMembers).toHaveLength(2);
  });

  it("maps root path to root group", () => {
    const [group] = groupTools([tool({ name: "root", path: "/" })], "path-prefix");
    expect(group.groupKey).toBe("root");
  });

  it("does not copy tags in path-prefix mode", () => {
    const grouped = groupTools(tools, "path-prefix");
    expect(grouped.every((g) => g.tags.length === 0)).toBe(true);
  });

  it("emits group path per bucket", () => {
    const grouped = groupTools(tools, "path-prefix");
    const pets = grouped.find((g) => g.groupKey === "pets")!;
    expect(pets.path).toBe("/group/pets");
  });

  it("action enum lists members", () => {
    const grouped = groupTools(tools, "path-prefix");
    const pets = grouped.find((g) => g.groupKey === "pets")!;
    expect(pets.params[0].enum!.sort()).toEqual(["get_pet", "get_pets"]);
  });

  it("handles empty input", () => {
    expect(groupTools([], "path-prefix")).toEqual([]);
  });
});

describe("toGroupMetadata", () => {
  it("maps grouped tools to metadata", () => {
    const grouped = groupTools([tool({ name: "a", path: "/a", tags: ["t"] })], "tag");
    expect(toGroupMetadata(grouped)).toEqual([{ name: "t_group", key: "t", mode: "tag", members: ["a"] }]);
  });

  it("skips non-group tools", () => {
    expect(toGroupMetadata([tool({ name: "a", path: "/a" })])).toEqual([]);
  });

  it("handles empty input", () => {
    expect(toGroupMetadata([])).toEqual([]);
  });

  it("preserves path-prefix mode", () => {
    const grouped = groupTools([tool({ name: "a", path: "/a" })], "path-prefix");
    expect(toGroupMetadata(grouped)[0].mode).toBe("path-prefix");
  });
});
