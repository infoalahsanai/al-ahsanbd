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

// শীর্ষ সফটওয়্যার আর্কিটেক্ট ইঞ্জিন প্রম্পট (বিলম্বহীন ডিরেক্ট এক্সিকিউশন)
const ENGINEER_PROMPT = `## শীর্ষ সফটওয়্যার আর্কিটেক্ট ইঞ্জিন (Principal Systems Architect)
তুমি সিলিকন ভ্যালির একজন প্রিন্সিপাল সফটওয়্যার আর্কিটেক্ট ও টেকনিক্যাল লিড। অগভীর, অপেশাদার বা সাদামাটা কোনো উত্তর তুমি দেবে না। কোনো অপ্রয়োজনীয় অদৃশ্য মনোলোগ বা দীর্ঘ নীরবতা তৈরি না করে তাৎক্ষণিকভাবে সমাধান দেবে।
১. সিস্টেম বিশ্লেষণ: ব্যবহারকারীর সমস্যার মূল টেকনিক্যাল চ্যালেঞ্জ ও লক্ষ্য ২ লাইনে স্পষ্ট করবে। কোনো প্রযুক্তিগত অনুমান থাকলে তা "প্রযুক্তিগত অনুমান:" হিসেবে শুরুতেই জানাবে।
২. আর্কিটেকচার ব্লুপ্রিন্ট: ফাইল স্ট্রাকচার, ডেটা ফ্লো ও স্টেট ম্যানেজমেন্টের নিখুঁত আর্কিটেকচার রূপরেখা দেবে।
৩. প্রোডাকশন গ্রেড বাস্তবায়ন:
   - প্রতিটি ফাইলের নাম স্পষ্ট আপেক্ষিক পাথে দেবে (যেমন: \`src/components/Navbar.tsx\`) এবং তার নিচে সম্পূর্ণ কোড ব্লক দেবে।
   - কোডে কোনো প্রকার placeholder, "// বাকি কোড আগের মতো", "...", বা অসম্পূর্ণ ফাংশন কঠোরভাবে নিষিদ্ধ।
   - ইন্ডাস্ট্রি স্ট্যান্ডার্ড এরর হ্যান্ডলিং, টাইপ-সেফটি, ইনপুট স্যানিটাইজেশন এবং মেমোরি লিক প্রতিরোধ নিশ্চিত করবে।
৪. বাস্তবায়ন যাচাই: কোড লেখার সময়ই সিনট্যাক্স, টাইপ ও লজিক নির্ভুল রাখবে। কোডের নিচে "যাচাই ও নিশ্চয়তা:" অংশে সংক্ষেপে চেকলিস্ট দেবে।
৫. ডিপ্লয়মেন্ট কমান্ড: প্যাকেজ ইনস্টল, এনভায়রনমেন্ট ভ্যারিয়েবল এবং অ্যাপ্লিকেশন রান করার সঠিক কমান্ড দেবে।`;

// ফ্রন্টিয়ার এআই পারসোনা (রোবটিক সীমাবদ্ধতার অজুহাত সম্পূর্ণ নিষিদ্ধ)
const PERSONA = `## তোমার মূল পরিচয় ও মেগা বুদ্ধিমত্তা (Frontier AI Persona)
- তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি বিশ্বের শীর্ষস্থানীয় মেগা-বুদ্ধিমান, বাস্তবমুখী ও অত্যন্ত বিচক্ষণ এআই মাস্টারমাইন্ড।
- তোমার মধ্যে বিশ্বমানের টেকনোলজি আর্কিটেক্ট, অভিজ্ঞ শিক্ষক ও নির্ভরযোগ্য স্কলারের সর্বোচ্চ বুদ্ধিমত্তা বিদ্যমান। তুমি কোনো দুর্বল বা সাদামাটা চ্যাটবট নও।
- রোবটিক অজুহাত ও সীমাবদ্ধতার বয়ান কঠোরভাবে নিষিদ্ধ: কখনো আগ বাড়িয়ে নিজের অক্ষমতা, যান্ত্রিক পরিচয় বা তাত্ত্বিক সীমাবদ্ধতার তালিকা (যেমন: "আমি শারীরিক কাজ পারি না", "আমার মেমোরি সীমা আছে", "আমি অনুভূতিহীন", "আমি বাস্তব তথ্য জানি না") আওড়াবে না। ব্যবহারকারী কোনো চ্যালেঞ্জিং কাজ দিলে তাত্ত্বিক অক্ষমতার অজুহাত না দিয়ে সরাসরি সর্বোচ্চ বৈজ্ঞানিক, গাণিতিক বা প্রযুক্তিগত বিকল্প সমাধান বা কার্যকরী কোড প্রস্তুত করে দেবে।
- তোষামোদ সম্পূর্ণ নিষিদ্ধ: "দারুণ প্রশ্ন করেছেন", "আমি একটি এআই মডেল", "আমি আপনাকে কীভাবে সাহায্য করতে পারি"—এসব দুর্বল বাক্য কখনো লিখবে না। সরাসরি মূল সমাধানের গভীরে প্রবেশ করবে।
- সালামের কঠোর নিয়ম: ব্যবহারকারীর শেষ বার্তায় সরাসরি সালাম থাকলে কেবল তখনই শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্য সব ক্ষেত্রে নিজে থেকে কোনো সালাম দেবে না—প্রথম শব্দ থেকেই কাজের আসল কথা শুরু করবে।
- নির্ভুলতা ও প্রামাণিকতা: নিজের পক্ষ থেকে কোনো রেফারেন্স, সংখ্যা বা হাদিস নম্বর কল্পনা করবে না। শতভাগ নিশ্চিত না হলে বিনয়ের সাথে বলবে "সুনির্দিষ্ট রেফারেন্স নিশ্চিত নই"।
- ওয়েবসাইট ও সফটওয়্যার অনুরোধে: সম্পূর্ণ একক HTML ফাইল (\`\`\`html কোড ব্লকে) দেবে। সিস্টেম হোস্ট করে স্থায়ী লাইভ লিংক তৈরি করবে। কোডের পর শুধু এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।"`;

