import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_MODELS, LOVABLE_MODELS, type Provider } from "@/lib/models";
import { GPT_ENGINEER_PROMPT, needsCodeEngine } from "@/lib/gpt-engineer";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(40000),
        image: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/)
          .max(4_000_000)
          .optional(),
        images: z
          .array(z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/).max(2_500_000))
          .max(5)
          .optional(),
      })
    )
    .min(1)
    .max(60),
  model: z.string().max(80).optional(),
  mode: z.enum(["engineer"]).optional(),
});

const ENGINEER_PROMPT = `## ইঞ্জিনিয়ার মোড (সিনিয়র সফটওয়্যার ইঞ্জিনিয়ারের কাজের ধারা — কঠোরভাবে মানবে)
১. বোঝা: প্রথমে অনুরোধের আসল লক্ষ্য ১–২ লাইনে নিজের ভাষায় লিখবে। অস্পষ্ট বা ঝুঁকিপূর্ণ অনুমান থাকলে তা স্পষ্ট "অনুমান:" হিসেবে লিখবে।
২. পরিকল্পনা: ফাইল-কাঠামো ও ধাপগুলো সংক্ষিপ্ত তালিকায় দেবে; সবচেয়ে সহজ কার্যকর সমাধান বেছে নেবে, অপ্রয়োজনীয় জটিলতা নয়।
৩. বাস্তবায়ন: প্রতিটি ফাইল সম্পূর্ণ কোডসহ আলাদা কোড ব্লকে, ব্লকের আগে আপেক্ষিক ফাইল পাথ। "..." বা "বাকি আগের মতো" লিখবে না। ইনপুট যাচাই ও ত্রুটি-হ্যান্ডলিং রাখবে; গোপন কী কোডে বসাবে না।
৪. নিজে যাচাই: উত্তর পাঠানোর আগে মনে মনে কোডটি পরীক্ষা করবে — ইমপোর্ট, নাম, টাইপ, এজ-কেস, সিনট্যাক্স। ভুল পেলে ঠিক করে তবেই দেবে। "যাচাই:" শিরোনামে কী কী পরীক্ষা করেছ সংক্ষেপে লিখবে।
৫. চালানো ও টেস্ট: ইনস্টল/চালানো/টেস্টের সঠিক কমান্ড দেবে; সম্ভব হলে একটি টেস্ট ফাইল দেবে।
৬. সততা: নিজে চালিয়ে দেখোনি বলে কখনো "পরীক্ষিত/নিশ্চিত কাজ করবে" দাবি করবে না; জানা সীমাবদ্ধতা স্পষ্ট লিখবে। জানা না থাকলে অনুমান করে তথ্য বানাবে না।
৭. বিদ্যমান কোড দিলে শুধু চাওয়া অংশ বদলাবে, বাকি সব অক্ষত রাখবে, এবং কোথায় কী বদলেছে তা উল্লেখ করবে।`;

const PERSONA = `## তোমার ব্যক্তিত্ব ও কঠোর নিয়ম (সবচেয়ে গুরুত্বপূর্ণ)
- তুমি একজন অভিজ্ঞ সিনিয়র ফুল-স্ট্যাক ডেভেলপার, টেকনিক্যাল আর্কিটেক্ট ও শিক্ষক — বিচক্ষণ, ধৈর্যশীল, বিনয়ী ও সুনির্দিষ্ট।
- সালাম নিয়ম (কঠোর): ব্যবহারকারীর সর্বশেষ বার্তায় সরাসরি সালাম থাকলে কেবল তখনই উত্তরের শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্যথায় সরাসরি স্বাভাবিক উত্তর দেবে।
- প্রাসঙ্গিকতা: শুধু প্রশ্নের উত্তর দেবে। ভূমিকা বা অপ্রাসঙ্গিক মন্তব্য লিখবে না।
- নির্ভুলতা: তথ্য বানাবে না। নিশ্চিত না হলে "নিশ্চিত নই" বলবে।
- ওয়েবসাইটের ক্ষেত্রে একক HTML ফাইলে Tailwind CSS CDN দিয়ে পূর্ণ কোড দেবে।
- উত্তরে সস্তা ইমোজি ব্যবহার করবে না।`;

