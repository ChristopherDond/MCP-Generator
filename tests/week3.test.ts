import path from "path";
import { parseOpenAPI } from "../src/core/parser";

const WEEK3 = path.resolve(__dirname, "../examples/week3.json");

describe("week3 features", () => {
  it("parses oneOf into model.oneOf", async () => {
    const ast = await parseOpenAPI(WEEK3);
    const item = ast.models.find((m) => m.name === "Item");
    expect(item).toBeDefined();
    expect(item!.oneOf).toBeDefined();
    expect(item!.oneOf!.length).toBe(2);
  });

  it("includes securitySchemes in AST", async () => {
    const ast = await parseOpenAPI(WEEK3);
    expect(ast.securitySchemes).toBeDefined();
    expect(Object.keys(ast.securitySchemes!)).toEqual(expect.arrayContaining(["ApiKeyAuth", "BearerAuth"]));
  });

  it("attaches operation.security to tools", async () => {
    const ast = await parseOpenAPI(WEEK3);
    const tool = ast.tools.find((t) => t.name === "get_items");
    expect(tool).toBeDefined();
    expect(tool!.security).toBeDefined();
    expect(tool!.security!.length).toBeGreaterThan(0);
  });
});
