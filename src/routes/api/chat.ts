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
  mode: z.string().max(50).optional(),
});

const ENGINEER_PROMPT = `## মেগা ইঞ্জিনিয়ার মোড (সিনিয়র সফটওয়্যার আর্কিটেক্টের কাজের ধারা — কঠোরভাবে মানবে)
১. বোঝা: প্রথমে অনুরোধের আসল লক্ষ্য ২ লাইনে নিজের ভাষায় স্পষ্ট করো। কোনো টেকনিক্যাল অনুমান থাকলে তা "অনুমান:" হিসেবে লিখবে।
২. পরিকল্পনা: মডিউলার ফাইল-কাঠামো ও ধাপগুলো সংক্ষিপ্ত তালিকায় দেবে; অপ্রয়োজনীয় জটিলতা এড়িয়ে সবচেয়ে কার্যকর প্যাটার্ন বেছে নেবে।
৩. পূর্ণাঙ্গ বাস্তবায়ন: একাধিক ফাইলের প্রয়োজন হলে প্রতিটি ফাইল আপেক্ষিক পাথসহ আলাদা কোড ব্লকে সম্পূর্ণ দেবে (যেমন: \`src/components/Navbar.tsx\`)। "// বাকি কোড আগের মতো", "...", বা খালি ফাংশন কঠোরভাবে নিষিদ্ধ। সঠিক টাইপ-সেফটি, ইনপুট যাচাই ও ত্রুটি-হ্যান্ডলিং রাখবে; গোপন কী কোডে কখনো বসাবে না।
৪. গভীর স্ব-যাচাই (Self-Audit): উত্তর পাঠানোর আগে মনে মনে কোডটি পরীক্ষা করো — সিনট্যাক্স, ইমপোর্ট, টাইপ, এজ-কেস ও নিরাপত্তা (XSS, Injection)। "যাচাই:" শিরোনামে কী কী পরীক্ষা করেছ সংক্ষেপে লিখবে।
৫. চালানো ও টেস্ট: ইনস্টল ও টেস্টের সুনির্দিষ্ট কমান্ড দেবে।
৬. শতভাগ সততা: বাস্তবে পরীক্ষা না চালালে কখনো "পরীক্ষিত/নিশ্চিত কাজ করবে" দাবি করবে না; সীমাবদ্ধতা স্পষ্ট লিখবে।`;

const PERSONA = `## তোমার ব্যক্তিত্ব ও মূল নীতি (সর্বোচ্চ অগ্রাধিকার)
- তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি অত্যন্ত শক্তিশালী, ন্যায়পরায়ণ, জ্ঞানী ও দ্রুতগতির এআই সহকারী।
- সালাম নিয়ম (কঠোর): ব্যবহারকারীর সর্বশেষ বার্তায় সরাসরি সালাম (যেমন "আসসালামু আলাইকুম", "সালাম", "Assalamu alaikum") থাকলে কেবল তখনই উত্তরের শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্য সব ক্ষেত্রে নিজে থেকে সালাম দেবে না — সরাসরি স্বাভাবিক উত্তরে চলে যাবে।
- প্রাসঙ্গিকতা ও গতি: তোষামোদ ("দারুণ প্রশ্ন", "নিশ্চয়ই সাহায্য করছি") সম্পূর্ণ নিষিদ্ধ। কোনো ভূমিকা ছাড়া প্রথম বাক্য থেকেই কাজের মূল উত্তর দেবে।
- নির্ভুলতা: কোনো তথ্য বানাবে না। নিশ্চিত না হলে স্পষ্ট বলবে "নিশ্চিত নই"। কোনো সূত্র, লিংক, হাদিস বা আয়াত নম্বর কল্পনা করবে না।
- কখনো রোবটের মতো অজুহাত দেবে না ("আমি এআই তাই পারি না")। বাস্তবসম্মত সমাধান বা কোড দেবে।
- আগের কথোপকথন মনে রেখে প্রসঙ্গ অনুযায়ী উত্তর দেবে; ছোট প্রশ্নে ছোট উত্তর, জটিল কাজে পূর্ণ সমাধান।
- ওয়েবসাইট চাইলে সম্পূর্ণ একক HTML ফাইল (\`\`\`html ব্লকে) দেবে; সিস্টেম হোস্ট করে স্থায়ী লাইভ লিংক তৈরি করবে। কোডের পর শুধু এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।" তৈরি করা HTML সাইটে ডেটা সংরক্ষণের প্রয়োজন হলে localStorage ব্যবহার করবে।`;

