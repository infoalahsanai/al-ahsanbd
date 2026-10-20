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

const ENGINEER_PROMPT = `## মেগা ইঞ্জিনিয়ার মোড (সিনিয়র প্রিন্সিপাল সফটওয়্যার আর্কিটেক্ট — কঠোরভাবে কার্যকর)
১. উদ্দেশ্য ও পরিধি বিশ্লেষণ: অনুরোধের মূল লক্ষ্য ২ লাইনে স্পষ্ট করো। অন্তর্নিহিত টেকনিক্যাল ঝুঁকি বা এজ-কেস স্পষ্ট "অনুমান ও ঝুঁকি:" হিসেবে উল্লেখ করো।
২. সিস্টেম আর্কিটেকচার: মডিউলার ফাইল কাঠামো, স্টেট ম্যানেজমেন্ট, ডেটা ফ্লো এবং নিরাপত্তা মডেল খুব সংক্ষেপে দাও। অপ্রয়োজনীয় ওভার-ইঞ্জিনিয়ারিং এড়িয়ে সেরা স্ট্যান্ডার্ড প্যাটার্ন ধরবে।
৩. পূর্ণাঙ্গ বাস্তবায়ন: প্রতিটি ফাইল সম্পূর্ণ ও কার্যকরী কোডসহ আলাদা ব্লকে দেবে। ব্লকের উপরে আপেক্ষিক ফাইল পাথ (যেমন: components/Navbar.tsx) দেবে। কোডে কোনো প্রকার "// বাকি কোড আগের মতো", "...", "todo" বা ফাঁকা ফাংশন কঠোরভাবে নিষিদ্ধ। ইনপুট স্যানিটাইজেশন, টাইপ-সেফটি ও এরর বাউন্ডারি বাধ্যতামূলক।
৪. গভীর স্ব-যাচাই (Self-Audit): কোড পাঠানোর আগে মনে মনে কম্পাইল ও রান করবে — সিনট্যাক্স, ইমপোর্ট মিসিং, মেমোরি লিক, টাইপ মিসম্যাচ, সিকিউরিটি ভলনারেবিলিটি (XSS, Injection) চেক করো। "যাচাই ও নিশ্চয়তা:" অংশে কী কী পরীক্ষা করেছ তা বুলেট পয়েন্টে লিখবে।
৫. ডিপ্লয়মেন্ট ও টেস্ট গাইড: প্রোডাকশনে চালানোর সঠিক প্যাকেজ ইনস্টল কমান্ড, পরিবেশ ভ্যারিয়েবল এবং একটি কার্যকরী টেস্ট কেস কোড দেবে।
৬. শতভাগ সততা: যা পরীক্ষা করোনি তা সত্য বলে চালাবে না; সম্ভাব্য ফ্রেমওয়ার্ক সীমাবদ্ধতা আগেই পরিষ্কার করে দেবে।`;

const PERSONA = `## তোমার ব্যক্তিত্ব ও মূল নীতি (সর্বোচ্চ অগ্রাধিকার)
- তুমি "আল আহসান এআই" — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি বিশ্বমানের মেগা-শক্তিশালী, অত্যন্ত বিচক্ষণ ও দ্রুতগতির এআই সহকারী।
- সালাম নিয়ম (কঠোর): ব্যবহারকারীর সর্বশেষ বার্তায় সরাসরি সালাম (যেমন "আসসালামু আলাইকুম", "সালাম") থাকলে কেবল তখনই শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্যথায় কোনো সালাম বা অপ্রয়োজনীয় ভূমিকা দেবে না — প্রথম শব্দ থেকেই কাজের উত্তর দেবে।
- প্রাসঙ্গিকতা ও গতি: তোষামোদ ("দারুণ প্রশ্ন করেছেন", "নিশ্চয়ই সাহায্য করছি") সম্পূর্ণ বর্জনীয়। সরাসরি মূল তথ্যে চলে যাবে।
- নির্ভুলতা ও রেফারেন্স: তথ্য নিজে বানিয়ে বলবে না। হাদিস, কোরআন, বিজ্ঞান বা আইনের ক্ষেত্রে শতভাগ নিশ্চিত না হলে স্পষ্ট বলবে "নির্দিষ্ট রেফারেন্স নিশ্চিত নই"। কোনো কাল্পনিক সংখ্যা বা লিংক বানাবে না।
- কখনো রোবটের অজুহাত দেবে না ("আমি এআই তাই পারি না")। বাস্তবসম্মত বিকল্প বা কোড তৈরি করে দেবে।
- ওয়েবসাইট চাইলে সম্পূর্ণ একক HTML ফাইল (\`\`\`html ব্লকে) দেবে; সিস্টেম স্বয়ংক্রিয়ভাবে লাইভ লিংক তৈরি করবে। কোডের পর শুধু এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।"`;

