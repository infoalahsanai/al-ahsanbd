import { useMemo, useState } from "react";
import { Check, Copy, Download, FolderOpen, Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { extractProjectFiles, projectZip, refinementMessage } from "@/lib/project-files";

export function ProjectWorkspace({ content, onRefine }: { content: string; onRefine: (message: string) => void }) {
  const files = useMemo(() => extractProjectFiles(content), [content]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const active = files.find((file) => file.path === selected) ?? files[0];
  if (!active) return null;
  const current = edits[active.path] ?? active.content;
  const editedFiles = files.map((file) => ({ ...file, content: edits[file.path] ?? file.content }));
  const download = async () => {
    setBusy(true); setError("");
    try {
      const blob = await projectZip(editedFiles);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "al-ahsan-project.zip";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { setError("ZIP তৈরি করা যায়নি; আবার চেষ্টা করুন।"); }
    finally { setBusy(false); }
  };
  const refine = () => {
    const message = refinementMessage(editedFiles, request);
    if (message.length > 38000) { setError("ফাইলগুলো একসঙ্গে পাঠানোর জন্য বড়; ছোট অংশে পরিবর্তন করুন।"); return; }
    setOpen(false); onRefine(message);
  };
  return (
    <div className="not-prose my-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><FolderOpen /> প্রজেক্ট ফাইল ({files.length})</Button>
        <Button variant="ghost" size="sm" onClick={download} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Download />} ZIP</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="flex h-[85dvh] w-[calc(100%-1rem)] max-w-5xl min-w-0 flex-col gap-3 p-4">
          <DialogHeader className="pr-8"><DialogTitle className="flex items-center gap-2"><FolderOpen className="size-5 text-primary" /> প্রজেক্ট ফাইল</DialogTitle></DialogHeader>
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border pb-3">
            <label className="sr-only" htmlFor="project-file">ফাইল নির্বাচন</label>
            <select id="project-file" value={active.path} onChange={(event) => { setSelected(event.target.value); setCopied(false); }} className="min-w-0 flex-1 rounded-md border border-input bg-background p-2 text-sm text-foreground">
              {files.map((file) => <option key={file.path} value={file.path}>{file.path}{edits[file.path] !== undefined ? " •" : ""}</option>)}
            </select>
            <Button variant="ghost" size="icon" title="ফাইল কপি" aria-label="ফাইল কপি" onClick={async () => {
              try { await navigator.clipboard.writeText(current); setCopied(true); }
              catch { setError("কপি করা যায়নি; ফাইলের লেখা নির্বাচন করে কপি করুন।"); }
            }}>{copied ? <Check /> : <Copy />}</Button>
            <Button variant="ghost" size="icon" title="মূল কোড ফেরান" aria-label="মূল কোড ফেরান" disabled={edits[active.path] === undefined} onClick={() => setEdits((old) => { const next = { ...old }; delete next[active.path]; return next; })}><RotateCcw /></Button>
            <Button size="sm" onClick={download} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Download />} ZIP</Button>
          </div>
          <span className="break-all text-xs text-muted-foreground">{active.path}</span>
          <textarea aria-label="ফাইলের কোড" value={current} onChange={(event) => { setEdits((old) => ({ ...old, [active.path]: event.target.value })); setCopied(false); }} spellCheck={false} className="min-h-0 w-full flex-1 resize-none rounded-md border border-input bg-muted p-3 font-mono text-sm leading-6 text-foreground" />
          <div className="flex min-w-0 items-center gap-2">
            <input aria-label="প্রজেক্ট পরিবর্তনের অনুরোধ" value={request} onChange={(event) => setRequest(event.target.value)} placeholder="কী পরিবর্তন চান?" className="min-w-0 flex-1 rounded-md border border-input bg-background p-2 text-sm text-foreground" />
            <Button size="icon" aria-label="পরিবর্তনের অনুরোধ পাঠান" title="পরিবর্তনের অনুরোধ পাঠান" disabled={!request.trim()} onClick={refine}><Send /></Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}