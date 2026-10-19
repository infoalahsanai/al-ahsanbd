import { describe, expect, it } from "vitest";
import { extractProjectFiles, projectZip, refinementMessage, safeProjectPath } from "./project-files";
import { needsCodeEngine } from "./gpt-engineer";

describe("project file extraction", () => {
  it("preserves paths and contents from gpt-engineer style files", () => {
    expect(extractProjectFiles('### `src/main.py`\n```python\nprint("hello")\n```\n\nrequirements.txt\n```text\nflask==3.1.0\n```')).toEqual([
      { path: "src/main.py", content: 'print("hello")\n', language: "python" },
      { path: "requirements.txt", content: "flask==3.1.0\n", language: "text" },
    ]);
  });
  it("excludes incomplete blocks and unnamed examples", () => {
    expect(extractProjectFiles('```python\nprint(1)\n```\nmain.py\n```python\nprint(2)')).toEqual([]);
  });
  it("handles explicit names and keeps the latest duplicate", () => {
    expect(extractProjectFiles('```js file=src/app.js\nold\n```\n```js filename="src/app.js"\nnew\n```')).toEqual([{ path: "src/app.js", content: "new\n", language: "js" }]);
  });
  it("rejects traversal, absolute paths, private environment files and git contents", () => {
    for (const path of ["../a.py", "src/../../a.py", "/tmp/a.py", "C:\\a.py", ".git/config.txt", "node_modules/a.js", ".env", ".env.local"]) expect(safeProjectPath(path)).toBeNull();
    expect(safeProjectPath(".env.example")).toBe(".env.example");
  });
  it("exports real files inside a ZIP", async () => {
    const blob = await projectZip([{ path: "src/app.py", content: "print(42)\n", language: "python" }]);
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(await zip.file("src/app.py")?.async("string")).toBe("print(42)\n");
  });
  it("includes edited sources in refinement context", () => {
    expect(refinementMessage([{ path: "a.py", content: "edited source", language: "python" }], "add tests")).toContain("edited source");
  });
});

describe("code engine routing", () => {
  it("supports an explicit multi-file app even when website keywords are present", () => {
    expect(needsCodeEngine("full-stack website with multiple files", true)).toBe(true);
  });
  it("keeps the single-page website flow unchanged", () => {
    expect(needsCodeEngine("আমার স্কুলের ওয়েবসাইট বানান", true)).toBe(false);
  });
});