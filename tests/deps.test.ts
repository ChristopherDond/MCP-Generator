import fs from "fs";
import path from "path";

describe("direct dependencies", () => {
  it("declares js-yaml and openapi-types used by src/", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8")
    );
    expect(pkg.dependencies["js-yaml"]).toBeDefined();
    expect(pkg.dependencies["openapi-types"]).toBeDefined();
  });
});