const BASE_PROMPT = `তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি অত্যন্ত শক্তিশালী, জ্ঞানী ও বিনয়ী সহকারী।
- ব্যবহারকারী যে ভাষায় লেখে সেই ভাষায় উত্তর দাও (ডিফল্ট: শুদ্ধ বাংলা)।
- ইসলামি বিষয়ে কুরআন ও সহিহ হাদিসের আলোকে সতর্কতার সাথে উত্তর দাও এবং সূত্র উল্লেখ করো।
- কোডিং, গণিত ও গবেষণায় বিশেষজ্ঞের মতো সমাধান দাও।`;

const INTEGRITY = `\n\n## সততা ও যাচাই প্রোটোকল
- হাদিস/আয়াত নম্বর কেবল নিশ্চিত হলে দেবে; কাল্পনিক সূত্র কঠোরভাবে নিষিদ্ধ।
- বাংলাদেশের প্রেক্ষাপট (টাকা ৳, স্থানীয় আইন, সংস্কৃতি) অগ্রাধিকার পাবে।
- প্রতিটি উত্তরের শেষে ৩টি প্রাসঙ্গিক ফলো-আপ প্রশ্ন দেবে:
[[প্রশ্ন: প্রথম প্রশ্ন]]
[[প্রশ্ন: দ্বিতীয় প্রশ্ন]]
[[প্রশ্ন: তৃতীয় প্রশ্ন]]`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try { return await handleChat(ctx.request); } catch (e) {
          console.error("chat failed", e);
          return new Response("উত্তর তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন।", { status: 503 });
        }
      },
    },
  },
});

let cachedSettings: { data: any; time: number } | null = null;
let cachedKeys: { data: any; time: number } | null = null;

async function getCachedSettingsAndKeys(supabaseAdmin: any) {
  const now = Date.now();
  const needSettings = !cachedSettings || now - cachedSettings.time > 60_000;
  const needKeys = !cachedKeys || now - cachedKeys.time > 60_000;

  const [sRes, kRes] = await Promise.all([
    needSettings ? supabaseAdmin.from("ai_settings").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedSettings!.data }),
    needKeys ? supabaseAdmin.from("ai_keys").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedKeys!.data }),
  ]);

  if (needSettings && sRes.data) cachedSettings = { data: sRes.data, time: now };
  if (needKeys && kRes.data) cachedKeys = { data: kRes.data, time: now };

  return { s: sRes.data ?? cachedSettings?.data, keys: kRes.data ?? cachedKeys?.data };
}