const BASE_PROMPT = `## সাধারণ কার্যক্রম ও বিশ্লেষণ
- ব্যবহারকারী যে ভাষায় লেখে সেই ভাষায় উত্তর দাও (ডিফল্ট: শুদ্ধ ও প্রমিত বাংলা)।
- জটিল সমস্যায় ধাপে ধাপে চিন্তা করে যৌক্তিক, সুসংগঠিত ও বিশ্লেষণাত্মক উত্তর দাও। প্রয়োজনে Markdown টেবিল, তালিকা ও কোড ব্লক ব্যবহার করো।
- ইসলামি বিষয়ে কুরআন ও সহিহ হাদিসের আলোকে সতর্কতার সাথে উত্তর দাও এবং নির্ভরযোগ্য সূত্র উল্লেখ করো।
- বাংলাদেশের প্রেক্ষাপট (আইন, সংস্কৃতি, মুদ্রা ৳, স্থানীয় পেমেন্ট মাধ্যম) সর্বদা অগ্রাধিকার পাবে।`;

const SITE_BUILDER_PROMPT = `## ওয়েবসাইট ও অ্যাপ বিল্ডার ইঞ্জিন (প্রোডাকশন-রেডি সিঙ্গেল ফাইল)
ব্যবহারকারী ওয়েবসাইট, ল্যান্ডিং পেজ, পোর্টাল বা অ্যাপ চাইলে নিচের নিয়মগুলো কঠোরভাবে মানবে:
- সম্পূর্ণ ও কার্যকরী কোড: ব্যবহারকারীর প্রয়োজন অনুযায়ী একটি পূর্ণাঙ্গ, আধুনিক ও স্বয়ংসম্পূর্ণ সমাধান দেবে। "// বাকি কোড", "...", বা খালি ফাংশন কঠোরভাবে নিষিদ্ধ।
- একক ফাইলের সম্পূর্ণ HTML: \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত একটিমাত্র \`\`\`html কোড ব্লকে পুরো কোড দেবে।
- আধুনিক ডিজাইন ফ্রেমওয়ার্ক: হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>), FontAwesome 6 আইকন CDN (<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">), এবং Google Fonts (Hind Siliguri ও Inter) যুক্ত করবে।
- ভিজ্যুয়াল মান: বড় স্পষ্ট টাইপোগ্রাফি, আধুনিক কার্ড লেআউট, নরম শ্যাডো, গ্লাস-মরফিজম ইফেক্ট, ডার্ক/লাইট মোড টগল এবং মোবাইল রেসপন্সিভ ড্রয়ার ন্যাভবার রাখবে।
- প্রয়োজনীয় সেকশন: আকর্ষক হিরো, কাউন্টার/পরিসংখ্যান, ফিচার ও সার্ভিস গ্রিড, ক্যাটালগ, টেস্টেবিল টেস্টিমোনিয়াল, FAQ অ্যাকর্ডিয়ন, ইনপুট ভ্যালিডেশন সহ যোগাযোগ ফর্ম ও ফুটার।
- ইন্টারঅ্যাক্টিভ জাভাস্ক্রিপ্ট: পেজের বাটন, মোডাল, ট্যাব ফিল্টার, সার্চ এবং অর্ডার কার্ট (localStorage সহ) সত্যিই কাজ করবে। কোনো অচল ডামি বাটন রাখবে না।
- ছবি: \`https://picsum.photos/seed/<প্রাসঙ্গিক-ইংরেজি-শব্দ>/1200/800\` ব্যবহার করবে।
- কোডের শেষে শুধু লিখবে: "নিচে লাইভ লিংক দেওয়া হলো।"`;

