import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { withStorageShim } from "@/lib/page-shim";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
const urlT = (u: string) => (u.startsWith("data:image/") ? u : defaultUrlTransform(u));
import remarkGfm from "remark-gfm";
import {
  Mic, MicOff, Send, Plus, Trash2, Volume2, VolumeX, LogOut, Shield, Menu, Square,
  Copy, Check, Search, Printer, Download, Maximize2, Code2, MonitorPlay, ExternalLink,
  ImagePlus, Compass, Paperclip, Bookmark as BookmarkIcon, BookmarkCheck, Share2, Globe,
  Sparkles, Brain, CheckCircle2, Loader2, Moon, Sun, Play, Pencil, Pin, PinOff,
  Archive, ArchiveRestore, RotateCcw, SlidersHorizontal, X, ChevronDown, ChevronRight,
  History, Layers, Terminal, BookOpen, Bell, Key, MoreVertical, Sparkle
} from "lucide-react";

import { CodePreviewDialog } from "@/components/chat/CodePreviewDialog";
import { ProjectWorkspace } from "@/components/chat/ProjectWorkspace";
import { needsCodeEngine } from "@/lib/gpt-engineer";

import { extractDocText, loadBookmarks, saveBookmarks, downloadShareCard, type Bookmark } from "@/lib/extras";
import { ChartBlock } from "@/components/ChartBlock";

const STAGE_CONFIG: Record<string, { label: string; sub: string; icon: string }> = {
  geo: { label: "ভৌগোলিক অবস্থান শনাক্ত হচ্ছে", sub: "স্থানীয় প্রসঙ্গ মেলানো হচ্ছে...", icon: "globe" },
  think: { label: "আপনার প্রশ্ন বিশ্লেষণ করা হচ্ছে", sub: "মূল বিষয়বস্তু ও প্রয়োজনীয়তা যাচাই হচ্ছে...", icon: "brain" },
  search: { label: "অনলাইনে লাইভ তথ্য অনুসন্ধান চলছে", sub: "ইন্টারনেট থেকে সর্বশেষ ডেটা খোঁজা হচ্ছে...", icon: "globe" },
  verify: { label: "উৎস ও প্রামাণ্য দলীলসমূহ যাচাই হচ্ছে", sub: "তথ্য যাচাই করে মূল পয়েন্ট সংকলন হচ্ছে...", icon: "search" },
  code: { label: "সফটওয়্যারের কোড প্রস্তুত হচ্ছে", sub: "রেসপনসিভ ডিজাইন ও আর্কিটেকচার তৈরি হচ্ছে...", icon: "code" },
  image: { label: "ছবি ও কনটেন্ট প্রস্তুত হচ্ছে", sub: "ভিজ্যুয়াল প্রসেসিং চলছে...", icon: "sparkles" },
  fallback: { label: "বিকল্প সংযোগে চেষ্টা চলছে", sub: "নির্ভরযোগ্য উত্তর আনা হচ্ছে...", icon: "sparkles" },
  write: { label: "চূড়ান্ত উত্তর প্রস্তুত ও লেখা হচ্ছে", sub: "সাবলীল ভাষায় পূর্ণাঙ্গ উত্তর সাজানো হচ্ছে...", icon: "sparkles" },
  build: { label: "ওয়েবসাইট লাইভ ডেপ্লয় হচ্ছে", sub: "হোস্টিং সার্ভারে সংযুক্ত হচ্ছে...", icon: "code" },
  test: { label: "লাইভ লিংক পরীক্ষা করা হচ্ছে", sub: "ব্রাউজার প্রিভিউ প্রস্তুত হচ্ছে...", icon: "sparkles" },
  done: { label: "সম্পূর্ণ কাজ সফলভাবে সম্পন্ন হয়েছে", sub: "উত্তর প্রস্তুত!", icon: "check" },
};

const WAIT_HINTS = [
  { label: "প্রশ্নের গভীর বিশ্লেষণ চলছে", sub: "গুরুত্বপূর্ণ বিষয়গুলো চিহ্নিত হচ্ছে..." },
  { label: "প্রয়োজনীয় তথ্য গোছানো হচ্ছে", sub: "উৎসসমূহ যাচাই করা হচ্ছে..." },
  { label: "উত্তরের কাঠামো তৈরি হচ্ছে", sub: "বিশদ ও সাবলীল উপস্থাপনা সাজানো হচ্ছে..." },
  { label: "চূড়ান্ত রূপ দেওয়া হচ্ছে", sub: "একটুখানি অপেক্ষা করুন..." },
];
function WorkflowStepper({ stages, current }: { stages: string[]; current: number }) {
  const finished = current >= stages.length;
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [finished]);

  if (finished) return null;

  const curStageKey = stages[Math.min(current, stages.length - 1)] ?? "think";
  const rawInfo: { label: string; sub: string; icon?: string } | undefined =
    curStageKey === "think" && sec >= 4
      ? WAIT_HINTS[Math.min(Math.floor((sec - 4) / 4), WAIT_HINTS.length - 1)]
      : STAGE_CONFIG[curStageKey];

  const label = rawInfo?.label || "আপনার প্রশ্ন বিশ্লেষণ করা হচ্ছে";
  const cleanLabel = label.replace(/\.+$/, "").trim();

  const bnNum = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

    return (
          <div className="not-prose my-3.5 py-1 pl-1 animate-in fade-in duration-300">
                <div className="inline-block text-base font-semibold live-status-shimmer tracking-normal">
                        {cleanLabel}
                              </div>
                                    <div className="mt-1.5 text-sm text-muted-foreground tabular-nums">
                                            {bnNum(sec)} সেকেন্ড
                                                  </div>
                                                      </div>
                                                        );

}

// উত্তরের শেষে [[প্রশ্ন: ...]] আকারে ফলো-আপ প্রশ্ন থাকে — আলাদা করা
function splitFollowups(t: string): { body: string; followups: string[] } {
  const followups: string[] = [];
  const body = t.replace(/\[\[প্রশ্ন:\s*([^\]]+)\]\]/g, (_m, q) => { followups.push(String(q).trim()); return ""; }).replace(/\n+\s*(পরবর্তী প্রশ্ন|ফলো-আপ)[^\n]*\s*$/m, "").trimEnd();
  return { body, followups: followups.slice(0, 3) };
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// আসল PDF ফাইল (ব্রাউজার প্রিন্ট ছাড়া) — বাংলা ঠিক রাখতে লেখাকে ছবি করে PDF-এ বসানো হয়
async function makePdf(sections: { title?: string; text: string }[], name: string) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:-10000px;top:0;width:760px;padding:32px;background:#ffffff;color:#111111;font-family:'Hind Siliguri',sans-serif;font-size:16px;line-height:1.8";
  box.innerHTML = `<h2 style="margin:0 0 16px;color:#0b6b3a">আল আহসান এআই</h2>` + sections.map((s) => `${s.title ? `<div style="font-weight:700;margin-top:14px">${esc(s.title)}</div>` : ""}<div style="white-space:pre-wrap;word-break:break-word">${esc(s.text)}</div>`).join("");
  document.body.appendChild(box);
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const canvas = await html2canvas(box, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const pagePx = Math.floor((canvas.width * ph) / pw);
    for (let y = 0, p = 0; y < canvas.height; y += pagePx, p++) {
      const part = document.createElement("canvas");
      part.width = canvas.width;
      part.height = Math.min(pagePx, canvas.height - y);
      part.getContext("2d")!.drawImage(canvas, 0, -y);
      if (p) pdf.addPage();
      pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pw, (part.height * pw) / canvas.width);
    }
    saveBlob(pdf.output("blob"), name);
  } catch { alert("PDF তৈরি করা যায়নি, আবার চেষ্টা করুন।"); }
  finally { box.remove(); }
}