async function handleChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });
  const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: ue } = await pub.auth.getUser(token);
  if (ue || !u.user) return new Response("Unauthorized", { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const uid = u.user.id;
  const lastMsgText = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
  const isQuickCheck = lastMsgText.length < 600 && !/কোড|code|প্রোগ্রাম|ফতোয়া|মাসআলা|অংক|গণিত|ওয়েবসাইট|website/i.test(lastMsgText);

  const memP = (async () => {
    const mem = await import("@/lib/memory.server");
    const [items, rec] = await Promise.all([
      mem.loadMemory(uid, 60),
      isQuickCheck
        ? Promise.resolve({ data: null })
        : supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(15),
    ]);
    return { items, recent: rec.data };
  })().catch(() => ({ items: [] as { text: string }[], recent: null }));

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const [{ s, keys }, { data: isAdmin }, { count: h }, { count: d }] = await Promise.all([
    getCachedSettingsAndKeys(supabaseAdmin),
    supabaseAdmin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", dayAgo),
  ]);

  if (s && s.chat_enabled === false && !isAdmin)
    return new Response("চ্যাট সাময়িকভাবে বন্ধ আছে। একটু পরে আবার চেষ্টা করুন।", { status: 503 });
  if (!isAdmin) {
    if ((h ?? 0) >= (s?.hourly_limit ?? 30))
      return new Response(`এক ঘণ্টায় সর্বোচ্চ ${s?.hourly_limit ?? 30}টি প্রশ্ন করা যায়।`, { status: 429 });
    if ((d ?? 0) >= (s?.daily_limit ?? 150))
      return new Response(`আজকের সীমা (${s?.daily_limit ?? 150}টি প্রশ্ন) শেষ।`, { status: 429 });
  }
  void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});

  const provider = (s?.provider ?? "lovable") as Provider;
  const stored = (s?.model || "").trim();
  
  // পুরোনো অচল মডেল চিহ্নিতকরণ
  const retired = /^gemini-1\.|^gpt-3|^o1-preview|^gemini-pro$/i.test(stored);
  const baseModel = !stored || retired ? (DEFAULT_MODELS[provider] || "gemini-2.5-flash") : stored;

  const isSiteReq = /ওয়েবসাইট|ওয়েব সাইট|website|landing|html/i.test(lastMsgText);
  const picked = provider === "lovable" && parsed.data.model && LOVABLE_MODELS.some((m) => m.id === parsed.data.model) ? parsed.data.model : null;
  const isEngineer = parsed.data.mode === "engineer";
  const isQuick = !isEngineer && !picked && !isSiteReq && lastMsgText.length < 600 && !/কোড|code|প্রোগ্রাম|ফতোয়া|মাসআলা|অংক/i.test(lastMsgText);

  // ১. প্রাথমিক সক্রিয় ফ্রি মডেল নির্ধারণ
  let model = picked ?? (provider === "groq"
    ? (isQuick ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile")
    : provider === "google"
      ? (isQuick ? "gemini-2.5-flash" : "gemini-3.8-flash")
      : (isQuick ? "google/gemini-3-flash-preview" : "google/gemini-2.5-flash"));

  // ২. সক্রিয় এন্ডপয়েন্ট ও এপিআই কি
  let url = "https://ai.gateway.lovable.dev/v1/chat/completions";
  let key = process.env["LOVABLE_API_KEY"];

  const ownGoogle = keys?.google_key?.trim() || process.env["GOOGLE_API_KEY"];
  const ownGroq = keys?.groq_key?.trim() || process.env["GROQ_API_KEY"];

  if (provider === "google") {
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    key = ownGoogle;
    model = stored && !retired ? stored : "gemini-2.5-flash";
  } else if (provider === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    key = ownGroq;
    model = isQuick ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    key = keys?.openai_key?.trim() || process.env["OPENAI_API_KEY"];
  }

  // কী না থাকলে Lovable গেটওয়ে ফলব্যাক
  if (!key && process.env["LOVABLE_API_KEY"]) {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    key = process.env["LOVABLE_API_KEY"];
    model = "google/gemini-3-flash-preview";
  }

  if (!key) return new Response("এই মোডের এপিআই কী অ্যাডমিন প্যানেলে বসান।", { status: 503 });

  let system = PERSONA + "\n\n" + BASE_PROMPT;
  if (isEngineer) system += "\n\n" + ENGINEER_PROMPT;
  if (needsCodeEngine(lastMsgText, isSiteReq)) system += "\n\n" + GPT_ENGINEER_PROMPT;
  system += INTEGRITY;

  const now = new Date();
  const bdDate = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(now);
  system += `\n\n=== বর্তমান সময় ===\nবাংলাদেশ সময়: ${bdDate}।`;

  const body: Record<string, unknown> = {
    model,
    stream: true,
    max_tokens: isQuick ? 4096 : 16384,
    messages: [{ role: "system", content: system }, ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content }))],
  };

  // ৩. সক্রিয় ফ্রি মডেলের স্বয়ংক্রিয় রিট্রাই তালিকা (একটি ফেইল করলে সাথে সাথে অন্যটি চলবে)
  const attempts: { url: string; key: string; model: string; label: string }[] = [
    { url, key, model, label: "primary" }
  ];

  if (url.includes("generativelanguage")) {
    // গুগলের পরীক্ষিত ফ্রি মডেলসমূহ
    const googleFreeModels = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3-flash-preview"];
    for (const m of googleFreeModels) {
      if (m !== model) attempts.push({ url, key, model: m, label: `google-${m}` });
    }
  } else if (url.includes("api.groq.com")) {
    // গ্রকের পরীক্ষিত ফ্রি মডেলসমূহ
    const groqFreeModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
    for (const m of groqFreeModels) {
      if (m !== model) attempts.push({ url, key, model: m, label: `groq-${m}` });
    }
  }

  let res: Response = new Response("no attempt", { status: 500 });
  let realErr: { status: number; text: string } | null = null;

  for (const a of attempts) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), isQuick ? 12000 : 25000);
    res = await fetch(a.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: a.model }),
      signal: ac.signal,
    }).catch((e) => new Response(String(e?.name === "AbortError" ? "timeout" : e), { status: e?.name === "AbortError" ? 504 : 502 }));
    clearTimeout(timer);

    if (res.ok && res.body) break;
    const t = (await res.text()).slice(0, 500);
    realErr = { status: res.status, text: t };
    console.error(`Attempt "${a.label}" (${a.model}) failed [${res.status}]: ${t}`);
  }

  // গেটওয়ে ফলব্যাক (যদি গুগল/গ্রক কী ফেইল করে)
  if ((!res.ok || !res.body) && process.env["LOVABLE_API_KEY"]) {
    const gwModels = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
    for (const gwModel of gwModels) {
      const g = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model: gwModel }),
      }).catch(() => null);
      if (g?.ok && g.body) { res = g; break; }
    }
  }

  if (!res.ok || !res.body) {
    const err = realErr ?? { status: res.status, text: await res.text().catch(() => "") };
    return new Response(friendlyError(err.status, err.text), { status: err.status >= 500 || !err.status ? 502 : err.status });
  }

  return withStages(["think", "write"], res.body);
}

