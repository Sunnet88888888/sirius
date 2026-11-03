// Contract tests for the lecture table of contents helpers: which headings are listed, how ids stay unique,
// and which entry counts as "being read".

import { describe, expect, test } from "bun:test";

const { buildToc, slugify, activeHeadingId } = await import("../components/Objects/Activities/DynamicCanva/tocHeadings.ts");

describe("slugify", () => {
  test("lower-cases, drops punctuation and hyphenates", () => {
    expect(slugify("  What is FastAPI? ")).toBe("what-is-fastapi");
    expect(slugify("A_B -- C")).toBe("a-b-c");
  });
  test("returns an empty string when nothing is left", () => {
    expect(slugify("???")).toBe("");
  });
});

describe("buildToc", () => {
  test("lists only h1 to h3", () => {
    const toc = buildToc([
      { level: 1, text: "One" },
      { level: 2, text: "Two" },
      { level: 3, text: "Three" },
      { level: 4, text: "Four" },
    ]);
    expect(toc.map((t) => t.text)).toEqual(["One", "Two", "Three"]);
  });

  test("equal headings get distinct, stable ids", () => {
    const input = [
      { level: 2, text: "Example" },
      { level: 2, text: "Example" },
      { level: 3, text: "Example" },
    ];
    const ids = buildToc(input).map((t) => t.id);
    expect(ids).toEqual(["heading-example", "heading-example-2", "heading-example-3"]);
    expect(buildToc(input).map((t) => t.id)).toEqual(ids);
  });

  test("headings without text are skipped", () => {
    expect(buildToc([{ level: 2, text: "   " }, { level: 2, text: "!!!" }, { level: 2, text: "Real" }]).map((t) => t.text)).toEqual(["Real"]);
  });
});

describe("activeHeadingId", () => {
  const tops = [
    { id: "a", top: -400 },
    { id: "b", top: -20 },
    { id: "c", top: 300 },
  ];
  test("is the last heading that has reached the offset", () => {
    expect(activeHeadingId(tops, 100)).toBe("b");
  });
  test("is the first heading before any has been reached", () => {
    expect(activeHeadingId([{ id: "a", top: 500 }, { id: "b", top: 900 }], 100)).toBe("a");
  });
  test("is null without headings", () => {
    expect(activeHeadingId([], 100)).toBeNull();
  });
});