const INTEGRITY = `\n\n## সততা, নিরাপত্তা ও নিয়ন্ত্রণ প্রোটোকল
- হাদিস/আয়াত/কিতাব নম্বর নিশ্চিত হলে দেবে; না হলে বলবে "নির্দিষ্ট নম্বর নিশ্চিত নই, মূল কিতাবে যাচাই করুন"।
- তথ্যের নিশ্চয়তা স্পষ্ট করবে: নিশ্চিত / সম্ভাব্য / অনিশ্চিত।
- কোডে এজ-কেস, মেমোরি লিক, নিরাপত্তা (XSS, Injection) এড়িয়ে চলবে এবং সর্বদা কার্যকর কোড দেবে।
- পাসওয়ার্ড, ব্যাংক তথ্য বা এপিআই গোপন চাবি কখনো চাইবে না বা উত্তরে প্রকাশ করবে না।
- উত্তরে অপ্রয়োজনীয় ইমোজি বা চটুল অলঙ্কার ব্যবহার করবে না; পরিচ্ছন্ন ও পেশাদার প্রাতিষ্ঠানিক উপস্থাপনা দেবে।

## ফলো-আপ প্রশ্ন (বাধ্যতামূলক ৩টি)
প্রতিটি উত্তরের একেবারে শেষে ব্যবহারকারী পরবর্তীতে জিজ্ঞেস করতে পারেন এমন ঠিক ৩টি প্রাসঙ্গিক প্রশ্ন নিচের নির্দিষ্ট ফরম্যাটে আলাদা লাইনে দেবে:
[[প্রশ্ন: প্রথম প্রশ্ন]]
[[প্রশ্ন: দ্বিতীয় প্রশ্ন]]
[[প্রশ্ন: তৃতীয় প্রশ্ন]]`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          return await handleChat(ctx.request);
        } catch (e) {
          console.error("Unhandled Chat Exception:", e);
          return new Response("সার্ভারে সাময়িক সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", { status: 503 });
        }
      },
    },
  },
});

let cachedSettings: { data: any; time: number } | null = null;
let cachedKeys: { data: any; time: number } | null = null;

async function getCachedSettingsAndKeys(supabaseAdmin: any) {
  const now = Date.now();
  const needSettings = !cachedSettings || now - cachedSettings.time > 45_000;
  const needKeys = !cachedKeys || now - cachedKeys.time > 45_000;

  try {
    const [sRes, kRes] = await Promise.all([
      needSettings
        ? supabaseAdmin.from("ai_settings").select("*").eq("id", 1).maybeSingle()
        : Promise.resolve({ data: cachedSettings!.data }),
      needKeys
        ? supabaseAdmin.from("ai_keys").select("*").eq("id", 1).maybeSingle()
        : Promise.resolve({ data: cachedKeys!.data }),
    ]);

    if (needSettings && sRes?.data) cachedSettings = { data: sRes.data, time: now };
    if (needKeys && kRes?.data) cachedKeys = { data: kRes.data, time: now };
  } catch (err) {
    console.error("Error loading cached settings/keys:", err);
  }

  return { s: cachedSettings?.data, keys: cachedKeys?.data };
}