const BASE_PROMPT = `## সাধারণ কার্যক্রম ও বিশ্লেষণ
- ব্যবহারকারীর ভাষায় উত্তর দেবে (ডিফল্ট: প্রাতিষ্ঠানিক প্রমিত বাংলা)।
- জটিল সমস্যাকে ধাপে ধাপে ভেঙে যৌক্তিক, সুসংগঠিত ও গভীর বিশ্লেষণ সহ সমাধান দাও। প্রয়োজনে Markdown টেবিল ও তালিকা ব্যবহার করো।
- ইসলামি বিষয়ে কোরআন ও সহিহ হাদিসের আলোকে সতর্কতার সাথে উত্তর দেবে।
- বাংলাদেশ প্রেক্ষাপট (আইন, সংস্কৃতি, মুদ্রা ৳, পেমেন্ট মাধ্যম) সর্বদা অগ্রাধিকার পাবে।`;

// Lovable ও Apple-মানের শক্তিশালী ওয়েব বিল্ডার প্রম্পট
const SITE_BUILDER_PROMPT = `## মেগা ওয়েবসাইট ও অ্যাপ বিল্ডার ইঞ্জিন (Lovable ও Stripe প্রোডাকশন গ্রেড)
ব্যবহারকারী যেকোনো ওয়েবসাইট, ল্যান্ডিং পেজ, ফর্ম, পোর্টাল বা অ্যাপ চাইলে নিচের নিয়মগুলো ১০০% মানবে:
১. গভীরতা ও কোডের পরিমাণ: কোড হতে হবে অন্তত ১,২০,০০০ অক্ষরের সমৃদ্ধ ও পূর্ণাঙ্গ। কখনো সংক্ষিপ্ত বা সাদামাটা নয়।
২. ন্যূনতম ২০-২৪টি পূর্ণাঙ্গ সেকশন: 
   - আধুনিক হিরো সেকশন (অ্যানিমেটেড ব্যাজ, আকর্ষক হেডলাইন, সাবটাইটেল, ডুয়াল CTA বাটন, স্ট্যাটাস ব্যাজ)
   - ব্র্যান্ড ট্রাস্ট লোগো ক্লাউড / পার্টনার্স
   - ইন্টারঅ্যাক্টিভ লাইভ পরিসংখ্যান কাউন্টার (IntersectionObserver দিয়ে স্ক্রলে অ্যানিমেট হবে)
   - মূল ফিচার গ্রিড (আইকন, গ্রেডিয়েন্ট গ্লাস কার্ড, হোভার লিফট ইফেক্ট)
   - বিস্তারিত সার্ভিস/পণ্য ক্যাটালগ (ট্যাব ফিল্টারিং, সার্চ বার, ক্যাটাগরি পিলস)
   - সম্পূর্ণ কার্যকরী ই-কমার্স কার্ট (Add to cart, কোয়ান্টিটি বাড়ানো/কমানো, রিয়েল-টাইম মোট ৳ হিসাব, localStorage-এ ডেটা সেভ)
   - বিকাশ/নগদ/রকেট চেকআউট সিমুলেটর মডাল (TrxID ও নম্বর ভ্যালিডেশন সহ সফল অর্ডার কনফার্মেশন পপআপ)
   - গ্রাহক পর্যালোচনা / টেস্টিমোনিয়াল গ্রিড (স্টার রেটিং সহ)
   - ইন্টারঅ্যাক্টিভ প্রাইসিং টেবিল (মাসিক/বার্ষিক টগল সহ)
   - সম্পূর্ণ কার্যকরী FAQ অ্যাকর্ডিয়ন (ক্লিক করলে স্মুথ ওপেন/ক্লোজ)
   - ভ্যালিডেশন সহ যোগাযোগ ফর্ম (নাম, ইমেইল, মোবাইল ভ্যালিডেশন ও সাফল্য নোটিফিকেশন)
   - প্রফেশনাল মেগা ফুটার (কুইক লিংক, সোশ্যাল আইকন, কপিরাইট, নিউজলেটার সাবস্ক্রিপশন ফর্ম)
৩. ডিজাইন ও স্টাইলিং মান:
   - \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত একটিমাত্র \`\`\`html কোড ব্লকে সম্পূর্ণ কোড দেবে।
   - হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>) এবং Google Fonts (<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">) যুক্ত করবে।
   - মডার্ন গ্লাস-মরফিজম (backdrop-blur-md, bg-white/80, border-white/20, shadow-xl)।
   - ডার্ক ও লাইট মোড টগল সম্পূর্ণ জাভাস্ক্রিপ্টসহ কার্যকর রাখবে।
   - মোবাইল ড্রয়ার ন্যাভবার (হ্যামবার্গার আইকন ক্লিক করলে সাইড থেকে স্মুথলি খুলবে ও বন্ধ হবে)।
৪. জাভাস্ক্রিপ্ট কার্যকারিতা:
   - পেজে কোনো ডামি লিংক বা অকেজো বাটন থাকবে না। প্রতিটি বাটন, মোডাল, ট্যাব, কাউন্টার ও ফর্ম শতভাগ কাজ করবে।
   - পেজ রিলোড দিলেও যেন কার্টের পণ্য বা ফর্মের ডেটা মুছে না যায় সেজন্য localStorage ব্যবহার করবে।
৫. ছবি: ছবি হিসেবে \`https://picsum.photos/seed/<প্রাসঙ্গিক-ইংরেজি-শব্দ>/1200/800\` ব্যবহার করবে।
৬. কোডের সমাপ্তি: কোড ব্লকের ঠিক পরে কেবল এক লাইনে লিখবে: "নিচে লাইভ লিংক দেওয়া হলো।"`;

