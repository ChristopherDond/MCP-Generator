import path from "path";
import { parseOpenAPI } from "../src/core/parser";
import { generate } from "../src/core/generator";

const LARGE = path.resolve(__dirname, "../examples/large-scale.json");

describe("2.2 escala com fixture grande (Fase 2.2)", () => {
  it("tem ~180 ops realistas", async () => {
    const ast = await parseOpenAPI(LARGE);
    expect(ast.tools.length).toBe(180);
    expect(ast.models.length).toBe(2);
  });

  it("reduz 180 → 10 com --group-by tag", async () => {
    const tmp = path.join(__dirname, "__tmp_scale__");
    const plain = await generate({
      input: LARGE,
      lang: "typescript",
      out: tmp,
      force: false,
      incremental: false,
      http: false,
      dryRun: true,
    });
    expect(plain.success).toBe(true);
    expect(plain.summary!.tools).toBe(180);

    const grouped = await generate({
      input: LARGE,
      lang: "typescript",
      out: tmp,
      force: false,
      incremental: false,
      http: false,
      dryRun: true,
      groupBy: "tag",
    });
    expect(grouped.success).toBe(true);
    expect(grouped.summary!.tools).toBe(10);
    expect(grouped.summary!.groups).toBe(10);
  });

  it("reduz 180 → 10 com --group-by path-prefix", async () => {
    const tmp = path.join(__dirname, "__tmp_scale2__");
    const grouped = await generate({
      input: LARGE,
      lang: "typescript",
      out: tmp,
      force: false,
      incremental: false,
      http: false,
      dryRun: true,
      groupBy: "path-prefix",
    });
    expect(grouped.success).toBe(true);
    expect(grouped.summary!.tools).toBe(10);
  });
});