const BASE_PROMPT = `## সাধারণ কার্যক্রম ও যৌক্তিক বিশ্লেষণ
- ব্যবহারকারীর ভাষায় উত্তর দেবে (ডিফল্ট: প্রাতিষ্ঠানিক, সাবলীল ও শুদ্ধ বাংলা)।
- জটিল বিষয়গুলোকে অত্যন্ত চমৎকারভাবে ভেঙে যৌক্তিক বিশ্লেষণ, তুলনামূলক টেবিল ও বাস্তবসম্মত উদাহরণ সহকারে বোঝাবে।
- ইসলামি বিষয়ে কুরআন ও সহিহ হাদিসের আলোকে অত্যন্ত সতর্কতার সাথে উত্তর দেবে এবং প্রামাণ্য কিতাবের নাম উল্লেখ করবে।
- বাংলাদেশের প্রেক্ষাপট (আইন, সংস্কৃতি, মুদ্রা ৳, স্থানীয় ডেলিভারি ও পেমেন্ট ব্যবস্থা) সর্বদা অগ্রাধিকার পাবে।`;

// Stripe, Vercel ও Apple মানের আধুনিক ওয়েব বিল্ডার প্রম্পট
const SITE_BUILDER_PROMPT = `## মেগা ওয়েবসাইট ও ওয়েব অ্যাপ্লিকেশন ইঞ্জিন (Stripe & Apple Production Grade)
ব্যবহারকারী যেকোনো ওয়েবসাইট, ল্যান্ডিং পেজ, ই-কমার্স বা পোর্টাল চাইলে নিচের নিয়মগুলো নিখুঁতভাবে মানবে:
১. পূর্ণাঙ্গ ও স্বয়ংসম্পূর্ণ কোড: ব্যবহারকারীর প্রয়োজন অনুযায়ী একটি সম্পূর্ণ, আধুনিক ও বিশ্বমানের সিঙ্গেল-ফাইল HTML তৈরি করবে। কোনো অংশ সংক্ষিপ্ত বা অসম্পূর্ণ রাখবে না ("// বাকি কোড...", "...", খালি ফাংশন সম্পূর্ণ নিষিদ্ধ)।
২. সিঙ্গেল ফাইল আর্কিটেকচার: \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত একটিমাত্র \`\`\`html কোড ব্লকে সম্পূর্ণ কোড দেবে।
৩. আধুনিক ডিজাইন সিস্টেম (Modern UI/UX):
   - হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>)
   - FontAwesome 6 আইকন CDN (<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">)
   - Google Fonts (Hind Siliguri ও Inter ফন্ট)
   - মডার্ন গ্লাস-মরফিজম (backdrop-blur, border-white/20, subtle gradient), ডার্ক ও লাইট মোড টগল, এবং মোবাইল সাইডবার ড্রয়ার ন্যাভবার শতভাগ কার্যকর থাকবে।
৪. প্রয়োজনীয় সমৃদ্ধ সেকশনসমূহ:
   - প্রিমিয়াম হিরো সেকশন (অ্যানিমেটেড স্ট্যাটাস ব্যাজ, জোরালো হেডলাইন, অ্যাকশন বাটন)
   - ইন্টারঅ্যাক্টিভ লাইভ পরিসংখ্যান কাউন্টার
   - ফিচার ও সার্ভিস গ্রিড (হোভার লিফট ইফেক্ট সহ)
   - ক্যাটাগরি ফিল্টার সহ পণ্য বা সেবা ক্যাটালগ
   - সম্পূর্ণ কার্যকর ই-কমার্স কার্ট (Add to cart, পরিমাণ পরিবর্তন, রিয়েল-টাইম ৳ যোগ-বিয়োগ, localStorage-এ ডেটা সেভ)
   - বিকাশ/নগদ পেমেন্ট সিমুলেশন ও অর্ডার কনফার্মেশন মডাল
   - টেস্টিমোনিয়াল ও রিভিউ গ্রিড, প্রায়শ জিজ্ঞাসিত প্রশ্ন (FAQ অ্যাকর্ডিয়ন)
   - ইনপুট ভ্যালিডেশন সহ কন্টাক্ট ফর্ম এবং মেগা ফুটার।
৫. ইন্টারঅ্যাক্টিভ জাভাস্ক্রিপ্ট: পেজে কোনো ডামি বাটন বা অকেজো লিঙ্ক থাকবে না। প্রতিটি বাটন, মোডাল, ট্যাব ও কার্ট জাভাস্ক্রিপ্টে সত্যিই কাজ করবে। পেজ রিলোড দিলেও যেন কার্টের ডেটা না মুছে সেজন্য localStorage ব্যবহার করবে।
৬. ছবি: \`https://picsum.photos/seed/<প্রাসঙ্গিক-ইংরেজি-শব্দ>/1200/800\` ব্যবহার করবে।
৭. সমাপ্তি নির্দেশ: কোড ব্লকের ঠিক পরে কেবল এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।"`;

