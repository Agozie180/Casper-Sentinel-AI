import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isEntrypoint } from "./main.js";

describe("isEntrypoint", () => {
  it("matches Windows script paths by normalizing them to file URLs", () => {
    const scriptPath = "C:\\Users\\USER\\casper-sentinel\\apps\\api\\src\\main.ts";

    expect(isEntrypoint(pathToFileURL(scriptPath).href, scriptPath)).toBe(true);
  });

  it("does not match missing or different script paths", () => {
    const scriptPath = "C:\\Users\\USER\\casper-sentinel\\apps\\api\\src\\main.ts";

    expect(isEntrypoint(pathToFileURL(scriptPath).href, undefined)).toBe(false);
    expect(isEntrypoint(pathToFileURL(scriptPath).href, "C:\\Users\\USER\\casper-sentinel\\apps\\api\\src\\other.ts")).toBe(
      false,
    );
  });
});