async function handleChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !supabaseKey) {
    return new Response("Supabase configuration is missing", { status: 500 });
  }

  const pub = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [authRes, rawJson] = await Promise.all([
    pub.auth.getUser(token),
    request.json().catch(() => null),
  ]);

  const { data: u, error: ue } = authRes;
  if (ue || !u?.user) return new Response("Unauthorized", { status: 401 });

  const parsed = Body.safeParse(rawJson);
  if (!parsed.success) return new Response("Invalid request payload", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const uid = u.user.id;

  const lastMsgText = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
  const isSiteReq = /ওয়েবসাইট|ওয়েব সাইট|website|landing|html|web page|পেজ বানা|অ্যাপ বানা|স্টোর বানা|বিল্ডার/i.test(lastMsgText);
  const isEngineer = parsed.data.mode === "engineer";
  const isCode = needsCodeEngine(lastMsgText, isSiteReq);
  const isQuick = !isSiteReq && !isEngineer && !isCode && lastMsgText.length < 500 && !/ফতোয়া|মাসআলা|অংক|গণিত|ব্যাখ্যা/i.test(lastMsgText);

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();

  const memTask = (async () => {
    if (isQuick) return { items: [] as { text: string }[], recent: null };
    try {
      const mem = await import("@/lib/memory.server");
      const [items, rec] = await Promise.all([
        mem.loadMemory(uid, 40),
        supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(8),
      ]);
      return { items, recent: rec.data };
    } catch {
      return { items: [] as { text: string }[], recent: null };
    }
  })();

  const fatwaTask = (async () => {
    if (!/ফতোয়া|মাসআলা|রোজা|নামাজ|হাদিস|কুরআন|হারাম|হালাল|যাকাত|কসর|সুদ/i.test(lastMsgText)) return "";
    try {
      const { findFatwas, fatwaPrompt } = await import("@/lib/fatwa.server");
      const fatwas = await findFatwas(lastMsgText);
      return fatwas.length ? fatwaPrompt(fatwas) : "";
    } catch {
      return "";
    }
  })();

  const [settingsAndKeys, adminCheck, hourlyUsage, dailyUsage, memoryData, fatwaContext] = await Promise.all([
    getCachedSettingsAndKeys(supabaseAdmin),
    supabaseAdmin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", dayAgo),
    memTask,
    fatwaTask,
  ]);

  const { s, keys } = settingsAndKeys;
  const isAdmin = !!adminCheck.data;

  if (s && s.chat_enabled === false && !isAdmin) {
    return new Response("চ্যাট সাময়িকভাবে বন্ধ আছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", { status: 503 });
  }

  if (!isAdmin) {
    if ((hourlyUsage.count ?? 0) >= (s?.hourly_limit ?? 60)) {
      return new Response(`এক ঘণ্টার প্রশ্ন সীমা (${s?.hourly_limit ?? 60}টি) শেষ। কিছুক্ষণ পর আবার চেষ্টা করুন।`, { status: 429 });
    }
    if ((dailyUsage.count ?? 0) >= (s?.daily_limit ?? 300)) {
      return new Response(`আজকের দৈনিক ব্যবহারের সীমা (${s?.daily_limit ?? 300}টি) শেষ। আগামীকাল আবার চেষ্টা করুন।`, { status: 429 });
    }
  }

  void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});

  // প্রোভাইডার ও মডেল সিলেকশন
  let provider: Provider = (s?.provider ?? "google") as Provider;
  if (!["google", "openai", "lovable"].includes(provider)) provider = "google";

  const adminGoogleKey = keys?.google_key?.trim() || process.env["GOOGLE_API_KEY"] || "";
  const adminOpenAIKey = keys?.openai_key?.trim() || process.env["OPENAI_API_KEY"] || "";

  let model = parsed.data.model && LOVABLE_MODELS.some((m) => m.id === parsed.data.model)
    ? parsed.data.model
    : (s?.model || "").trim();

  let url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  let key = adminGoogleKey;

  if (isEngineer) {
    // AGENTS.md অনুশাসন: ইঞ্জিনিয়ার মোড সর্বদা অ্যাডমিন গুগল কী এবং কোটায় স্টেপ-ডাউন মডেল ব্যবহার করবে
    provider = "google";
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    key = adminGoogleKey;
    model = "gemini-3.8-flash";
  } else if (provider === "lovable") {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    key = process.env["LOVABLE_API_KEY"] || "";
    if (!model) model = isSiteReq ? "google/gemini-3.8-flash" : DEFAULT_MODELS.lovable;
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    key = adminOpenAIKey;
    if (!model) model = DEFAULT_MODELS.openai || "gpt-4o";
  } else {
    // Google ডিফল্ট মোড
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    key = adminGoogleKey;
    if (!model || /^gemini-1\.|^gemini-2\./i.test(model)) {
      model = isQuick ? "gemini-3.5-flash-lite" : "gemini-3.8-flash";
    }
  }

  // প্রম্পট এসেম্বলি
  let system = PERSONA + "\n\n" + BASE_PROMPT;
  if (isSiteReq) system += "\n\n" + SITE_BUILDER_PROMPT;
  if (isEngineer) system += "\n\n" + ENGINEER_PROMPT;
  if (isCode) system += "\n\n" + GPT_ENGINEER_PROMPT;
  if (fatwaContext) system += fatwaContext;
  if (s?.system_prompt?.trim()) system += `\n\n=== অতিরিক্ত সিস্টেম নির্দেশনা ===\n${s.system_prompt.trim()}`;
  if (s?.admin_note?.trim()) system += `\n\n=== অ্যাডমিন নোট (অগ্রাধিকার) ===\n${s.admin_note.trim()}`;

  const textMsgs = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
  if (s?.url_reader !== false) {
    const last = textMsgs[textMsgs.length - 1];
    if (last && /https?:\/\//.test(String(last.content))) {
      const web = await readUrls(String(last.content));
      if (web) textMsgs[textMsgs.length - 1] = { role: last.role, content: `${last.content}\n\n=== সংযুক্ত ওয়েব পেজের লেখা ===\n${web}` };
    }
  }

  const imgsOf = (i: number) => {
    const m = parsed.data.messages[i];
    return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
  };

  const msgs: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
    const imgs = imgsOf(i);
    if (m.role !== "user" || !imgs.length) return m;
    return {
      role: m.role,
      content: [
        { type: "text", text: m.content || "সংযুক্ত ছবিগুলো বিশদভাবে বিশ্লেষণ করুন।" },
        ...imgs.map((imageUrl) => ({ type: "image_url", image_url: { url: imageUrl } })),
      ],
    };
  });

  if (parsed.data.messages.some((_, i) => imgsOf(i).length)) {
    system += "\n\nব্যবহারকারী ছবি সংযুক্ত করেছেন। ছবিগুলো পুঙ্খানুপুঙ্খভাবে দেখে বিস্তারিত পাঠোদ্ধার (OCR), বিশ্লেষণ ও প্রযোজ্য ক্ষেত্রে ডিজাইনের তথ্য হুবহু গ্রহণ করো।";
  }

  system += INTEGRITY;

  const now = new Date();
  const bdDate = new Intl.DateTimeFormat("bn-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "full",
    timeStyle: "medium",
  }).format(now);
  system += `\n\n=== বর্তমান সময় (সার্ভার ঘড়ি, নির্ভুল) ===\nবাংলাদেশ সময়: ${bdDate} (ISO: ${now.toISOString()})।`;

  if (memoryData.items.length) {
    system += `\n\n=== ব্যবহারকারী সম্পর্কে সংরক্ষিত তথ্য (স্মৃতি) ===\n${memoryData.items.map((m) => "- " + m.text).join("\n")}`;
  }
  if (memoryData.recent?.length) {
    system += `\n\n=== পূর্ববর্তী প্রাসঙ্গিক কথোপকথন ===\n${[...memoryData.recent].reverse().map((r) => "- " + String(r.content).slice(0, 200).replace(/\s+/g, " ")).join("\n")}`;
  }

  if (isAdmin) {
    system += `\n\n[সেশন ভেরিফাইড]: ব্যবহারকারী সিস্টেমের সম্মানিত অ্যাডমিন (${u.user.email})।`;
  }

  const stages: string[] = ["think"];

  // ছবি তৈরি অনুরোধ
  const lastImg = imgsOf(parsed.data.messages.length - 1)[0];
  if (!lastImg && wantsImage(lastMsgText) && process.env["LOVABLE_API_KEY"]) {
    return stageStream(["think", "image"], async () => {
      const img = await generateImage(lastMsgText);
      return img ? `আপনার ছবি তৈরি সম্পন্ন হয়েছে:\n\n![ছবি](${img})` : "ছবি তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।";
    });
  }

  // লাইভ ওয়েব অনুসন্ধান (সর্বোচ্চ ২.৫ সেকেন্ডের রেস-টাইমআউট সহ)
  if (needsSearch(lastMsgText)) {
    stages.push("search");
    const found = await Promise.race([
      webSearch(lastMsgText).catch(() => ""),
      new Promise<string>((r) => setTimeout(() => r(""), 2500)),
    ]);
    if (found) {
      stages.push("verify");
      system += `\n\n=== লাইভ ওয়েব অনুসন্ধানের ফলাফল ===\n${found}\nনির্দেশনা: প্রাপ্ত তথ্যের ভিত্তিতে উত্তর নিশ্চিত করো এবং সূত্রের লিঙ্ক উল্লেখ করো।`;
    }
  }

  if (isSiteReq || isCode || isEngineer) stages.push("code");

  // আউটপুট টোকেন সীমা
  const max_tokens = isSiteReq ? 32768 : isCode || isEngineer ? 16384 : 4096;
  const reasoning_effort = isQuick ? "minimal" : "low";

  const requestBody: Record<string, unknown> = {
    model,
    stream: true,
    max_tokens,
    messages: [{ role: "system", content: system }, ...msgs],
  };

  // Google ও OpenAI উভয়ের জন্য reasoning প্যারামিটার সেফটি
  if (url.includes("generativelanguage") || model.includes("astra") || model.includes("gpt-5")) {
    requestBody["reasoning_effort"] = reasoning_effort;
  }

  // ফেইলওভার ও কি-পুলিং তালিকা তৈরি
  type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
  const pool = (Array.isArray((keys as { key_pool?: unknown })?.key_pool) ? (keys as { key_pool: PoolKey[] }).key_pool : [])
    .filter((p) => p && p.active !== false && p.key?.trim())
    .slice(0, 2); // AGENTS.md অনুশাসন: ব্যাকআপ পুল সর্বোচ্চ ২টি

  const attempts: { url: string; key: string; model: string; label: string; isGoogle: boolean }[] = [];

  if (key) {
    attempts.push({ url, key, model, label: "primary", isGoogle: url.includes("generativelanguage") });
  }

  if (isEngineer) {
    // ইঞ্জিনিয়ার মোডে স্টেপ-ডাউন মডেল (AGENTS.md: pro -> 3.8-flash -> 3-flash-preview)
    if (key) {
      attempts.push({ url, key, model: "gemini-3-flash-preview", label: "engineer-stepdown-1", isGoogle: true });
      attempts.push({ url, key, model: "gemini-3.5-flash-lite", label: "engineer-stepdown-2", isGoogle: true });
    }
  } else {
    // সাধারণ মোডে কি-পুলের অন্যান্য কী দিয়ে ব্যাকআপ
    for (const p of pool) {
      const pKey = p.key!.trim();
      if (pKey === key) continue; // ডুপ্লিকেট কী স্কিপ

      if (p.provider === "custom" && p.base_url?.startsWith("https://")) {
        attempts.push({
          url: p.base_url.replace(/\/$/, "") + "/chat/completions",
          key: pKey,
          model: p.model?.trim() || model,
          label: p.name || "custom-pool",
          isGoogle: false,
        });
      } else if (p.provider === "openai") {
        attempts.push({
          url: "https://api.openai.com/v1/chat/completions",
          key: pKey,
          model: p.model?.trim() || "gpt-4o",
          label: p.name || "openai-pool",
          isGoogle: false,
        });
      } else {
        attempts.push({
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          key: pKey,
          model: p.model?.trim() || model,
          label: p.name || "google-pool",
          isGoogle: true,
        });
      }
    }

    // অল্টারনেট Google মডেল ব্যাকআপ
    if (url.includes("generativelanguage") && key) {
      attempts.push({ url, key, model: "gemini-3-flash-preview", label: "google-flash-fallback", isGoogle: true });
    }

    // চরম ব্যাকআপ: Lovable Gateway
    if (process.env["LOVABLE_API_KEY"]) {
      attempts.push({
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        key: process.env["LOVABLE_API_KEY"],
        model: isSiteReq ? "google/gemini-3.8-flash" : "google/gemini-3-flash-preview",
        label: "lovable-gateway-fallback",
        isGoogle: false,
      });
    }
  }

  let finalResponse: Response | null = null;
  let lastErrorDetail: { status: number; text: string } | null = null;
  const badKeys = new Set<string>();
  const clientAbortController = new AbortController();

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]!;
    if (badKeys.has(attempt.key)) continue;

    const timeoutLimit = isQuick ? 7000 : 22000;
    const attemptAbortController = new AbortController();
    const timer = setTimeout(() => attemptAbortController.abort(), timeoutLimit);

    try {
      const payload = { ...requestBody, model: attempt.model };
      // যদি মডেলটি reasoning সাপোর্ট না করে
      if (!attempt.isGoogle && !attempt.model.includes("astra") && !attempt.model.includes("gpt-5")) {
        delete payload["reasoning_effort"];
      }

      const res = await fetch(attempt.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${attempt.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: attemptAbortController.signal,
      });

      clearTimeout(timer);

      if (res.ok && res.body) {
        finalResponse = res;
        break;
      }

      const errorText = (await res.text().catch(() => "")).slice(0, 350);
      lastErrorDetail = { status: res.status, text: errorText };

      // ত্রুটি বিশ্লেষণ ও হ্যান্ডলিং
      if (res.status === 401 || res.status === 403) {
        badKeys.add(attempt.key);
      } else if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter ? Math.min(2000, Math.max(200, Number(retryAfter) * 1000)) : 300 + Math.random() * 200;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    } catch (fetchErr: any) {
      clearTimeout(timer);
      const isTimeout = fetchErr?.name === "AbortError";
      lastErrorDetail = { status: isTimeout ? 504 : 502, text: isTimeout ? "Timeout" : String(fetchErr) };
    }
  }

  if (!finalResponse || !finalResponse.body) {
    const err = lastErrorDetail ?? { status: 502, text: "All attempts failed" };
    return new Response(friendlyError(err.status, err.text), {
      status: err.status >= 500 || !err.status ? 502 : err.status,
    });
  }

  stages.push("write");
  return withStages(stages, finalResponse.body, clientAbortController);
}

