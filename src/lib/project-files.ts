export type ProjectFile = { path: string; content: string; language: string };

/** Only relative source paths may become archive entries. */
export function safeProjectPath(value: string): string | null {
  const path = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.length > 240 || path.startsWith("/") || /[:\x00-\x1f]/.test(path)) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /^(\.git|node_modules)$/i.test(part))) return null;
  const name = parts.at(-1) ?? "";
  if (/^\.env(?:\.|$)/i.test(name) && !/^\.env\.(example|sample|template)$/i.test(name)) return null;
  return /\.[\w-]+$/.test(name) || /^(Dockerfile|Makefile|LICENSE|Procfile)$/i.test(name) ? path : null;
}

/** Read only complete fenced files; partial streaming blocks are never exported. */
export function extractProjectFiles(markdown: string): ProjectFile[] {
  const files = new Map<string, ProjectFile>();
  const fence = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1[ \t]*\r?$/gm;
  for (const match of markdown.matchAll(fence)) {
    const header = (match[2] ?? "").trim();
    const language = header.split(/\s+/)[0] ?? "";
    if (/^(chart|mermaid)$/i.test(language)) continue;
    const explicit = header.match(/(?:file|filename|path)=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i);
    const preceding = markdown.slice(0, match.index).trimEnd().split("\n").at(-1) ?? "";
    const label = preceding.replace(/^\s*(?:#{1,6}\s*|[-*]\s*|\d+[.)]\s*)/, "").replace(/^(?:file|filename|path|ফাইল)\s*:\s*/i, "").replace(/^[`*]+|[`*:]+$/g, "").trim();
    const path = safeProjectPath(explicit?.[1] ?? explicit?.[2] ?? explicit?.[3] ?? label);
    if (!path) continue;
    files.set(path, { path, language, content: match[3] ?? "" });
  }
  return [...files.values()];
}

export async function projectZip(files: ProjectFile[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) {
    const path = safeProjectPath(file.path);
    if (!path) throw new Error("অনিরাপদ ফাইলের নাম পাওয়া গেছে।");
    zip.file(path, file.content);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function refinementMessage(files: ProjectFile[], request: string): string {
  return `এই বিদ্যমান প্রজেক্টে শুধু অনুরোধের পরিবর্তন করুন; অপ্রাসঙ্গিক অংশ অক্ষত রাখুন। পরিবর্তিত প্রতিটি ফাইল সম্পূর্ণ লিখুন, ফাইলের পাথের পর কোড ব্লক দিন। কোনো পরীক্ষা চালানো না হলে যাচাইকৃত বলবেন না।\nঅনুরোধ: ${request.trim()}\n\nবিদ্যমান ফাইলগুলো:\n${files.map((file) => `${file.path}\n\`\`\`\`\`\`\`\`\`\`\`\`${file.language}\n${file.content}\n\`\`\`\`\`\`\`\`\`\`\`\``).join("\n\n")}`;
}