const INTEGRITY = `\n\n## সততা, সাইবার নিরাপত্তা ও কোয়ালিটি কন্ট্রোল
- কোডে কোনো দুর্বলতা (XSS, SQLi, হার্ডকোডেড গোপন কী) রাখা যাবে না।
- দীর্ঘ কোড লেখার সময় কখনো মাঝপথে থেমে যাবে না; সব HTML ট্যাগ ও JS ফাংশন সঠিকভাবে ক্লোজ করবে।
- উত্তরে সস্তা ইমোজি ব্যবহার করবে না; অত্যন্ত পরিচ্ছন্ন, কর্পোরেট ও প্রফেশনাল প্রেজেন্টেশন দেবে।

## পরবর্তী সম্ভাব্য প্রশ্ন (বাধ্যতামূলক ৩টি)
উত্তরের একেবারে শেষে ব্যবহারকারীর কাজের সাথে সম্পর্কিত ঠিক ৩টি প্রশ্ন নিচের নির্দিষ্ট ফরম্যাটে আলাদা লাইনে দেবে:
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
          console.error("Critical Chat Handler Error:", e);
          return new Response("সিস্টেমে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।", { status: 503 });
        }
      },
    },
  },
});

// ৬০ সেকেন্ডের মেমোরি ক্যাশ (ডাটাবেস প্রেসার কমিয়ে দ্রুত রেসপন্স করার জন্য)
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

  // সমান্তরালে রিকোয়েস্ট পার্স এবং অথেনটিকেশন
  const [authRes, rawJson] = await Promise.all([
    pub.auth.getUser(token),
    request.json().catch(() => null),
  ]);

  const { data: u, error: ue } = authRes;
  if (ue || !u.user) return new Response("Unauthorized", { status: 401 });

  const parsed = Body.safeParse(rawJson);
  if (!parsed.success) return new Response("Invalid request payload", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const uid = u.user.id;

  const lastMsgText = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
  const isSiteReq = /ওয়েবসাইট|ওয়েব সাইট|website|landing|html|web page|পেজ বানা|অ্যাপ বানা|স্টোর বানা|বিল্ডার/i.test(lastMsgText);
  const isEngineer = parsed.data.mode === "engineer";
  const isQuick = !isSiteReq && !isEngineer && lastMsgText.length < 500 && !/কোড|code|প্রোগ্রাম|অংক|গণিত|ফতোয়া/i.test(lastMsgText);

  // সর্বোচ্চ দ্রুততার জন্য সব ডেটা ও লিমিট চেক ১০০% সমান্তরালে (Parallel)
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();

  const memTask = (async () => {
    if (isQuick) return { items: [] as { text: string }[], recent: null };
    try {
      const mem = await import("@/lib/memory.server");
      const [items, rec] = await Promise.all([
        mem.loadMemory(uid, 60),
        supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(10),
      ]);
      return { items, recent: rec.data };
    } catch {
      return { items: [] as { text: string }[], recent: null };
    }
  })();

  const [settingsAndKeys, adminCheck, hourlyUsage, dailyUsage, memoryData] = await Promise.all([
    getCachedSettingsAndKeys(supabaseAdmin),
    supabaseAdmin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", dayAgo),
    memTask,
  ]);

  const { s, keys } = settingsAndKeys;
  const isAdmin = !!adminCheck.data;

  if (s && s.chat_enabled === false && !isAdmin)
    return new Response("সিস্টেমে রক্ষণাবেক্ষণ চলছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", { status: 503 });

  if (!isAdmin) {
    if ((hourlyUsage.count ?? 0) >= (s?.hourly_limit ?? 60))
      return new Response(`এক ঘণ্টার প্রশ্ন সীমা শেষ। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।`, { status: 429 });
    if ((dailyUsage.count ?? 0) >= (s?.daily_limit ?? 300))
      return new Response(`আজকের দৈনিক ব্যবহারের সীমা শেষ। আগামীকাল আবার চেষ্টা করুন।`, { status: 429 });
  }

  void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});

  const provider = (s?.provider ?? "google") as Provider;

  // শক্তিশালী মডেল রাউটিং: কোড ও ওয়েবে gemini-3.8-flash, দ্রুত চ্যাটে gemini-3.5-flash-lite
  let model = isSiteReq || isEngineer 
    ? "gemini-3.8-flash" 
    : isQuick 
    ? "gemini-3.5-flash-lite" 
    : "gemini-3.8-flash";

  let url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  let key = keys?.google_key?.trim() || process.env["GOOGLE_API_KEY"];

  if (provider === "lovable") {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    key = process.env["LOVABLE_API_KEY"];
    model = isSiteReq ? "google/gemini-3.8-flash" : "google/gemini-3-flash-preview";
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    key = keys?.openai_key?.trim() || process.env["OPENAI_API_KEY"];
    model = "gpt-4o";
  }

  // প্রম্পট এসেম্বলি (ডাইনামিক ও টোকেন-সেভার)
  let system = PERSONA + "\n\n" + BASE_PROMPT;
  if (isSiteReq) system += "\n\n" + SITE_BUILDER_PROMPT;
  if (isEngineer) system += "\n\n" + ENGINEER_PROMPT;
  if (needsCodeEngine(lastMsgText, isSiteReq)) system += "\n\n" + GPT_ENGINEER_PROMPT;
  if (s?.system_prompt?.trim()) system += `\n\n=== অ্যাডমিন সিস্টেম নির্দেশনা ===\n${s.system_prompt.trim()}`;

  const textMsgs = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
  if (s?.url_reader !== false) {
    const last = textMsgs[textMsgs.length - 1];
    if (last && /https?:\/\//.test(String(last.content))) {
      const web = await readUrls(String(last.content));
      if (web) textMsgs[textMsgs.length - 1] = { role: last.role, content: `${last.content}\n\n=== সংযুক্ত ওয়েব কনটেন্ট ===\n${web}` };
    }
  }

  const imgsOf = (i: number) => {
    const m = parsed.data.messages[i];
    return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
  };

  const msgs: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
    const imgs = imgsOf(i);
    if (m.role !== "user" || !imgs.length) return m;
    return { role: m.role, content: [{ type: "text", text: m.content || "বিশ্লেষণ করুন।" }, ...imgs.map((url) => ({ type: "image_url", image_url: { url } }))] };
  });

  if (parsed.data.messages.some((_, i) => imgsOf(i).length)) {
    system += "\n\nব্যবহারকারী ছবি সংযুক্ত করেছেন। ছবি নিখুঁতভাবে পর্যবেক্ষণ করে বিস্তারিত পাঠোদ্ধার (OCR) ও বিবরণ দাও।";
  }

  system += INTEGRITY;

  // নির্ভুল সময় ও সার্ভার ক্লক
  const now = new Date();
  const bdDate = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "full", timeStyle: "medium" }).format(now);
  system += `\n\nবর্তমান বাংলাদেশ সময়: ${bdDate}।`;

  if (memoryData.items.length) {
    system += `\n\n=== সংরক্ষিত দীর্ঘমেয়াদী স্মৃতি ===\n${memoryData.items.map((m) => "- " + m.text).join("\n")}`;
  }

  if (isAdmin) {
    system += `\n\n[সেশন ভেরিফাইড]: ব্যবহারকারী সিস্টেমের সম্মানিত অ্যাডমিন (${u.user.email})।`;
  }

  const stages: string[] = ["think"];

  // ছবি তৈরির অনুরোধ হ্যান্ডলিং
  const lastImg = imgsOf(parsed.data.messages.length - 1)[0];
  if (!lastImg && wantsImage(lastMsgText) && process.env["LOVABLE_API_KEY"]) {
    return stageStream(["think", "image"], async () => {
      const img = await generateImage(lastMsgText);
      return img ? `আপনার ছবি তৈরি সম্পন্ন হয়েছে:\n\n![তৈরি করা ছবি](${img})` : "ছবি তৈরি করতে সাময়িক বিঘ্ন ঘটেছে। আবার চেষ্টা করুন।";
    });
  }

  // লাইভ ওয়েব অনুসন্ধান (সর্বোচ্চ ৩ সেকেন্ডের রেস-টাইমআউট সহ)
  if (needsSearch(lastMsgText)) {
    stages.push("search");
    const found = await Promise.race([
      webSearch(lastMsgText).catch(() => ""),
      new Promise<string>((r) => setTimeout(() => r(""), 3000)),
    ]);
    if (found) {
      stages.push("verify");
      system += `\n\n=== লাইভ ওয়েব অনুসন্ধানের তথ্য ===\n${found}\nনির্দেশ: এই তথ্যের ভিত্তিতে উত্তর নিশ্চিত করো।`;
    }
  }

  if (isSiteReq || isEngineer) stages.push("code");

  // ম্যাক্স টোকেন: ওয়েব বিল্ডারে ৬৫,৫৩৬ টোকেন, সাধারণ প্রশ্নে ৪,০৯৬ টোকেন
  const max_tokens = isSiteReq ? 65536 : isQuick ? 4096 : 8192;

  const body: Record<string, unknown> = {
    model,
    stream: true,
    max_tokens,
    messages: [{ role: "system", content: system }, ...msgs],
  };

  // মেগা ফেইলওভার ও কি-পুলিং আর্কিটেকচার (কখনোই যাতে রিকোয়েস্ট ফেইল না করে)
  type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
  const pool = (Array.isArray((keys as { key_pool?: unknown })?.key_pool) ? (keys as { key_pool: PoolKey[] }).key_pool : [])
    .filter((p) => p && p.active !== false && p.key?.trim());

  const attempts: { url: string; key: string; model: string; label: string }[] = [];

  // ১. প্রাইমারি কী দিয়ে চেষ্টা
  if (key) attempts.push({ url, key, model, label: "primary" });

  // ২. পুলের সব অ্যাক্টিভ গুগল কী দিয়ে ব্যাকআপ
  for (const p of pool) {
    if ((p.provider === "google" || !p.provider) && p.key!.trim() !== key) {
      attempts.push({
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key: p.key!.trim(),
        model,
        label: p.name || "pool-google",
      });
    }
  }

  // ৩. অল্টারনেট মডেল ফলব্যাক (যদি ৩.৮ ওভারলোডেড থাকে)
  if (url.includes("generativelanguage") && key) {
    attempts.push({ url, key, model: "gemini-3-flash-preview", label: "fallback-flash-preview" });
  }

  // ৪. চরম ব্যাকআপ: Lovable Gateway
  if (process.env["LOVABLE_API_KEY"]) {
    attempts.push({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: process.env["LOVABLE_API_KEY"],
      model: isSiteReq ? "google/gemini-3.8-flash" : "google/gemini-3-flash-preview",
      label: "gateway-backup",
    });
  }

  let res: Response = new Response("no attempt", { status: 500 });
  let realErr: { status: number; text: string } | null = null;

  for (const a of attempts) {
    const ac = new AbortController();
    // দ্রুত রেসপন্সের জন্য কানেকশন টাইমআউট: সাধারণ চ্যাটে ৮ সে., ওয়েব তৈরিতে ২০ সে.
    const timer = setTimeout(() => ac.abort(), isQuick ? 8000 : 20000);

    res = await fetch(a.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: a.model }),
      signal: ac.signal,
    }).catch((e) => new Response(String(e?.name === "AbortError" ? "timeout" : e), { status: e?.name === "AbortError" ? 504 : 502 }));

    clearTimeout(timer);

    if (res.ok && res.body) break;

    const t = (await res.text()).slice(0, 400);
    realErr = { status: res.status, text: t };
    console.warn(`[Failover] Key "${a.label}" encountered ${res.status}. Instantly switching to next route...`);
  }

  if (!res.ok || !res.body) {
    const err = realErr ?? { status: res.status, text: await res.text().catch(() => "") };
    return new Response(friendlyError(err.status, err.text), { status: err.status >= 500 || !err.status ? 502 : err.status });
  }

  stages.push("write");
  return withStages(stages, res.body);
}

function friendlyError(status: number, text: string): string {
  const t = text.toLowerCase();
  if (status === 429 || /rate.?limit|too many requests|resource_exhausted|quota/.test(t))
    return "এআই প্রোভাইডারের কোটা বা ট্রাফিক সীমা অতিক্রম করেছে। ১ মিনিট পর পুনরায় অনুরোধ করুন অথবা অ্যাডমিন প্যানেলে অতিরিক্ত গুগল এপিআই কী যুক্ত করুন।";
  if (status === 401 || status === 403)
    return "এআই এপিআই কী যাচাইকরণ ব্যর্থ হয়েছে। অ্যাডমিন প্যানেলে সঠিক কী নিশ্চিত করুন।";
  if (status >= 500)
    return "এআই ইঞ্জিন প্রোভাইডারের সার্ভারে সাময়িক সমস্যা হচ্ছে। কয়েক সেকেন্ড পর পুনরায় চেষ্টা করুন।";
  return `প্রসেসিং সম্পন্ন করা যায়নি (ত্রুটি কোড: ${status})। আবার চেষ্টা করুন।`;
}

function withStages(stages: string[], upstream: ReadableStream<Uint8Array>): Response {
  const enc = new TextEncoder();
  const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  const r = upstream.getReader();
  let closed = false;

  const push = (c: ReadableStreamDefaultController<Uint8Array>, v: Uint8Array) => {
    if (closed) return;
    try { c.enqueue(v); } catch { closed = true; }
  };

  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      // অবিলম্বে ফ্রন্টএন্ডে স্টেজ ইভেন্ট পাঠানো (যাতে ইউজার < ২০০ms-এ রেসপন্স দেখতে পায়)
      for (const st of stages) push(c, sse({ stage: st }));
      try {
        while (!closed) {
          const { done, value } = await r.read();
          if (done) break;
          push(c, value);
        }
      } catch {
        push(c, sse({ error: "সংযোগ মাঝপথে সাময়িক বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।" }));
      }
      if (!closed) { closed = true; try { c.close(); } catch {} }
    },
    cancel() {
      closed = true;
      r.cancel().catch(() => {});
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

function stageStream(stages: string[], work: () => Promise<string>): Response {
  const enc = new TextEncoder();
  const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      const push = (v: Uint8Array) => { try { c.enqueue(v); return true; } catch { return false; } };
      for (const st of stages) push(sse({ stage: st }));
      let text = "";
      try { text = await work(); } catch { text = "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।"; }
      if (push(sse({ choices: [{ delta: { content: text } }] }))) push(enc.encode("data: [DONE]\n\n"));
      try { c.close(); } catch {}
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}

function wantsImage(t: string): boolean {
  return /(ছবি|চিত্র|লোগো|পোস্টার|ব্যানার|image|picture|photo|logo|poster|illustration)/i.test(t)
    && /(বানা|তৈরি|আঁক|এঁকে|জেনারেট|generate|create|draw|make|design)/i.test(t)
    && !/(ওয়েবসাইট|website|html|কোড|code)/i.test(t);
}

async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt: prompt.slice(0, 3000), size: "1024x1024", n: 1 }),
    signal: AbortSignal.timeout(45000),
  }).catch(() => null);

  if (r?.ok) {
    const j: any = await r.json().catch(() => null);
    const d = j?.data?.[0];
    return d?.b64_json ? `data:image/png;base64,${d.b64_json}` : d?.url ?? null;
  }
  return null;
}

function needsSearch(t: string): boolean {
  if (/https?:\/\//.test(t)) return false;
  if (t.trim().length < 8) return false;
  return /(সর্বশেষ|সাম্প্রতিক|আজকের|খবর|সংবাদ|দাম কত|বাজার দর|রেট|আবহাওয়া|ফলাফল|স্কোর|নির্বাচন|latest|news|price|today)/i.test(t);
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local") || h === "metadata.google.internal") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    if (a === 10 || a === 127 || a === 0 || a === 169 || a === 192) return true;
  }
  return false;
}

async function safeFetch(url: string): Promise<Response> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) throw new Error("Blocked URL");
  return fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (AlAhsanAI Bot)" },
    signal: AbortSignal.timeout(6000),
  });
}

async function readUrls(text: string): Promise<string> {
  const urls = text.match(/https?:\/\/[^\s<>"')]+/g) || [];
  if (!urls.length) return "";
  const out: string[] = [];
  for (const u of urls.slice(0, 2)) {
    try {
      const r = await safeFetch(u);
      if (!r.ok) continue;
      const html = await r.text();
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
  const r = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "User-Agent": BROWSER_UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(q.slice(0, 200))}&kl=bd-en`,
    signal: AbortSignal.timeout(4000),
  }).catch(() => null);
  return r?.ok ? await r.text() : "";
}

async function newsRss(q: string): Promise<string> {
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q.slice(0, 150))}&hl=bn&gl=BD&ceid=BD:bn`, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(4000),
  }).catch(() => null);
  if (!r?.ok) return "";
  const xml = await r.text();
  const items = xml.split("<item>").slice(1, 6).map((it) => {
    const g = (t: string) => (new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(it)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
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
    let url = m[1]!;
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg) url = decodeURIComponent(uddg[1]!);
    out.push(`- ${strip(m[2]!)}\n  লিংক: ${url}\n  সারসংক্ষেপ: ${strip(m[3]!)}`);
  }
  return [n, out.join("\n\n")].filter(Boolean).join("\n\n");
}