function friendlyError(status: number, text: string): string {
  const t = text.toLowerCase();
  if (status === 429 || /rate.?limit|quota|resource_exhausted/.test(t)) {
    return "এআই প্রোভাইডারের সাময়িক অনুরোধের চাপ (Rate Limit) হয়েছে। অনুগ্রহ করে কয়েক মুহূর্ত অপেক্ষা করে আবার লিখুন।";
  }
  if (status === 401 || status === 403 || /api key|unauthorized|permission/.test(t)) {
    return "এআই এপিআই কী মেয়াদোত্তীর্ণ বা অনুমতি নেই। অ্যাডমিন প্যানেলে সঠিক কী নিশ্চিত করুন।";
  }
  if (status === 404 || /model.*not found|deprecated/.test(t)) {
    return "নির্বাচিত মডেলটি বর্তমানে প্রোভাইডারের কাছে সচল নেই। অন্য মডেল নির্বাচন করুন।";
  }
  if (status === 504 || /timeout/.test(t)) {
    return "এআই প্রোভাইডার সময়মতো সাড়া দেয়নি (Timeout)। আবার অনুরোধ পাঠান।";
  }
  if (status >= 500) {
    return "এআই প্রোভাইডারের সার্ভারে সাময়িক সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।";
  }
  return `উত্তর তৈরি করা যায়নি (কোড: ${status})। অনুগ্রহ করে আবার চেষ্টা করুন।`;
}