async function exportAnswer(content: string, kind: "md" | "doc" | "pdf") {
  if (kind === "pdf") return makePdf([{ text: content }], "al-ahsan-answer.pdf");
  if (kind === "md") return saveBlob(new Blob([content], { type: "text/markdown;charset=utf-8" }), "al-ahsan-answer.md");
  try {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const d = new Document({ sections: [{ children: content.split("\n").map((l) => new Paragraph({ children: [new TextRun({ text: l, font: "Nirmala UI", size: 24 })] })) }] });
    saveBlob(await Packer.toBlob(d), "al-ahsan-answer.docx");
  } catch { alert("Word ফাইল তৈরি করা যায়নি।"); }
}
import { ALL_AVAILABLE_MODELS } from "@/lib/models";
import { Settings as SettingsIcon, Camera, MonitorUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LiveCamera } from "@/components/LiveCamera";
import { useIsAdmin } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "কথোপকথন — আল আহসান এআই" },
      { name: "description", content: "আল আহসান এআই-এর সাথে লিখে বা কথা বলে কথোপকথন করুন।" },
      { property: "og:title", content: "কথোপকথন — আল আহসান এআই" },
      { property: "og:description", content: "শক্তিশালী বাংলা এআই সহকারীর সাথে চ্যাট।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string; image?: string; images?: string[]; error?: boolean };
const MODES = [
  { id: "study", label: "পড়াশোনা", hint: "শিক্ষকের মতো ধাপে ধাপে সহজ ভাষায় বোঝাও, উদাহরণ দাও, শেষে ৩টি ছোট অনুশীলন প্রশ্ন দাও।" },
  { id: "write", label: "লেখালেখি", hint: "দক্ষ লেখক ও সম্পাদকের মতো সুন্দর, সাবলীল, নির্ভুল ভাষায় লেখো; প্রয়োজনে শিরোনাম ও অনুচ্ছেদ সাজাও।" },
  { id: "code", label: "কোডিং", hint: "অভিজ্ঞ প্রোগ্রামারের মতো সম্পূর্ণ, চালানোর উপযোগী কোড দাও, ভাষা উল্লেখ করা কোড ব্লকে, সংক্ষিপ্ত ব্যাখ্যাসহ।" },
  { id: "engineer", label: "ইঞ্জিনিয়ার মোড (গভীর যুক্তি)", hint: "" },
];
type Conv = { id: string; title: string; pinned: boolean; archived: boolean };

// বর্তমান চ্যাটের সাইট-ঠিকানা (আগের ভার্সন একই লিংকে ফিরিয়ে আনার জন্য)
const siteSlugRef = { current: "" };

function HtmlPreview({ code, streaming }: { code: string; streaming?: boolean }) {
  const [tab, setTab] = useState<"run" | "code">("run");
  const [ok, setOk] = useState(false);
  const [restore, setRestore] = useState<"" | "busy" | "done" | "err">("");
  const restoreVersion = async () => {
    if (!siteSlugRef.current) return;
    setRestore("busy");
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` }, body: JSON.stringify({ title: "পুনরুদ্ধার করা ভার্সন", html: code.trim(), slug: siteSlugRef.current }) }).catch(() => null);
    setRestore(r?.ok ? "done" : "err");
    setTimeout(() => setRestore(""), 2500);
  };
  if (streaming) {
    return (
      <div className="not-prose my-3 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-primary"><span className="typing"><i /><i /><i /></span> ওয়েবসাইট তৈরি হচ্ছে… ({code.length} অক্ষর)</div>
        <pre className="h-[200px] overflow-hidden p-3 text-xs text-muted-foreground"><code>{code.slice(-1500)}</code></pre>
      </div>
    );
  }
  const openFull = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
    window.open(url, "_blank");
  };
  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5 text-xs">
        <button onClick={() => setTab("run")} className={`flex items-center gap-1 rounded-md px-2 py-1 ${tab === "run" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}><MonitorPlay size={14} /> চালু করে দেখুন</button>
        <button onClick={() => setTab("code")} className={`flex items-center gap-1 rounded-md px-2 py-1 ${tab === "code" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}><Code2 size={14} /> কোড</button>
        <span className="flex-1" />
        <button onClick={async () => { await navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1500); }} className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-primary">{ok ? <Check size={14} /> : <Copy size={14} />} কপি</button>
        <button onClick={openFull} className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-primary"><Maximize2 size={14} /> বড় করে</button>
        <button onClick={async () => { const JSZip = (await import("jszip")).default; const z = new JSZip(); z.file("index.html", code); z.file("README.txt", "index.html ফাইলটি ব্রাউজারে খুলুন। তৈরি করেছে: আল আহসান এআই"); const b = await z.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "website.zip"; a.click(); }} className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-primary"><Download size={14} /> ZIP</button>
        <button onClick={restoreVersion} disabled={restore === "busy"} className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-primary" title="এই ভার্সনটি লাইভ লিংকে বসান">{restore === "done" ? <><Check size={14} /> লাইভ হয়েছে</> : restore === "err" ? "ব্যর্থ" : restore === "busy" ? <Loader2 size={14} className="animate-spin" /> : <><Globe size={14} /> এই ভার্সন লাইভ করুন</>}</button>
      </div>
      {tab === "run" ? (
        <iframe title="ওয়েবসাইট প্রিভিউ" srcDoc={withStorageShim(code)} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="h-[70vh] min-h-[520px] w-full bg-white sm:h-[80vh] sm:min-h-[650px]" />
      ) : (
        <pre className="max-h-[70vh] min-h-[520px] overflow-auto p-3 text-xs sm:max-h-[80vh] sm:min-h-[650px]"><code>{code}</code></pre>
      )}
    </div>
  );
}

function LiveLinkCard({ href }: { href: string }) {
  const [ok, setOk] = useState(false);
  return (
    <span className="not-prose my-3 flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <span className="break-all text-xs text-muted-foreground">{href}</span>
      <span className="flex flex-wrap gap-2">
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground no-underline"><ExternalLink size={14} /> নতুন ট্যাবে ওয়েবসাইট খুলুন</a>
        <button onClick={async () => { await navigator.clipboard.writeText(href); setOk(true); setTimeout(() => setOk(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">{ok ? <Check size={14} /> : <Copy size={14} />}{ok ? "কপি হয়েছে" : "লিংক কপি করুন"}</button>
      </span>
    </span>
  );
}

const makeMd = (streaming: boolean) => ({
  code({ className, children, ...rest }: any) {
    const text = String(children ?? "");
    if (/language-html/.test(className || "") && /<(html|body|!doctype)/i.test(text)) return <HtmlPreview code={text} streaming={streaming} />;
    if (/language-chart/.test(className || "") && !streaming) return <ChartBlock json={text} />;
    return <code className={className} {...rest}>{children}</code>;
  },
  a({ href, children }: any) {
    const h = String(href ?? "");
    if (typeof window !== "undefined" && h.startsWith(window.location.origin) && /\/(project\d+|p\/)/.test(h)) return <LiveLinkCard href={h} />;
    return <a href={h} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
});
const mdDone = makeMd(false);
const mdStreaming = makeMd(true);

function printChat(msgs: Msg[]) {
  return makePdf(msgs.map((m) => ({ title: m.role === "user" ? "আপনি" : "আল আহসান এআই", text: m.content })), "al-ahsan-chat.pdf");
}

function downloadChat(msgs: Msg[]) {
  const txt = msgs.map((m) => `${m.role === "user" ? "আপনি" : "আল আহসান এআই"}:\n${m.content}`).join("\n\n---\n\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
  a.download = "al-ahsan-chat.txt";
  a.click();
}

function stripEmoji(t: string): string {
  return t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "");
}

// বাংলা ভয়েস না থাকলে হিন্দি/ইংরেজি টানে বিকৃত উচ্চারণ নয় — undefined ফেরত দেয়
function pickVoice(bn: boolean): SpeechSynthesisVoice | undefined {
  const all = window.speechSynthesis.getVoices();
  if (bn) return all.find((x) => /^bn[-_]BD/i.test(x.lang)) || all.find((x) => /^bn/i.test(x.lang));
  return all.find((x) => /^en/i.test(x.lang));
}
const NO_BN_VOICE = "আপনার ডিভাইসে বাংলা ভয়েস প্যাক নেই। ফোনের Settings > Google > Text-to-speech (বা Language & input) থেকে বাংলা ভয়েস ডাউনলোড ও চালু করুন।";

// বাক্যভিত্তিক ছোট টুকরোয় পড়া — লম্বা লেখা একবারে দিলে অনেক ব্রাউজারে ভয়েস থেমে যায়
function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const clean = stripEmoji(text)
    .replace(/```[\s\S]*?(```|$)/g, " কোড অংশ। ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*`_>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  if (!clean) return;
  const parts = clean.match(/[^।.!?\n]+[।.!?]?/g) || [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > 180 && cur) { chunks.push(cur); cur = p; } else cur += p;
  }
  if (cur.trim()) chunks.push(cur);
  const run = () => {
    if (/[\u0980-\u09FF]/.test(clean) && !pickVoice(true)) { alert(NO_BN_VOICE); return; }
    chunks.forEach((c) => {
      const u = new SpeechSynthesisUtterance(c.trim());
      const bn = /[\u0980-\u09FF]/.test(c);
      u.lang = bn ? "bn-BD" : "en-US";
      const v = pickVoice(bn);
      if (v) u.voice = v;
      u.rate = 1;
      synth.speak(u);
    });
  };
  if (synth.getVoices().length) run();
  else {
    let done = false;
    const go = () => { if (!done) { done = true; run(); } };
    synth.addEventListener("voiceschanged", go, { once: true });
    setTimeout(go, 600);
  }
}

function ChatPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const admin = useIsAdmin(user.id);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const copy = async (t: string, i: number) => { await navigator.clipboard.writeText(t); setCopied(i); setTimeout(() => setCopied(null), 1500); };
  const [convs, setConvs] = useState<Conv[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  useEffect(() => { setMode(localStorage.getItem("ahsan-mode") || ""); }, []);
  useEffect(() => { setModel(localStorage.getItem("ahsan-model") ?? ""); }, []);
    const [images, setImages] = useState<string[]>([]);
  const [customSlug, setCustomSlug] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pickImages = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return alert("শুধু ছবি ফাইল পাঠানো যাবে।");
    if (images.length + files.length > 5) {
      alert("সর্বোচ্চ ৫টি ছবি একসাথে পাঠানো যাবে।");
    }
    const remainingSlots = Math.max(0, 5 - images.length);
    const toProcess = files.slice(0, remainingSlots);
    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const im = new Image();
        im.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = Math.round(im.width * scale);
          c.height = Math.round(im.height * scale);
          c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL("image/jpeg", 0.85);
          setImages((prev) => (prev.length < 5 ? [...prev, dataUrl] : prev));
        };
        im.onerror = () => alert("ছবিটি খোলা যায়নি।");
        im.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  };
  const docRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<{ name: string; text: string } | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const pickDoc = async (file: File) => {
    if (file.size > 20_000_000) return alert("ফাইলটি ২০ MB-এর বেশি বড়।");
    setDocBusy(true);
    try {
      const t = (await extractDocText(file)).trim();
      if (!t) alert("ফাইলে পড়ার মতো লেখা পাওয়া যায়নি। স্ক্যান করা পাতা হলে ছবি হিসেবে পাঠান।");
      else setDoc({ name: file.name, text: t });
    } catch (e: any) { alert(e?.message || "ফাইলটি পড়া যায়নি।"); }
    setDocBusy(false);
  };
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  useEffect(() => { setBookmarks(loadBookmarks()); }, []);
  const toggleBookmark = (content: string) => {
    setBookmarks((prev) => {
      const next = prev.some((b) => b.content === content) ? prev.filter((b) => b.content !== content) : [{ id: crypto.randomUUID(), content, at: Date.now() }, ...prev];
      saveBookmarks(next);
      return next;
    });
  };
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<{ stages: string[]; current: number } | null>(null);
  const pushStage = (st: string, finish = false) => setFlow((f) => { const stages = f ? (f.stages.includes(st) ? f.stages : [...f.stages, st]) : [st]; return { stages, current: finish ? stages.length : stages.indexOf(st) }; });
  const [voiceOut, setVoiceOut] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { const d = localStorage.getItem("theme") === "dark"; setDark(d); document.documentElement.classList.toggle("dark", d); }, []);
  const toggleDark = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); localStorage.setItem("theme", d ? "dark" : "light"); };
  useEffect(() => { siteSlugRef.current = customSlug.trim() || (active ? `site-${String(active).slice(0, 8)}` : ""); }, [customSlug, active]);
  const [listening, setListening] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [cfg, setCfg] = useState<{ welcome_title?: string; welcome_subtitle?: string; suggestions?: string }>({});
  const [speaking, setSpeaking] = useState<number | null>(null);
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then(setCfg).catch(() => {}); }, []);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConvs = async () => {
    const { data } = await supabase.from("conversations").select("id,title,pinned,archived").order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    setConvs(data ?? []);
  };
  useEffect(() => {
    loadConvs();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? "auto" : "smooth", block: "end" });
  }, [msgs]);

  const openConv = async (id: string) => {
    setActive(id);
    setSidebar(false);
    const { data } = await supabase.from("messages").select("role,content").eq("conversation_id", id).order("created_at");
    setMsgs((data ?? []) as Msg[]);
  };

  const newChat = () => {
    setActive(null);
    setMsgs([]);
    setSidebar(false);
  };

  const delConv = async (id: string) => {
    if (!confirm("এই কথোপকথনটি মুছে ফেলবেন?")) return;
    await supabase.from("conversations").delete().eq("id", id);
    if (active === id) newChat();
    loadConvs();
  };
  const patchConv = async (id: string, patch: { title?: string; pinned?: boolean; archived?: boolean }) => {
    const { error } = await supabase.from("conversations").update(patch).eq("id", id);
    if (error) alert("পরিবর্তন সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।");
    loadConvs();
  };
  const renameConv = (c: Conv) => {
    const t = prompt("নতুন নাম লিখুন", c.title)?.trim();
    if (t && t !== c.title) patchConv(c.id, { title: t.slice(0, 80) });
  };

  // ক্যামেরা/স্ক্রিন থেকে একটা ফ্রেম তুলে ছবি হিসেবে যুক্ত করা — AI সেটি দেখে উত্তর দেবে
  const captureFrame = async (src: "camera" | "screen") => {
    const md = navigator.mediaDevices as MediaDevices | undefined;
    // ফোনে ব্রাউজার স্ক্রিন শেয়ার দেয় না — তাই স্ক্রিনশট বেছে নেওয়ার ঘর খুলে দেওয়া হয়
    if (src === "screen" && (!md?.getDisplayMedia || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))) {
      alert("ফোনে সরাসরি স্ক্রিন দেখানো যায় না। আগে স্ক্রিনশট নিন, তারপর যে ঘর খুলবে সেখান থেকে স্ক্রিনশটটি বেছে নিন।");
      if (!input.trim()) setInput("আমার স্ক্রিনে কী দেখা যাচ্ছে, বিশ্লেষণ করুন।");
      fileRef.current?.click();
      return;
    }
    if (!md || (src === "camera" && !md.getUserMedia))
      return alert("এই ব্রাউজারে ক্যামেরা চালু করা যাচ্ছে না।");
    let stream: MediaStream | null = null;
    try {
      stream = src === "screen" ? await md.getDisplayMedia({ video: true }) : await md.getUserMedia({ video: { facingMode: "environment" } });
      const v = document.createElement("video");
      v.srcObject = stream; v.muted = true; v.playsInline = true;
      await v.play();
      await new Promise((r) => setTimeout(r, src === "camera" ? 700 : 300));
      const scale = Math.min(1, 1280 / (v.videoWidth || 1280));
      const c = document.createElement("canvas");
      c.width = Math.round((v.videoWidth || 1280) * scale); c.height = Math.round((v.videoHeight || 720) * scale);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.8);
      setImages((prev) => (prev.length < 5 ? [...prev, url] : prev));
      if (!input.trim()) setInput(src === "screen" ? "আমার স্ক্রিনে কী দেখা যাচ্ছে, বিশ্লেষণ করুন।" : "ক্যামেরায় কী দেখা যাচ্ছে, বিশ্লেষণ করুন।");
    } catch {
      alert("অনুমতি দেওয়া হয়নি বা চালু করা যায়নি। ব্রাউজারে ক্যামেরা/স্ক্রিনের অনুমতি দিন।");
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  };

  const toggleMic = () => {
    const KB_HELP = "এই অ্যাপে সরাসরি মাইক চালু করা যাচ্ছে না। সহজ উপায়: লেখার ঘরে চাপ দিন, তারপর কিবোর্ডের মাইক (🎤) বোতাম চেপে বাংলায় বলুন — কিবোর্ড নিজেই লিখে দেবে। (Gboard-এ ভাষা হিসেবে বাংলা যোগ করে নিন।)";
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isWebView = /; wv\)|AppsGeyser|WebView/i.test(navigator.userAgent);
    if (!SR) return alert(KB_HELP);
    if (listening) return recRef.current?.stop();
    let rec: any;
    try { rec = new SR(); } catch { return alert(KB_HELP); }
    rec.lang = "bn-BD";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input;
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput((base ? base + " " : "") + t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      if (e?.error === "service-not-allowed" || (isWebView && e?.error === "not-allowed") || e?.error === "network" || e?.error === "audio-capture") alert(KB_HELP);
      else if (e?.error === "not-allowed") alert("মাইক্রোফোনের অনুমতি দিন: ব্রাউজারের ঠিকানার পাশে 🔒 চিহ্নে চাপ দিয়ে Microphone চালু করুন। না হলে কিবোর্ডের মাইক বোতাম ব্যবহার করুন।");
      else if (e?.error === "no-speech") alert("কোনো কথা শোনা যায়নি, আবার চেষ্টা করুন।");
    };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); alert(KB_HELP); }
  };
    const send = async (override?: string, base?: Msg[], regen = false) => {
    const cur = base ?? msgs;
    const imgs = override !== undefined ? [] : images;
    const d = override !== undefined ? null : doc;
    const typed = override !== undefined ? override.trim() : input.trim() || (imgs.length ? "এই ছবিগুলো বিশ্লেষণ করুন।" : d ? "এই ফাইলটির সারসংক্ষেপ ও বিশ্লেষণ দিন।" : "");
    // Show/store only a short label; the full file text goes to the AI for this message only
    const text = d ? `${typed}\n\n[সংযুক্ত ফাইল: ${d.name}]` : typed;
    const modeHint = MODES.find((x) => x.id === mode)?.hint;
    const baseText = d ? `${typed}\n\n=== সংযুক্ত ফাইল: ${d.name} ===\n${d.text.slice(0, 32000)}` : typed;
    const apiText = modeHint ? `[নির্দেশ: ${modeHint}]\n\n${baseText}` : baseText;
    if (!typed || loading || docBusy) return;
    setInput("");
    setImages([]);
    setDoc(null);
    let convId = active;
    if (!convId) {
      const { data, error } = await supabase.from("conversations").insert({ title: text.slice(0, 60), user_id: user.id }).select("id").single();
      if (error || !data) { setInput(text); alert(`কথোপকথন তৈরি করা যায়নি: ${error?.message ?? ""}`); return; }
      convId = data.id;
      setActive(convId);
    }
    const imgPayload: Partial<Pick<Msg, "images" | "image">> = imgs[0] ? { images: imgs, image: imgs[0] } : {};
    const history: Msg[] = [...cur.filter((m) => !m.error && m.content.trim()), { role: "user", content: text, ...imgPayload }];
    // ভার্সন সিস্টেম: এই চ্যাটে আগের ওয়েবসাইট থাকলে সেটিকেই ভিত্তি ধরে শুধু চাওয়া পরিবর্তন
    const projectRequest = needsCodeEngine(typed, /ওয়েবসাইট|ওয়েব সাইট|website|landing|html|পেজ বানা|অ্যাপ বানা/i.test(typed));
    const siteMsgs = projectRequest ? [] : cur.filter((m) => m.role === "assistant" && /```html/i.test(m.content));
    const prevSite = siteMsgs.length ? [...siteMsgs[siteMsgs.length - 1]!.content.matchAll(/```html\s*\n([\s\S]*?)```/gi)].map((x) => x[1]).join("\n") : "";
    const siteVersion = siteMsgs.length + 1;
    setMsgs([...cur, { role: "user", content: text, ...imgPayload }, { role: "assistant", content: "" }]);
    setFlow({ stages: ["think"], current: 0 });
    setLoading(true);
    if (regen) {
      // Regenerate: the question is already saved; drop the old saved answer instead of duplicating the question
      const { data: last } = await supabase.from("messages").select("id,role").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(1);
      if (last?.[0]?.role === "assistant") await supabase.from("messages").delete().eq("id", last[0].id);
    } else {
      // অপেক্ষা ছাড়াই পেছনে সেভ — উত্তর সঙ্গে সঙ্গে শুরু হয়
      void supabase.from("messages").insert({ conversation_id: convId, role: "user", content: imgs.length ? `[${imgs.length}টি ছবি সংযুক্ত] ${text}` : text, user_id: user.id }).then(({ error }) => { if (error) console.error("save user msg", error.message); });
    }

    let full = "";
    let failed = false;
    let wrote = false;
    const showErr = (msg: string) => { failed = true; setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full ? `${full}\n\n${msg}` : msg, error: true }]); };
    try {
      const { data: s } = await supabase.auth.getSession();
      abortRef.current = new AbortController();
      // টোকেন বাঁচাতে: শুধু শেষ ৮টি বার্তা; পুরোনো বড় বার্তা ছোট করে পাঠানো
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` },
        body: JSON.stringify({
          messages: history.slice(-8).map((m, i, arr) => {
            const last = i === arr.length - 1;
            let content = (last ? (prevSite ? `${apiText}\n\n=== বর্তমান ওয়েবসাইট (ভার্সন ${siteVersion - 1}) ===\nনির্দেশ: ব্যবহারকারী এই সাইটে পরিবর্তন চাইলে শূন্য থেকে নতুন সাইট বানাবে না; নিচের কোডের ওপরই শুধু চাওয়া অংশ বদলে বাকি সব ডিজাইন, লেখা, ছবি, তথ্য হুবহু রেখে সম্পূর্ণ নতুন ভার্সন (ভার্সন ${siteVersion}) একটি পূর্ণ \`\`\`html ব্লকে দেবে। আগের ভার্সনে ফিরতে বললে সেই ভার্সনটি হুবহু দেবে।\n\`\`\`html\n${prevSite.slice(0, 60000)}\n\`\`\`` : apiText) : m.content).replace(/!\[[^\]]*\]\(data:image[^)]+\)/g, "[ছবি]");
            content = last ? content.slice(0, 100000) : content.length > 3000 ? content.slice(0, 2500) + "\n...[সংক্ষেপিত]" : content;
            return last ? { ...m, content } : { role: m.role, content };
          }),
          model: model || "gemini-2.0-flash",
          ...(mode === "engineer" ? { mode } : {}),
          ...(systemPrompt.trim() ? { systemInstruction: systemPrompt.trim() } : {}),
          temperature: temperature,
          thinkingBudget: reasoningLevel === "high" ? 16384 : reasoningLevel === "medium" ? 8192 : 0,
          grounding: toolSearch,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const handle = (raw: string) => {
        const line = raw.trim();
        if (!line.startsWith("data:")) return;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") return;
        try {
          const j = JSON.parse(d);
          if (j.stage) return pushStage(j.stage);
          if (j.error) { showErr(String(j.error)); return; }
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            if (!wrote) { wrote = true; pushStage("write"); }
            full += delta;
            setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
          }
        } catch { /* অসম্পূর্ণ/ভাঙা অংশ বাদ */ }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          handle(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
      }
      buf += dec.decode();
      buf.split("\n").forEach(handle);
    } catch (e: any) {
      if (e?.name !== "AbortError") showErr(`ত্রুটি: ${e?.message || "ত্রুটি হয়েছে"}। আবার চেষ্টা করুন।`);
    }
    setLoading(false);
    // ত্রুটি হলে কিছুই ডাটাবেজে সেভ হবে না — শুধু পর্দায় সতর্কবার্তা
    if (full && !failed) {
      // অসম্পূর্ণ কোড ব্লক বন্ধ করা, যাতে লাইভ লিংক কোডের ভেতরে না পড়ে
      if (!projectRequest && ((full.match(/```/g) || []).length) % 2 === 1) {
        full += "\n```";
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
      }
      // HTML, CSS, JS আলাদা ব্লকে থাকলেও একত্র করে একটি পেজ বানানো
      const grab = (lang: string) => [...full.matchAll(new RegExp("```(?:" + lang + ")\\s*\\n([\\s\\S]*?)```", "gi"))].map((m) => m[1]!).join("\n");
      let htmlCode: string | undefined = grab("html");
      const css = grab("css"), js = grab("javascript|js");
      if (htmlCode || (css && js)) {
        if (!/<html/i.test(htmlCode)) htmlCode = `<!DOCTYPE html>\n<html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n${htmlCode}\n</body></html>`;
        if (css) htmlCode = /<\/head>/i.test(htmlCode) ? htmlCode.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`) : `<style>${css}</style>` + htmlCode;
        if (js) htmlCode = /<\/body>/i.test(htmlCode) ? htmlCode.replace(/<\/body>(?![\s\S]*<\/body>)/i, `<script>\n${js}\n</script>\n</body>`) : htmlCode + `<script>${js}</script>`;
      } else htmlCode = undefined;
      if (!projectRequest && htmlCode && /<html/i.test(htmlCode)) {
        pushStage("build");
        try {
          const { data: s2 } = await supabase.auth.getSession();
                    const pr = await fetch("/api/pages", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${s2.session?.access_token}` },
            body: JSON.stringify({
              title: text.slice(0, 80),
              html: htmlCode.trim(),
              slug: (siteSlugRef.current = customSlug.trim() || `site-${convId.slice(0, 8)}`),
            }),
          });
          if (pr.ok) {
            const { url } = await pr.json();
            const liveUrl = `${window.location.origin}${url}`;
            full += `\n\n---\n\n### লাইভ লিংক তৈরি হয়েছে — ভার্সন ${siteVersion}\n\n[${liveUrl}](${liveUrl})\n\nলিংকে চাপ দিলেই ওয়েবসাইটটি সরাসরি খুলবে। আরও পরিবর্তন চাইলে শুধু লিখুন — একই লিংকে নতুন ভার্সন আপডেট হবে।`;
            setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
            pushStage("test");
            const chk = await fetch(url).catch(() => null);
            if (!chk?.ok) { full += `\n\nসতর্কতা: লাইভ লিংক এখনো সাড়া দিচ্ছে না, কিছুক্ষণ পর আবার খুলুন।`; setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]); }
          } else {
            full += `\n\nলাইভ লিংক তৈরি করা যায়নি (${pr.status})। আবার চেষ্টা করুন।`;
            setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
          }
        } catch { full += "\n\nলাইভ লিংক তৈরির সময় সংযোগ বিচ্ছিন্ন হয়েছে।"; setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]); }
      }
      await supabase.from("messages").insert({ conversation_id: convId, role: "assistant", content: full, user_id: user.id });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      if (voiceOut) speak(full);
      supabase.auth.getSession().then(({ data: s3 }) =>
        fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s3.session?.access_token}` },
          body: JSON.stringify({ action: "extract", user: text.slice(0, 4000), assistant: full.slice(0, 4000) }),
        }).catch(() => {}),
      );
    }
    pushStage("done", true);
    setTimeout(() => setFlow(null), 2500);
    loadConvs();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };


  const [runSettingsOpen, setRunSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"playground" | "history" | "apps" | "gallery">("playground");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [reasoningLevel, setReasoningLevel] = useState("low");
  const [toolStructured, setToolStructured] = useState(false);
  const [toolCode, setToolCode] = useState(true);
  const [toolFn, setToolFn] = useState(false);
  const [toolSearch, setToolSearch] = useState(true);
  const [toolMaps, setToolMaps] = useState(false);
  const [toolUrl, setToolUrl] = useState(true);
  const [temperature, setTemperature] = useState(0.2);
  const [topP, setTopP] = useState(0.95);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [showSystemAccordion, setShowSystemAccordion] = useState(false);

  useEffect(() => {
    setSystemPrompt(localStorage.getItem("ahsan-system-prompt") || "");
    setReasoningLevel(localStorage.getItem("ahsan-reasoning-effort") || "low");
    const savedTemp = localStorage.getItem("ahsan-temperature");
    if (savedTemp) setTemperature(parseFloat(savedTemp) || 0.7);
  }, []);

  const selectedModelObj = ALL_AVAILABLE_MODELS.find((m) => m.id === model);
  return (
    <div className="flex h-dvh w-full max-w-full overflow-hidden bg-background text-foreground">
      {/* 1. Left Sidebar (Google AI Studio Navigation) */}
      <aside
        className={`${
          sidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-border/70 bg-background transition-transform duration-200 ease-in-out md:static`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles size={18} />
            </div>
            <span className="font-sans text-base font-semibold tracking-tight text-foreground">
              Google AI Studio
            </span>
          </div>
          <button
            onClick={() => setSidebar(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary md:hidden"
            aria-label="বন্ধ করুন"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-sm">
          <div>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              EXPLORE
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => { setViewMode("playground"); setSidebar(false); }}
                className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left font-medium transition-colors ${
                  viewMode === "playground" ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Terminal size={17} /> Playground
              </button>
              <button
                onClick={() => { setViewMode("history"); setSidebar(false); }}
                className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left font-medium transition-colors ${
                  viewMode === "history" ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <History size={17} /> History
                {convs.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{convs.length}</span>
                )}
              </button>
            </nav>
          </div>

          <div>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              BUILD
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => { newChat(); setViewMode("playground"); setSidebar(false); }}
                className="flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              >
                <Plus size={17} /> New app
              </button>
              <button
                onClick={() => { setViewMode("apps"); setSidebar(false); }}
                className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left font-medium transition-colors ${
                  viewMode === "apps" ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Layers size={17} /> My apps
              </button>
              <button
                onClick={() => { setViewMode("gallery"); setSidebar(false); }}
                className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left font-medium transition-colors ${
                  viewMode === "gallery" ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Sparkle size={17} /> Gallery
                {bookmarks.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{bookmarks.length}</span>
                )}
              </button>
            </nav>
          </div>

          <div>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              MANAGE
            </div>
            <nav className="space-y-1">
              {admin && (
                <Link
                  to="/admin"
                  className="flex w-full items-center justify-between rounded-full px-3.5 py-2.5 text-left font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                >
                  <span className="flex items-center gap-3"><Shield size={17} /> Dashboard</span>
                  <ChevronRight size={15} />
                </Link>
              )}
              <Link
                to="/salat"
                className="flex w-full items-center justify-between rounded-full px-3.5 py-2.5 text-left font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              >
                <span className="flex items-center gap-3"><BookOpen size={17} /> Documentation</span>
                <ChevronRight size={15} />
              </Link>
            </nav>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/60 p-3 text-xs">
            <div className="mb-1 flex items-center justify-between font-medium text-foreground">
              <span className="flex items-center gap-1.5 text-primary">
                <Globe size={13} /> কাস্টম ইউআরএল
              </span>
              {customSlug && (
                <button type="button" onClick={() => setCustomSlug("")} className="text-[10px] text-destructive hover:underline">
                  মুছুন
                </button>
              )}
            </div>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="যেমন: my-school (ঐচ্ছিক)"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
            {customSlug && <p className="mt-1 truncate text-[10px] text-muted-foreground">লিংক: /{customSlug}</p>}
          </div>
        </div>

        <div className="p-3">
          <div className="rounded-xl border border-border/80 bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">Google AI Studio</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Connected</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              Official Gemini 2.0 Flash, 1.5 Pro & Lite via Google Generative AI API.
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between px-2 text-muted-foreground">
            <button className="rounded-lg p-2 hover:bg-secondary hover:text-foreground" title="Notifications"><Bell size={17} /></button>
            <Link to="/admin" className="rounded-lg p-2 hover:bg-secondary hover:text-foreground" title="Settings"><SettingsIcon size={17} /></Link>
            <button onClick={() => { setViewMode("history"); setSidebar(false); }} className="rounded-lg p-2 hover:bg-secondary hover:text-foreground" title="Search"><Search size={17} /></button>
            <button onClick={() => { setRunSettingsOpen(true); setSidebar(false); }} className="rounded-lg p-2 hover:bg-secondary hover:text-foreground" title="Run settings"><Key size={17} /></button>
          </div>

          <div className="mt-2 flex items-center gap-2.5 rounded-full border border-border/80 bg-card px-3 py-2 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 font-bold text-white uppercase text-xs">
              {user.email ? user.email.charAt(0) : "A"}
            </div>
            <Link to="/profile" className="flex-1 truncate text-foreground hover:underline" title={user.email}>
              {user.email}
            </Link>
            <button onClick={signOut} className="text-muted-foreground hover:text-destructive" title="বের হোন">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {sidebar && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-xs md:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="flex h-14 min-w-0 items-center justify-between border-b border-border/70 bg-background/95 px-3 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebar(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="মেনু"
            >
              <Menu size={20} />
            </button>
            <span className="font-sans text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {viewMode === "history" ? "Conversation History" : viewMode === "apps" ? "My Apps & Websites" : viewMode === "gallery" ? "Saved Gallery" : "Playground"}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={newChat}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="নতুন কথোপকথন (+)"
            >
              <Plus size={19} />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title="অতিরিক্ত অপশন"
                >
                  <MoreVertical size={18} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1 text-xs">
                {msgs.length > 0 && (
                  <>
                    <button onClick={() => printChat(msgs)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-secondary">
                      <Printer size={15} /> প্রিন্ট / PDF ডাউনলোড
                    </button>
                    <button onClick={() => downloadChat(msgs)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-secondary">
                      <Download size={15} /> টেক্সট ফাইল ডাউনলোড
                    </button>
                    <div className="my-1 border-t border-border" />
                  </>
                )}
                <button onClick={toggleDark} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-secondary">
                  {dark ? <Sun size={15} /> : <Moon size={15} />} {dark ? "লাইট মোড" : "ডার্ক মোড"}
                </button>
                <button
                  onClick={() => { setVoiceOut(!voiceOut); window.speechSynthesis?.cancel(); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-secondary"
                >
                  {voiceOut ? <Volume2 size={15} className="text-primary" /> : <VolumeX size={15} />} ভয়েস আউটপুট {voiceOut ? "(চালু)" : "(বন্ধ)"}
                </button>
              </PopoverContent>
            </Popover>

            <button
              onClick={() => setRunSettingsOpen(!runSettingsOpen)}
              className={`rounded-lg p-2 transition-colors ${
                runSettingsOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              title="Run settings"
            >
              <SlidersHorizontal size={19} />
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
          {viewMode === "history" && (
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">সকল কথোপকথন ({convs.length})</h2>
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                >
                  {showArchived ? "← সক্রিয় কথোপকথন" : `আর্কাইভ (${convs.filter((c) => c.archived).length})`}
                </button>
              </div>
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <Search size={16} className="text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="কথোপকথন খুঁজুন…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                {convs.filter((c) => c.archived === showArchived && c.title.toLowerCase().includes(q.toLowerCase())).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 hover:border-primary/50">
                    <button
                      onClick={() => { openConv(c.id); setViewMode("playground"); }}
                      className="flex-1 truncate text-left font-medium text-sm text-foreground hover:text-primary"
                    >
                      {c.pinned && <Pin size={13} className="mr-1.5 inline text-primary" />}
                      {c.title}
                    </button>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <button onClick={() => patchConv(c.id, { pinned: !c.pinned })} title={c.pinned ? "আনপিন" : "পিন"}>
                        {c.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                      </button>
                      <button onClick={() => renameConv(c)} title="নাম পরিবর্তন"><Pencil size={15} /></button>
                      <button onClick={() => patchConv(c.id, { archived: !c.archived })} title={c.archived ? "সক্রিয় করুন" : "আর্কাইভ"}>
                        {c.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                      </button>
                      <button onClick={() => delConv(c.id)} title="মুছুন" className="hover:text-destructive"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "apps" && (
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">আমার তৈরি অ্যাপ ও ওয়েবসাইটসমূহ</h2>
              <p className="text-sm text-muted-foreground mb-6">Playground-এ আপনি যখনই কোনো ওয়েবসাইট বা অ্যাপ তৈরির নির্দেশ দেন, তার লাইভ লিংক তৈরি হয়।</p>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm text-foreground">কাস্টম ইউআরএল তৈরি করুন</span>
                  {customSlug && <span className="text-xs text-primary font-mono">/{customSlug}</span>}
                </div>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="যেমন: my-landing-page"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => { setViewMode("playground"); setInput("আমার জন্য একটি আধুনিক রেসপনসিভ ল্যান্ডিং পেজ তৈরি করে দিন"); }}
                  className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  নতুন অ্যাপ তৈরিতে যান
                </button>
              </div>
            </div>
          )}

          {viewMode === "gallery" && (
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">সংরক্ষিত উত্তর গ্যালারি ({bookmarks.length})</h2>
              {bookmarks.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">এখনো কোনো উত্তর সংরক্ষণ করা হয়নি। চ্যাটের নিচে সংরক্ষণ বাটনে চাপলে এখানে জমা হবে।</div>
              ) : (
                <div className="space-y-3">
                  {bookmarks.map((b) => (
                    <div key={b.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{b.content.replace(/[#*`>]/g, "")}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
                        <button
                          onClick={() => { setActive(null); setMsgs([{ role: "assistant", content: b.content }]); setViewMode("playground"); }}
                          className="text-primary hover:underline"
                        >
                          প্লেগ্রাউন্ডে খুলুন →
                        </button>
                        <button onClick={() => toggleBookmark(b.content)} className="text-destructive hover:underline">
                          মুছে ফেলুন
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === "playground" && (
            <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-36 sm:px-6">
              {msgs.length === 0 && (
                <div className="flex flex-col pt-4 sm:pt-8">
                  {/* Google AI Studio: Collapsible System Instructions */}
              <div className="mb-4 rounded-xl border border-border/80 bg-card/60 transition-all">
                <button
                  type="button"
                  onClick={() => setShowSystemAccordion(!showSystemAccordion)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-primary" />
                    <span className="font-semibold text-foreground">System Instructions</span>
                    {systemPrompt.trim() ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Active ({systemPrompt.length} chars)</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground font-normal">(Optional guidance)</span>
                    )}
                  </div>
                  <ChevronDown
                    size={15}
                    className={`transition-transform duration-200 ${showSystemAccordion ? "rotate-180" : ""}`}
                  />
                </button>
                {showSystemAccordion && (
                  <div className="border-t border-border/60 p-3 space-y-2">
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => {
                        setSystemPrompt(e.target.value);
                        localStorage.setItem("ahsan-system-prompt", e.target.value);
                      }}
                      rows={3}
                      placeholder="Optional tone, role and behavior instructions to guide the model's responses..."
                      className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary resize-none placeholder:text-muted-foreground/60"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Sent with every message to customize how the engine responds.</span>
                      {systemPrompt.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setSystemPrompt("");
                            localStorage.removeItem("ahsan-system-prompt");
                          }}
                          className="text-destructive hover:underline text-[11px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <h1 className="text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                    Start building with {selectedModelObj?.label || (model ? model : "Gemini 2.0 Flash")}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {cfg.welcome_subtitle || "Ultra-low latency, cost-efficient intelligence for high-volume extraction, classification, and instant UI generation."}
                  </p>

                  <div className="mt-6 space-y-2.5">
                    {[
                      "Classify 1,000 support tickets into strict JSON",
                      "Build a zero-dependency command palette",
                      "Normalize messy catalog attributes to NDJSON",
                      ...(cfg.suggestions ? cfg.suggestions.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3) : ["সূরা ফাতিহার তাফসীর সংক্ষেপে বিশ্লেষণ করুন", "আমার বিজনেসের জন্য একটি সুন্দর ওয়েবসাইট বানিয়ে দিন"])
                    ].map((promptText, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInput(promptText)}
                        className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-left text-xs sm:text-sm text-foreground transition-all hover:border-primary/60 hover:bg-card hover:shadow-xs"
                      >
                        <span className="line-clamp-1">{promptText}</span>
                        <ChevronRight size={15} className="shrink-0 text-muted-foreground/60 ml-2" />
                      </button>
                    ))}
                  </div>


                </div>
              )}

              {msgs.map((m, i) => (
                <div key={i} className={`mb-5 flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="mt-0.5 shrink-0 overflow-hidden rounded-full">
                      <Logo size={26} />
                    </div>
                  )}
                  <div className={m.role === "user" ? "max-w-[85%] break-words rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground shadow-xs" : "prose-ai min-w-0 max-w-full flex-1 break-words"}>
                    {m.role === "user" ? (
                      <>
                        {((m.images && m.images.length > 0) ? m.images : m.image ? [m.image] : []).length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {((m.images && m.images.length > 0) ? m.images : [m.image!]).map((src, idx) => (
                              <img key={idx} src={src} alt={`ছবি ${idx + 1}`} className="max-h-40 rounded-lg border border-border object-cover" />
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        {!loading && (
                          <div className="mt-1 flex justify-end gap-3 text-xs text-primary-foreground/80">
                            <button onClick={() => copy(m.content, i)} className="flex items-center gap-1 hover:text-primary-foreground" aria-label="কপি">
                              {copied === i ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                            <button onClick={() => setInput(m.content.replace(/\n\n\[সংযুক্ত ফাইল: [^\]]*\]$/, ""))} className="flex items-center gap-1 hover:text-primary-foreground" aria-label="এডিট">
                              <Pencil size={13} /> এডিট
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {i === msgs.length - 1 && flow && <WorkflowStepper stages={flow.stages} current={flow.current} />}
                        {m.content ? (() => {
                          const { body, followups } = splitFollowups(stripEmoji(m.content));
                          const streamingNow = loading && i === msgs.length - 1;
                          return (
                            <>
                              <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlT} components={streamingNow ? mdStreaming : mdDone}>
                                {body}
                              </ReactMarkdown>
                              {!streamingNow && !m.error && <ProjectWorkspace content={m.content} onRefine={(message) => setInput(message)} />}
                              <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
                                <button onClick={() => copy(body, i)} className="flex items-center gap-1 text-xs hover:text-primary" aria-label="কপি">
                                  {copied === i ? <Check size={15} /> : <Copy size={15} />}{copied === i ? "কপি হয়েছে" : "কপি"}
                                </button>
                                <button
                                  onClick={() => {
                                    if (speaking === i) { window.speechSynthesis?.cancel(); setSpeaking(null); }
                                    else { speak(body); setSpeaking(i); }
                                  }}
                                  className="flex items-center gap-1 text-xs hover:text-primary"
                                  aria-label="শুনুন"
                                >
                                  {speaking === i ? <><Square size={14} /> থামান</> : <><Volume2 size={15} /> শুনুন</>}
                                </button>
                                {!streamingNow && (
                                  <>
                                    {i === msgs.length - 1 && i > 0 && msgs[i - 1]?.role === "user" && !loading && (
                                      <button onClick={() => { const prev = msgs[i - 1]!; send(prev.content, msgs.slice(0, i - 1), true); }} className="flex items-center gap-1 text-xs hover:text-primary" aria-label="আবার লিখুন">
                                        <RotateCcw size={14} /> আবার লিখুন
                                      </button>
                                    )}
                                    <button onClick={() => exportAnswer(body, "pdf")} className="text-xs hover:text-primary">PDF</button>
                                    <button onClick={() => exportAnswer(body, "doc")} className="text-xs hover:text-primary">Word</button>
                                    <button onClick={() => exportAnswer(body, "md")} className="text-xs hover:text-primary">Markdown</button>
                                    <button onClick={() => toggleBookmark(body)} className="flex items-center gap-1 text-xs hover:text-primary">
                                      {bookmarks.some((b) => b.content === body) ? <><BookmarkCheck size={14} /> সংরক্ষিত</> : <><BookmarkIcon size={14} /> সংরক্ষণ</>}
                                    </button>
                                    <button onClick={() => downloadShareCard(body)} className="flex items-center gap-1 text-xs hover:text-primary">
                                      <Share2 size={14} /> শেয়ার কার্ড
                                    </button>
                                  </>
                                )}
                              </div>
                              {!streamingNow && followups.length > 0 && i === msgs.length - 1 && (
                                <div className="not-prose mt-3 flex flex-col gap-2">
                                  {followups.map((f) => (
                                    <button
                                      key={f}
                                      onClick={() => setInput(f)}
                                      className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm hover:border-primary/70 hover:bg-primary/10"
                                    >
                                      {f}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })() : null}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {viewMode === "playground" && (
          <div className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-3 sm:px-6 sm:pb-4 pointer-events-none md:left-72">
            <div className="mx-auto w-full max-w-2xl pointer-events-auto">
              <div className="rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md p-2.5 shadow-lg shadow-black/5 focus-within:border-primary/70">
                {(doc || docBusy || images.length > 0) && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground px-1">
                    {images.map((src, idx) => (
                      <div key={idx} className="relative inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
                        <img src={src} alt={`ছবি ${idx + 1}`} className="h-6 w-6 rounded object-cover" />
                        <span>ছবি {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="ml-1 text-destructive hover:font-bold"
                        >✕</button>
                      </div>
                    ))}
                    {docBusy && <span>ফাইল প্রসেসিং চলছে...</span>}
                    {doc && (
                      <span className="rounded-md border border-border bg-card px-2 py-1">
                        {doc.name} ({doc.text.length} অক্ষর){" "}
                        <button type="button" onClick={() => setDoc(null)} className="ml-1 text-destructive">✕</button>
                      </span>
                    )}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) pickImages(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={docRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.json,.html"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickDoc(f);
                    e.target.value = "";
                  }}
                />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={listening ? "শুনছি…" : "Start typing a prompt"}
                  className="w-full max-h-36 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground/80 leading-relaxed"
                />

                <div className="mt-1 flex items-center justify-between pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Popover open={plusOpen} onOpenChange={setPlusOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="rounded-xl p-2 hover:bg-secondary hover:text-foreground"
                          aria-label="Add attachment"
                          title="Add attachment"
                        >
                          <Plus size={18} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="start" className="w-56 p-1 text-xs">
                        {[
                          { icon: <Camera size={16} />, label: "সরাসরি ক্যামেরা", run: () => setCamOpen(true) },
                          { icon: <ImagePlus size={16} />, label: "ছবি যুক্ত করুন", run: () => fileRef.current?.click() },
                          { icon: <Paperclip size={16} />, label: "PDF / ফাইল", run: () => docRef.current?.click() },
                          { icon: listening ? <MicOff size={16} /> : <Mic size={16} />, label: listening ? "ভয়েস থামান" : "ভয়েসে বলুন", run: toggleMic },
                          { icon: <MonitorUp size={16} />, label: "স্ক্রিন দেখান", run: () => captureFrame("screen") },
                        ].map((o) => (
                          <button
                            key={o.label}
                            onClick={() => { setPlusOpen(false); o.run(); }}
                            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-secondary"
                          >
                            <span className="text-primary">{o.icon}</span>{o.label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    <button
                      onClick={() => setToolSearch(!toolSearch)}
                      className={`rounded-xl p-2 transition-colors ${
                        toolSearch ? "bg-blue-500/10 text-blue-500" : "hover:bg-secondary hover:text-foreground"
                      }`}
                      title={toolSearch ? "Google Search Grounding (চালু)" : "Google Search Grounding (বন্ধ)"}
                    >
                      <Globe size={17} />
                    </button>

                    <button
                      onClick={() => setToolCode(!toolCode)}
                      className={`rounded-xl p-2 transition-colors ${
                        toolCode ? "bg-emerald-500/10 text-emerald-500" : "hover:bg-secondary hover:text-foreground"
                      }`}
                      title={toolCode ? "Code Execution (চালু)" : "Code Execution (বন্ধ)"}
                    >
                      <Code2 size={17} />
                    </button>

                    <button
                      onClick={() => setToolStructured(!toolStructured)}
                      className={`rounded-xl p-2 transition-colors ${
                        toolStructured ? "bg-purple-500/10 text-purple-500" : "hover:bg-secondary hover:text-foreground"
                      }`}
                      title="Structured outputs"
                    >
                      <Layers size={17} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleMic}
                      className={`rounded-xl p-2 transition-colors ${
                        listening ? "animate-pulse bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                      title="Voice input"
                    >
                      <Mic size={18} />
                    </button>

                    {loading ? (
                      <button
                        onClick={() => abortRef.current?.abort()}
                        className="flex items-center gap-1.5 rounded-xl bg-secondary px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80"
                        title="থামান"
                      >
                        <Square size={14} className="fill-current" /> Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => send()}
                        disabled={(!input.trim() && !images.length && !doc) || docBusy}
                        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 hover:opacity-95 shadow-xs"
                        title="Run prompt"
                      >
                        <Play size={13} className="fill-current" /> Run
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <aside
        className={`${
          runSettingsOpen ? "translate-x-0" : "translate-x-full"
        } fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-border/70 bg-background shadow-2xl transition-transform duration-200 ease-in-out sm:w-96`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
          <span className="font-sans text-base font-semibold text-foreground">Run settings</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCodeDialog(true)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Code2 size={14} /> Get code
            </button>
            <button
              onClick={() => { setModel("gemini-2.0-flash"); setReasoningLevel("low"); setSystemPrompt(""); }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Reset settings"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => setRunSettingsOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground">
                {selectedModelObj?.label || (model ? model : "Gemini 2.0 Flash")}
              </span>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Active</span>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              {model || "gemini-2.0-flash"}
            </div>
            <div className="text-muted-foreground text-[11px] leading-relaxed">
              Our fastest, most cost-effective 2.0 model for high-throughput execution.
            </div>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                localStorage.setItem("ahsan-model", e.target.value);
              }}
              className="mt-2 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="">সিস্টেমের নির্বাচিত ডিফল্ট মডেল</option>
              {ALL_AVAILABLE_MODELS.map((m) => <option key={`${m.provider}:${m.id}`} value={m.id}>{m.provider.toUpperCase()} · {m.label}</option>)}
            </select>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2">
            <div className="font-semibold text-xs text-foreground">System instructions</div>
            <div className="text-[11px] text-muted-foreground">
              Optional tone and style instructions for the model
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                localStorage.setItem("ahsan-system-prompt", e.target.value);
              }}
              rows={3}
              placeholder="যেমন: আপনি একজন অভিজ্ঞ সফটওয়্যার ইঞ্জিনিয়ার ও শিক্ষক..."
              className="w-full rounded-xl border border-border bg-background p-2 text-xs outline-none focus:border-primary resize-none placeholder:text-muted-foreground/70"
            />
            <div className="flex flex-wrap gap-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMode(m.id === mode ? "" : m.id);
                    localStorage.setItem("ahsan-mode", m.id === mode ? "" : m.id);
                  }}
                  className={`rounded-lg px-2 py-1 text-[11px] transition-colors ${
                    mode === m.id ? "bg-primary text-primary-foreground font-medium" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2">
            <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-xs text-foreground">Temperature</div>
              <span className="font-mono text-xs font-semibold text-primary">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={temperature}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setTemperature(v);
                localStorage.setItem("ahsan-temperature", String(v));
              }}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Precise (0.0)</span>
              <span>Balanced (0.7)</span>
              <span>Creative (2.0)</span>
            </div>
          </div>

          <div className="font-semibold text-xs text-foreground">Thinking level</div>
            <select
              value={reasoningLevel}
              onChange={(e) => {
                setReasoningLevel(e.target.value);
                localStorage.setItem("ahsan-reasoning-effort", e.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="low">Minimal (দ্রুততম রেসপন্স)</option>
              <option value="medium">Medium (ভারসাম্যপূর্ণ চিন্তা)</option>
              <option value="high">High (গভীর যুক্তি ও বিশ্লেষণ)</option>
            </select>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-3">
            <div className="flex items-center justify-between font-semibold text-xs text-foreground">
              <span>Tools</span>
              <span className="text-[11px] text-muted-foreground font-normal">Active</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-foreground">Structured outputs</span>
                <input type="checkbox" checked={toolStructured} onChange={(e) => setToolStructured(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">Code execution</span>
                <input type="checkbox" checked={toolCode} onChange={(e) => setToolCode(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">Function calling</span>
                <input type="checkbox" checked={toolFn} onChange={(e) => setToolFn(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <Globe size={14} className="text-blue-500" />
                  <span className="font-medium text-foreground">Grounding with Google Search</span>
                </div>
                <input type="checkbox" checked={toolSearch} onChange={(e) => setToolSearch(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">Grounding with Google Maps</span>
                <input type="checkbox" checked={toolMaps} onChange={(e) => setToolMaps(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">URL context</span>
                <input type="checkbox" checked={toolUrl} onChange={(e) => setToolUrl(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              </div>
            </div>
          </div>

          <details className="rounded-2xl border border-border/80 bg-card p-3.5 text-xs group">
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-foreground">
              <span>Advanced settings</span>
              <ChevronDown size={14} className="transition-transform group-open:rotate-180 text-muted-foreground" />
            </summary>
            <div className="mt-3 space-y-3 pt-2 border-t border-border/60">
              <div>
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Temperature</span>
                  <span className="font-mono">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Top P</span>
                  <span className="font-mono">{topP}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </details>
        </div>
      </aside>

      {runSettingsOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-xs md:hidden"
          onClick={() => setRunSettingsOpen(false)}
        />
      )}

      {camOpen && (
        <LiveCamera
          onClose={() => setCamOpen(false)}
          onCapture={(url) => {
            setImages((prev) => (prev.length < 5 ? [...prev, url] : prev));
            if (!input.trim()) setInput("ক্যামেরায় কী দেখা যাচ্ছে, বিশ্লেষণ করুন।");
          }}
        />
      )}

      {showCodeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Code2 size={16} className="text-primary" /> API Request Code
              </span>
              <button onClick={() => setShowCodeDialog(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                <X size={16} />
              </button>
            </div>
            <pre className="mt-4 max-h-60 overflow-x-auto rounded-xl bg-secondary/50 p-3 font-mono text-xs text-foreground">
              <code>{`curl -X POST https://al-ahsanbd.lovable.app/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "আপনার প্রশ্ন"}],
    "model": "${model || "gemini-2.0-flash"}",
    "reasoning_effort": "${reasoningLevel}"
  }'`}</code>
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`curl -X POST https://al-ahsanbd.lovable.app/api/chat -H "Content-Type: application/json" -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "${model || "gemini-2.0-flash"}"}'`);
                  alert("কপি হয়েছে!");
                }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                কপি করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