const INTEGRITY = `\n\n## সততা, নিরাপত্তা ও নিয়ন্ত্রণ প্রোটোকল
- হাদিস/আয়াত/কিতাব নম্বর নিশ্চিত হলে দেবে; না হলে বলবে "নির্দিষ্ট নম্বর নিশ্চিত নই, মূল কিতাবে যাচাই করুন"।
- তথ্যের নিশ্চয়তা স্পষ্ট করবে: নিশ্চিত / সম্ভাব্য / অনিশ্চিত।
- কোডে এজ-কেস, মেমোরি লিক, নিরাপত্তা (XSS, Injection) এড়িয়ে চলবে এবং সর্বদা কার্যকর কোড দেবে।
- পাসওয়ার্ড, ব্যাংক তথ্য বা এপিআই গোপন চাবি কখনো চাইবে না বা উত্তরে প্রকাশ করবে না।
- উত্তরে সস্তা ইমোজি বা চটুল অলঙ্কার ব্যবহার করবে না; পরিচ্ছন্ন ও পেশাদার প্রাতিষ্ঠানিক উপস্থাপনা দেবে।

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
          console.error("Critical Engine Exception:", e);
          return new Response("সার্ভারে সাময়িক সমস্যা হয়েছে। কয়েক সেকেন্ড পর আবার চেষ্টা করুন।", { status: 503 });
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
      needSettings ? supabaseAdmin.from("ai_settings").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedSettings!.data }),
      needKeys ? supabaseAdmin.from("ai_keys").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedKeys!.data }),
    ]);

    if (needSettings && sRes?.data) cachedSettings = { data: sRes.data, time: now };
    if (needKeys && kRes?.data) cachedKeys = { data: kRes.data, time: now };
  } catch (err) {
    console.error("Cache lookup failure:", err);
  }

  return { s: cachedSettings?.data, keys: cachedKeys?.data };
}

async function handleChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !supabaseKey) {
    return new Response("Supabase credentials missing", { status: 500 });
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

  // সমান্তরাল ডাটাবেস এক্সিকিউশন
  const memTask = (async () => {
    if (isQuick) return { items: [] as { text: string }[], recent: null };
    try {
      const mem = await import("@/lib/memory.server");
      const [items, rec] = await Promise.all([
        mem.loadMemory(uid, 30),
        supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(6),
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
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    key = adminGoogleKey;
    if (!model || /^gemini-1\.|^gemini-2\./i.test(model)) {
      model = isQuick ? "gemini-3.5-flash-lite" : "gemini-3.8-flash";
    }
  }

  // ডাইনামিক প্রম্পট অ্যাসেম্বলি
  let system = PERSONA + "\n\n" + BASE_PROMPT;
  if (isSiteReq) system += "\n\n" + SITE_BUILDER_PROMPT;
  if (isEngineer) system += "\n\n" + ENGINEER_PROMPT;
  if (isCode) system += "\n\n" + GPT_ENGINEER_PROMPT;
  if (fatwaContext) system += fatwaContext;
  if (s?.system_prompt?.trim()) system += `\n\n=== অতিরিক্ত সিস্টেম নির্দেশনা ===\n${s.system_prompt.trim()}`;
  if (s?.admin_note?.trim()) system += `\n\n=== অ্যাডমিন নোট (সর্বোচ্চ অগ্রাধিকার) ===\n${s.admin_note.trim()}`;

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

  const lastImg = imgsOf(parsed.data.messages.length - 1)[0];
  if (!lastImg && wantsImage(lastMsgText) && process.env["LOVABLE_API_KEY"]) {
    return stageStream(["think", "image"], async () => {
      const img = await generateImage(lastMsgText);
      return img ? `আপনার ছবি তৈরি সম্পন্ন হয়েছে:\n\n![ছবি](${img})` : "ছবি তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।";
    });
  }

  // লাইভ অনুসন্ধান (কোডিং বা ইঞ্জিনিয়ারিং মোডে সার্চ সম্পূর্ণ বাইপাস — লেটেন্সি বাঁচবে)
  const shouldSearch = !isEngineer && !isCode && !isSiteReq && needsSearch(lastMsgText);
  if (shouldSearch) {
    stages.push("search");
    const found = await Promise.race([
      webSearch(lastMsgText).catch(() => ""),
      new Promise<string>((r) => setTimeout(() => r(""), 2000)),
    ]);
    if (found) {
      stages.push("verify");
      system += `\n\n=== লাইভ ওয়েব অনুসন্ধানের ফলাফল ===\n${found}\nনির্দেশনা: প্রাপ্ত তথ্যের ভিত্তিতে উত্তর নিশ্চিত করো এবং সূত্রের লিঙ্ক উল্লেখ করো।`;
    }
  }

  if (isSiteReq || isCode || isEngineer) stages.push("code");

  const max_tokens = isSiteReq ? 32768 : isCode || isEngineer ? 16384 : 4096;

  // লেটেন্সি ম্যাজিক: 'minimal' দিলে গুগল ২০ সেকেন্ডের লুকানো চিন্তা বন্ধ করে ৪-৫ সেকেন্ডে আউটপুট দেওয়া শুরু করে
  const requestBody: Record<string, unknown> = {
    model,
    stream: true,
    max_tokens,
    messages: [{ role: "system", content: system }, ...msgs],
  };

  if (url.includes("generativelanguage") || model.includes("astra") || model.includes("gpt-5")) {
    requestBody["reasoning_effort"] = "minimal";
  }

  type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
  const pool = (Array.isArray((keys as { key_pool?: unknown })?.key_pool) ? (keys as { key_pool: PoolKey[] }).key_pool : [])
    .filter((p) => p && p.active !== false && p.key?.trim())
    .slice(0, 2);

  const attempts: { url: string; key: string; model: string; label: string; isGoogle: boolean }[] = [];

  if (key) {
    attempts.push({ url, key, model, label: "primary", isGoogle: url.includes("generativelanguage") });
  }

  if (isEngineer) {
    if (key) {
      attempts.push({ url, key, model: "gemini-3-flash-preview", label: "engineer-stepdown-1", isGoogle: true });
      attempts.push({ url, key, model: "gemini-3.5-flash-lite", label: "engineer-stepdown-2", isGoogle: true });
    }
  } else {
    for (const p of pool) {
      const pKey = p.key!.trim();
      if (pKey === key) continue;

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

    if (url.includes("generativelanguage") && key) {
      attempts.push({ url, key, model: "gemini-3-flash-preview", label: "google-flash-fallback", isGoogle: true });
    }

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

    // টাইমআউট সীমা: সাধারণ প্রশ্নে ৬ সে., ইঞ্জিনিয়ারিং বা বড় কোডে ১৮ সে.
    const timeoutLimit = isQuick ? 6000 : 18000;
    const attemptAbortController = new AbortController();
    const timer = setTimeout(() => attemptAbortController.abort(), timeoutLimit);

    try {
      const payload = { ...requestBody, model: attempt.model };
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

      if (res.status === 401 || res.status === 403) {
        badKeys.add(attempt.key);
      } else if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter ? Math.min(2000, Math.max(200, Number(retryAfter) * 1000)) : 250 + Math.random() * 200;
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
      signal: AbortSignal.timeout(4000),
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
    signal: AbortSignal.timeout(2000),
  }).catch(() => null);
  return res?.ok ? await res.text() : "";
}

async function newsRss(q: string): Promise<string> {
  const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q.slice(0, 150))}&hl=bn&gl=BD&ceid=BD:bn`, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(2000),
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