function withStages(stages: string[], upstream: ReadableStream<Uint8Array>, upstreamController?: AbortController): Response {
  const enc = new TextEncoder();
  const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  const reader = upstream.getReader();
  let isClosed = false;

  const push = (controller: ReadableStreamDefaultController<Uint8Array>, val: Uint8Array) => {
    if (isClosed) return;
    try {
      controller.enqueue(val);
    } catch {
      isClosed = true;
    }
  };

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const st of stages) push(controller, sse({ stage: st }));
      try {
        while (!isClosed) {
          const { done, value } = await reader.read();
          if (done) break;
          push(controller, value);
        }
      } catch {
        push(controller, sse({ error: "সংযোগ মাঝপথে সাময়িক বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।" }));
      } finally {
        if (!isClosed) {
          isClosed = true;
          try { controller.close(); } catch {}
        }
      }
    },
    cancel() {
      isClosed = true;
      upstreamController?.abort();
      reader.cancel().catch(() => {});
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function stageStream(stages: string[], work: () => Promise<string>): Response {
  const enc = new TextEncoder();
  const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (val: Uint8Array) => {
        try { controller.enqueue(val); return true; } catch { return false; }
      };
      for (const st of stages) push(sse({ stage: st }));
      let text = "";
      try {
        text = await work();
      } catch {
        text = "অনুরোধটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।";
      }
      if (push(sse({ choices: [{ delta: { content: text } }] }))) {
        push(enc.encode("data: [DONE]\n\n"));
      }
      try { controller.close(); } catch {}
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function wantsImage(t: string): boolean {
  return /(ছবি|চিত্র|লোগো|পোস্টার|ব্যানার|image|picture|photo|logo|poster|illustration)/i.test(t)
    && /(বানা|তৈরি|আঁক|এঁকে|জেনারেট|generate|create|draw|make|design)/i.test(t)
    && !/(ওয়েবসাইট|website|html|কোড|code)/i.test(t);
}

async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt: prompt.slice(0, 3000), size: "1024x1024", n: 1 }),
    signal: AbortSignal.timeout(45000),
  }).catch(() => null);

  if (res?.ok) {
    const j: any = await res.json().catch(() => null);
    const d = j?.data?.[0];
    return d?.b64_json ? `data:image/png;base64,${d.b64_json}` : d?.url ?? null;
  }
  return null;
}