function friendlyError(status: number, text: string): string {
  const t = text.toLowerCase();
  if (status === 401 || status === 403 || /api key|permission|unauthori[sz]ed|invalid.*key/.test(t))
    return "এআই কী গ্রহণ করা হয়নি (কী ভুল বা অনুমতি নেই)। অ্যাডমিন প্যানেলে সঠিক কী দিন।";
  if (status === 404 || /model.*not found/.test(t))
    return "নির্বাচিত এআই মডেলটি সক্রিয় নেই। অনুগ্রহ করে অন্য মডেল নির্বাচন করুন।";
  if (status === 429) return "ফ্রি টিয়ারের সাময়িক লিমিট শেষ। ১ মিনিট পর চেষ্টা করুন।";
  return `উত্তর আনা যায়নি (কোড ${status})। আবার চেষ্টা করুন।`;
}

const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

function withStages(stages: string[], upstream: ReadableStream<Uint8Array>): Response {
  const r = upstream.getReader();
  let closed = false;
  const push = (c: ReadableStreamDefaultController<Uint8Array>, v: Uint8Array) => {
    if (closed) return;
    try { c.enqueue(v); } catch { closed = true; }
  };
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      for (const st of stages) push(c, sse({ stage: st }));
      try {
        while (!closed) {
          const { done, value } = await r.read();
          if (done) break;
          push(c, value);
        }
      } catch {
        push(c, sse({ error: "সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।" }));
      }
      if (!closed) { closed = true; try { c.close(); } catch {} }
    },
    cancel() {
      closed = true;
      r.cancel().catch(() => {});
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}