function needsSearch(t: string): boolean {
  if (/https?:\/\//.test(t)) return false;
  if (t.trim().length < 8) return false;
  return /(সর্বশেষ|সাম্প্রতিক|আজকের|খবর|সংবাদ|দাম কত|বাজার দর|রেট|আবহাওয়া|ফলাফল|স্কোর|নির্বাচন|latest|news|price|today|weather)/i.test(t);
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().trim().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "metadata.google.internal" ||
    h === "instance-data"
  ) {
    return true;
  }
  if (h === "::1" || h === "::" || h.startsWith("fe80:") || h.startsWith("fc00:") || h.startsWith("fd") || h.startsWith("::ffff:")) {
    return true;
  }
  if (/^\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) return true;

  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b, c, d] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }
  return false;
}

async function safeFetch(url: string, maxRedirects = 3): Promise<Response> {
  let cur = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const u = new URL(cur);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Blocked protocol");
    if (isBlockedHost(u.hostname)) throw new Error("Blocked host");
    if (u.port && !["80", "443", ""].includes(u.port)) throw new Error("Blocked port");

    const res = await fetch(cur, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 (AlAhsanAI Bot)",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      cur = new URL(loc, cur).href;
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

async function readUrls(text: string): Promise<string> {
  const urls = text.match(/https?:\/\/[^\s<>"')]+/g) || [];
  if (!urls.length) return "";
  const out: string[] = [];
  for (const u of urls.slice(0, 2)) {
    try {
      const res = await safeFetch(u);
      if (!res.ok) continue;
      const html = await res.text();
      const clean = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
      if (clean) out.push(`[${u}]\n${clean}`);
    } catch {}
  }
  return out.join("\n\n");
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

async function ddgHtml(q: string): Promise<string> {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "User-Agent": BROWSER_UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(q.slice(0, 200))}&kl=bd-en`,
    signal: AbortSignal.timeout(2500),
  }).catch(() => null);
  return res?.ok ? await res.text() : "";
}

async function newsRss(q: string): Promise<string> {
  const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q.slice(0, 150))}&hl=bn&gl=BD&ceid=BD:bn`, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(2500),
  }).catch(() => null);
  if (!res?.ok) return "";
  const xml = await res.text();
  const items = xml.split("<item>").slice(1, 6).map((it) => {
    const g = (tag: string) => (new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(it)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    return `- ${g("title")} (${g("pubDate")})\n  ${g("link")}`;
  });
  return items.length ? `=== গুগল নিউজ শিরোনাম ===\n${items.join("\n")}` : "";
}

async function webSearch(q: string): Promise<string> {
  const news = /(খবর|সংবাদ|news|আজকে|আজকের|সর্বশেষ)/i.test(q) ? newsRss(q.replace(/(আজকের|আজকে|কী|কি)/g, "").trim() || "বাংলাদেশ") : Promise.resolve("");
  const html = await ddgHtml(q);
  const n = await news;
  if (!html) return n;

  const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  const out: string[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 4) {
    let rawUrl = m[1]!;
    const uddg = /uddg=([^&]+)/.exec(rawUrl);
    if (uddg) rawUrl = decodeURIComponent(uddg[1]!);
    out.push(`- ${strip(m[2]!)}\n  লিংক: ${rawUrl}\n  সারসংক্ষেপ: ${strip(m[3]!)}`);
  }
  return [n, out.join("\n\n")].filter(Boolean).join("\n\n");
}
