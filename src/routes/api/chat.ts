import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_MODELS, LOVABLE_MODELS, type Provider } from "@/lib/models";
import { GPT_ENGINEER_PROMPT, needsCodeEngine } from "@/lib/gpt-engineer";

// ১. ইনপুট ভ্যালিডেশন স্কিমা
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

// ২. ইঞ্জিনিয়ার মোড প্রম্পট (GPT-Engineer স্টাইল আর্কিটেকচার ও স্বতঃসিদ্ধ কোডিং)
const ENGINEER_PROMPT = `## ইঞ্জিনিয়ার মোড (সিনিয়র সফটওয়্যার ইঞ্জিনিয়ারের কাজের ধারা — কঠোরভাবে মানবে)
১. বোঝা: প্রথমে অনুরোধের আসল লক্ষ্য ১–২ লাইনে নিজের ভাষায় লিখবে। অস্পষ্ট বা ঝুঁকিপূর্ণ অনুমান থাকলে তা স্পষ্ট "অনুমান:" হিসেবে লিখবে।
২. পরিকল্পনা: ফাইল-কাঠামো ও ধাপগুলো সংক্ষিপ্ত তালিকায় দেবে; সবচেয়ে সহজ কার্যকর সমাধান বেছে নেবে, অপ্রয়োজনীয় জটিলতা নয়।
৩. বাস্তবায়ন: প্রতিটি ফাইল সম্পূর্ণ কোডসহ আলাদা কোড ব্লকে, ব্লকের আগে আপেক্ষিক ফাইল পাথ (যেমন: src/components/Header.tsx)। "..." বা "বাকি আগের মতো" লেখা কঠোরভাবে নিষিদ্ধ। ইনপুট যাচাই ও ত্রুটি-হ্যান্ডলিং রাখবে; গোপন কী কোডে বসাবে না।
৪. নিজে যাচাই: উত্তর পাঠানোর আগে মনে মনে কোডটি পরীক্ষা করবে — ইমপোর্ট, নাম, টাইপ, এজ-কেস, সিনট্যাক্স। ভুল পেলে ঠিক করে তবেই দেবে।
৫. চালানো ও টেস্ট: ইনস্টল/চালানো/টেস্টের সঠিক কমান্ড দেবে; সম্ভব হলে একটি টেস্ট ফাইল দেবে।
৬. সততা: নিজে চালিয়ে দেখোনি বলে কখনো "পরীক্ষিত/নিশ্চিত কাজ করবে" দাবি করবে না; জানা সীমাবদ্ধতা স্পষ্ট লিখবে। জানা না থাকলে অনুমান করে তথ্য বানাবে না।
৭. বিদ্যমান কোড দিলে শুধু চাওয়া অংশ বদলাবে, বাকি সব অক্ষত রাখবে, এবং কোথায় কী বদলেছে তা উল্লেখ করবে।`;

// ৩. পারসোনা ও শিষ্টাচার গার্ডরেল
const PERSONA = `## তোমার ব্যক্তিত্ব ও কঠোর নিয়ম (সবচেয়ে গুরুত্বপূর্ণ)
- তুমি একজন অভিজ্ঞ সিনিয়র ফুল-স্ট্যাক ডেভেলপার, টেকনিক্যাল আর্কিটেক্ট, গবেষক ও শিক্ষক — বিচক্ষণ, ধৈর্যশীল, বিনয়ী ও সুনির্দিষ্ট।
- সালাম নিয়ম (কঠোর): ব্যবহারকারীর সর্বশেষ বার্তায় সরাসরি সালাম (যেমন "আসসালামু আলাইকুম", "সালাম", "Assalamu alaikum") থাকলে কেবল তখনই উত্তরের শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্য সব ক্ষেত্রে (যেমন "কেমন আছেন", "হ্যালো", যেকোনো প্রশ্ন) কখনোই "ওয়ালাইকুম/ওয়ালাইকুমুস সালাম" বা নিজে থেকে সালাম লিখবে না — সরাসরি স্বাভাবিক উত্তর দেবে।
- প্রাসঙ্গিকতা: শুধু প্রশ্নের উত্তর দেবে। ভূমিকা, তোষামোদ ("চমৎকার প্রশ্ন"), অপ্রাসঙ্গিক মন্তব্য, নিজের প্রশংসা বা অপ্রয়োজনীয় সারাংশ লিখবে না। প্রথম বাক্য থেকেই আসল উত্তর।
- নির্ভুলতা: কোনো তথ্য বানাবে না। ইন্টারনেটে অনুসন্ধান করেও নিশ্চিত তথ্য না পেলে স্পষ্টভাবে "এই বিষয়ে সুনির্দিষ্ট তথ্য পাওয়া যায়নি" বলবে। কোনো সূত্র, লিংক, সংখ্যা বা হাদিস নম্বর কল্পনা করা কঠোরভাবে নিষিদ্ধ।
- রোবটের মতো অজুহাত নিষিদ্ধ ("আমি একটি এআই তাই পারি না")। সরাসরি কাজটি করে দেবে।
- আগের কথোপকথন মনে রেখে প্রসঙ্গ অনুযায়ী উত্তর দেবে; ছোট প্রশ্নে ছোট উত্তর, জটিল কাজে পূর্ণ সমাধান।
- ব্যবহারকারী লিংক দিলে নিচে "ওয়েব পেজের লেখা" অংশে বিষয়বস্তু থাকবে — সেটি পড়ে উত্তর দেবে।

## গভীর চিন্তার পদ্ধতি (সর্বোচ্চ বুদ্ধিমত্তা)
- উত্তরের আগে মনে মনে: (১) ব্যবহারকারী আসলে কী চান ও কেন; (২) প্রয়োজনীয় তথ্য ও সীমাবদ্ধতা চিহ্নিত করো; (৩) অন্তত দুটি পথ ভেবে সেরাটি বেছে নাও; (৪) উত্তর লেখার পর নিজেই ভুল খোঁজো (গণনা, যুক্তি, কোডের বাগ, সূত্র) এবং ঠিক করো। এই চিন্তার ধাপ লিখে দেখাবে না — শুধু চূড়ান্ত পরিষ্কার উত্তর দেবে।
- নিজের সীমা সৎভাবে জানো: যা জানো না তা বানাবে না, কিন্তু যা পারো তা পূর্ণ আত্মবিশ্বাসে সম্পূর্ণ করবে।

## সক্ষমতা
- এই সিস্টেম তোমার জন্য সরাসরি ইন্টারনেট অনুসন্ধান করে ও লিংকের পেজ পড়ে দেয়। তাই কখনো বলবে না "আমি ইন্টারনেট ব্রাউজ করতে পারি না" বা "আমার রিয়েল-টাইম তথ্য নেই"। অনুসন্ধানের ফলাফল দেওয়া থাকলে সেটি সত্য হিসেবে গ্রহণ করবে।
- তোমার তৈরি ওয়েবসাইট চ্যাটের ভেতরেই সরাসরি চলে এবং স্থায়ী লাইভ লিংক পায়।`;

// ৪. মূল আল-আহসান সিস্টেম প্রম্পট ও সততা গার্ডরেল
const BASE_PROMPT = `তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি অত্যন্ত শক্তিশালী, জ্ঞানী, প্রজ্ঞাবান ও বিনয়ী সহকারী।

## সাধারণ নিয়ম
- ব্যবহারকারী যে ভাষায় লেখে সেই ভাষায় উত্তর দাও (ডিফল্ট: শুদ্ধ বাংলা)।
- জটিল সমস্যায় সমস্যাটি ভেঙে বিশ্লেষণ করো, বিকল্পগুলো তুলনা করো, নিজের উত্তর যাচাই করো, তারপর চূড়ান্ত সমাধান দাও।
- লেখা, অনুবাদ, গণিত, বিজ্ঞান, প্রোগ্রামিং, গবেষণা, ব্যবসা পরিকল্পনা, শিক্ষা — সব কাজে বিশেষজ্ঞের মতো সাহায্য করো।
- কখনো মিথ্যা তথ্য বানাবে না; নিশ্চিত না হলে স্পষ্টভাবে বলো।

## ইসলামি বিষয়ে সততা প্রোটোকল (কঠোর)
- কুরআন ও সহিহ হাদিসের আলোকে সতর্কতার সাথে উত্তর দাও এবং নির্ভরযোগ্য কিতাবের নাম উল্লেখ করো।
- হাদিস/আয়াত/কিতাব/পৃষ্ঠা নম্বর কেবল শতভাগ নিশ্চিত হলে দেবে; না হলে বলবে "নির্দিষ্ট নম্বর নিশ্চিত নই, মূল কিতাবে যাচাই করুন"। কাল্পনিক সূত্র বা দুর্বল ভিত্তি উপস্থাপন কঠোরভাবে নিষিদ্ধ।
- জটিল ফিকহি মাসআলা, ব্যক্তিগত সংবেদনশীল ফতোয়ায় (যেমন তালাক, মিরাস) সাধারণ ইসলামিক দৃষ্টিভঙ্গি জানিয়ে শেষে বিজ্ঞ স্থানীয় মুফতি বা দারুল ইফতার পরামর্শ নিতে বলবে।

## ওয়েবসাইট ও কোড তৈরি (প্রথমবারেই সম্পূর্ণ ও প্রোডাকশন-রেডি)
ব্যবহারকারী ওয়েবসাইট, পেজ, ল্যান্ডিং পেজ বা কোড চাইলে:
- একটি একক ফাইলের সম্পূর্ণ HTML দেবে: \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত; শুধু একটি \`\`\`html ব্লক।
- হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>) ও প্রয়োজনীয় গুগল ফন্ট যুক্ত করবে।
- কার্যকারিতা: সব বাটন, মেনু, ফর্ম ও কার্ট জাভাস্ক্রিপ্টে সত্যিই কাজ করবে; ডেটা সংরক্ষণের জন্য localStorage ব্যবহার করবে।
- কোনো "// বাকি কোড", "...", বা অসম্পূর্ণ ফাংশন থাকবে না। সম্পূর্ণ কোড দিতে হবে।
- কোডের শেষে শুধু এক লাইনে লিখবে: "নিচে লাইভ লিংক দেওয়া হলো।" সিস্টেম নিজে থেকেই স্থায়ী প্রিভিউ লিংক তৈরি করবে।

## লেখার পরিচ্ছন্নতা
- উত্তরে অপ্রয়োজনীয় ইমোজি বা চটুল চিহ্ন ব্যবহার করবে না; মার্জিত ও পেশাদার প্রাতিষ্ঠানিক বাংলা ব্যবহার করবে।
- হেডলাইন নিয়ম: শুধুমাত্র সত্যিকারের গুরুত্বপূর্ণ মূল বিষয়গুলোর জন্য "### " দিয়ে ছোট শিরোনাম দেবে।`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handler: async ({ request }) => {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = authHeader?.replace(/^bearer\s+/i, "").trim();
      if (!token) {
        return new Response("অনুমোদন নেই (লগইন আবশ্যক)", { status: 401 });
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
      const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: u, error: uErr } = await userClient.auth.getUser(token);
      if (uErr || !u?.user) {
        return new Response("ব্যবহারকারী চিহ্নিত করা যায়নি। পুনরায় লগইন করুন।", { status: 401 });
      }
      const uid = u.user.id;

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      let json: unknown;
      try {
        json = await request.json();
      } catch {
        return new Response("ভুল ইনপুট ফরম্যাট", { status: 400 });
      }

      const parsed = Body.safeParse(json);
      if (!parsed.success) {
        return new Response("ইনপুট যাচাইয়ে ত্রুটি: " + parsed.error.issues.map((i) => i.message).join(", "), { status: 400 });
      }

      // সেটিংস ও এপিআই কি মেমোরি থেকে লোড
      const { settings: s, keys } = await getCachedSettingsAndKeys(supabaseAdmin);

      // অ্যাডমিন যাচাই
      const { data: rRow } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
      const isAdmin = rRow?.role === "admin";

      // ইউজার লিমিট যাচাই
      if (!isAdmin) {
        const since = new Date(Date.now() - 3600 * 1000).toISOString();
        const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        const [{ count: h }, { count: d }] = await Promise.all([
          supabaseAdmin.from("chat_usage").select("*", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", since),
          supabaseAdmin.from("chat_usage").select("*", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", today),
        ]);
        if ((h ?? 0) >= (s?.hourly_limit ?? 60)) {
          return new Response(`এক ঘণ্টায় সর্বোচ্চ ${s?.hourly_limit ?? 60}টি প্রশ্ন করা যায়। কিছুক্ষণ পর আবার চেষ্টা করুন।`, { status: 429 });
        }
        if ((d ?? 0) >= (s?.daily_limit ?? 300)) {
          return new Response(`আজকের দৈনিক সীমা (${s?.daily_limit ?? 300}টি প্রশ্ন) শেষ। আগামীকাল আবার চেষ্টা করুন।`, { status: 429 });
        }
      }
      void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});

      const lastUserMsg = parsed.data.messages[parsed.data.messages.length - 1];
      const lastMsgText = String(lastUserMsg?.content || "");
      const isSiteReq = /ওয়েবসাইট|ওয়েব সাইট|website|landing|html|পেজ বানা|অ্যাপ বানা/i.test(lastMsgText);
      const isEngineer = parsed.data.mode === "engineer";
      const isQuick = !isEngineer && !isSiteReq && lastMsgText.length < 300 && !/কোড|code|প্রোগ্রাম|ফতোয়া|মাসআলা|অংক|গণিত|আর্কিটেকচার/i.test(lastMsgText);

      // মেমোরি প্যারালাল ফেচ
      const memPromise = (async () => {
        try {
          const [{ data: mItems }, { data: rItems }] = await Promise.all([
            supabaseAdmin.from("user_memories").select("memory_text").eq("user_id", uid).limit(10),
            isQuick ? Promise.resolve({ data: [] }) : supabaseAdmin.from("chat_messages").select("content").eq("user_id", uid).order("created_at", { ascending: false }).limit(6),
          ]);
          return {
            items: (mItems || []).map((m: any) => m.memory_text).filter(Boolean),
            recent: (rItems || []).map((r: any) => r.content).filter(Boolean),
          };
        } catch {
          return { items: [], recent: [] };
        }
      })();

      // মডেল ও প্রোভাইডার নির্বাচন
      const ownGoogle = (keys?.google_key || process.env["GOOGLE_API_KEY"] || "").trim().replace(/^["']|["']$/g, "");
      const ownGroq = (keys?.groq_key || process.env["GROQ_API_KEY"] || "").trim().replace(/^["']|["']$/g, "");
      const ownOpenAI = (keys?.openai_key || process.env["OPENAI_API_KEY"] || "").trim();

      let targetUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      let chosenKey = ownGoogle;
      let activeModel = isQuick ? "gemini-3.5-flash-lite" : "gemini-3.8-flash";
      let activeProvider: "google" | "groq" | "openai" | "lovable" = "google";

      if (ownGoogle) {
        targetUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        chosenKey = ownGoogle;
        activeModel = isEngineer ? "gemini-3.8-flash" : (isQuick ? "gemini-3.5-flash-lite" : "gemini-3.8-flash");
        activeProvider = "google";
      } else if (ownGroq) {
        targetUrl = "https://api.groq.com/openai/v1/chat/completions";
        chosenKey = ownGroq;
        activeModel = isQuick ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";
        activeProvider = "groq";
      } else if (ownOpenAI) {
        targetUrl = "https://api.openai.com/v1/chat/completions";
        chosenKey = ownOpenAI;
        activeModel = "gpt-4o";
        activeProvider = "openai";
      } else if (process.env["LOVABLE_API_KEY"]) {
        targetUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        chosenKey = process.env["LOVABLE_API_KEY"]!;
        activeModel = "google/gemini-3-flash-preview";
        activeProvider = "lovable";
      }

      if (!chosenKey) {
        return new Response("কোনো এআই কী পাওয়া যায়নি। অ্যাডমিন প্যানেলে গুগল এআই কী বসান।", { status: 503 });
      }

      // সিস্টেম প্রম্পট প্রস্তুত
      let system = PERSONA + "\n\n" + BASE_PROMPT;
      if (isEngineer) system += "\n\n" + ENGINEER_PROMPT;
      if (needsCodeEngine(lastMsgText, isSiteReq)) system += "\n\n" + GPT_ENGINEER_PROMPT;
      if (s?.system_prompt?.trim()) system += `\n\n=== অ্যাডমিন নির্দেশিকা ===\n${s.system_prompt.trim()}`;

      // বাংলাদেশ লাইভ সময় সিঙ্ক
      const now = new Date();
      const bdDate = new Intl.DateTimeFormat("bn-BD", {
        timeZone: "Asia/Dhaka",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(now);
      system += `\n\n=== বর্তমান সময় (বাংলাদেশ ঘড়ি, নির্ভুল) ===\nএখন সময়: ${bdDate}।`;

      // ইউজার মেমোরি সংযোজন
      const { items: memItems, recent: recentMsgs } = await memPromise;
      if (memItems.length) {
        system += `\n\n=== ব্যবহারকারীর সংরক্ষিত মেমোরি ===\n${memItems.map((m: string) => "- " + m).join("\n")}`;
      }
      if (recentMsgs.length) {
        system += `\n\n=== সাম্প্রতিক প্রসঙ্গের টুকরো ===\n${recentMsgs.map((r: string) => "- " + String(r).slice(0, 150)).join("\n")}`;
      }

      // সেশন তথ্য
      system += isAdmin
        ? `\n\n=== ব্যবহারকারী স্ট্যাটাস ===\nব্যবহারকারী একজন ভেরিফাইড অ্যাডমিন (${u.user.email})। সর্বোচ্চ গুরুত্ব দিয়ে সাহায্য করবে।`
        : `\n\n=== ব্যবহারকারী স্ট্যাটাস ===\nব্যবহারকারী সাধারণ ইউজার।`;

      // লাইভ স্টেজ ট্র্যাকিং
      const stages: string[] = ["think"];

      // সরাসরি ইউআরএল লিঙ্ক রিডার
      const textMsgs = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
      if (s?.url_reader !== false && /https?:\/\//.test(lastMsgText)) {
        const pageContent = await readUrls(lastMsgText);
        if (pageContent) {
          system += `\n\n=== ব্যবহারকারীর দেওয়া ওয়েবসাইটের লেখা ===\n${pageContent}`;
        }
      }

      // স্মার্ট লাইভ ইন্টারনেট অনুসন্ধান (ফ্রি উইকিপিডিয়া + ডকডাকগো + তাভিলি)
      if (needsSearch(lastMsgText)) {
        stages.push("search");
        const searchInfo = await smartRealtimeSearch(lastMsgText);
        if (searchInfo) {
          stages.push("verify");
          system += `\n\n=== রিয়েল-টাইম অনুসন্ধান থেকে প্রাপ্ত নিশ্চিত তথ্য (বাধ্যতামূলকভাবে এর ভিত্তিতে উত্তর সাজাও) ===\n${searchInfo}`;
        }
      }

      if (needsCodeEngine(lastMsgText, isSiteReq) || isSiteReq) {
        stages.push("code");
      }

      // মাল্টি-ইমেজ ও ভিশন ফরম্যাটিং
      const imgsOf = (i: number) => {
        const m = parsed.data.messages[i];
        return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
      };

      const msgsForModel: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
        const imgs = imgsOf(i);
        if (m.role !== "user" || !imgs.length) return m;
        return {
          role: m.role,
          content: [
            { type: "text", text: m.content || "এই ছবিগুলো বিশ্লেষণ করুন।" },
            ...imgs.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        };
      });

      // রিকোয়েস্ট বডি
      const requestPayload: Record<string, unknown> = {
        model: activeModel,
        stream: true,
        max_tokens: isQuick ? 4096 : 32768,
        messages: [{ role: "system", content: system }, ...msgsForModel],
      };

      // ফাস্ট ফেইলওভার পাইপলাইন (৩৮ সেকেন্ডের জট পুরোপুরি নিষিদ্ধ)
      type Attempt = { url: string; key: string; model: string; label: string };
      const attempts: Attempt[] = [{ url: targetUrl, key: chosenKey, model: activeModel, label: "primary" }];

      // গুগলের ফ্রি কোটার মডেলগুলোর ফাস্ট চেইন
      if (activeProvider === "google") {
        const googleCandidates = [
          "gemini-3.8-flash",
          "gemini-3-flash-preview",
          "gemini-3.5-flash-lite",
          "gemini-flash-latest",
          "gemini-pro-latest",
        ];
        for (const cand of googleCandidates) {
          if (cand !== activeModel) {
            attempts.push({ url: targetUrl, key: chosenKey, model: cand, label: `google-${cand}` });
          }
        }
      }

      // কি-পুল থেকে সক্রিয় ব্যাকআপ কি
      const pool = (Array.isArray((keys as any)?.key_pool) ? (keys as any).key_pool : [])
        .filter((p: any) => p && p.active !== false && p.key?.trim());
      for (const p of pool) {
        if (p.key!.trim() !== chosenKey) {
          attempts.push({
            url: p.base_url || targetUrl,
            key: p.key!.trim(),
            model: p.model || activeModel,
            label: p.name || "pool-key",
          });
        }
      }

      // গ্রক ফলব্যাক
      if (ownGroq && activeProvider !== "groq") {
        attempts.push({
          url: "https://api.groq.com/openai/v1/chat/completions",
          key: ownGroq,
          model: "llama-3.3-70b-versatile",
          label: "groq-backup",
        });
      }

      let res: Response = new Response("no attempt", { status: 500 });
      let lastErrorText = "";

      // প্রতিটি মডেলের জন্য অতি-দ্রুত টাইমআউট (সর্বোচ্চ ৪.৫ সেকেন্ড!)
      for (const attempt of attempts) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attempt.key}`,
        };
        let callUrl = attempt.url;
        if (callUrl.includes("generativelanguage.googleapis.com")) {
          headers["x-goog-api-key"] = attempt.key;
          if (!callUrl.includes("key=")) {
            callUrl += `?key=${encodeURIComponent(attempt.key)}`;
          }
        }

        const ac = new AbortController();
        // ছোট প্রশ্নে ৪ সেকেন্ড, বড় কোডিং প্রশ্নে সর্বোচ্চ ৭.৫ সেকেন্ড
        const timeoutMs = isQuick ? 4000 : 7500;
        const timer = setTimeout(() => ac.abort(), timeoutMs);

        try {
          res = await fetch(callUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...requestPayload, model: attempt.model }),
            signal: ac.signal,
          });
        } catch (e: any) {
          res = new Response(e?.name === "AbortError" ? "timeout" : String(e), {
            status: e?.name === "AbortError" ? 504 : 502,
          });
        } finally {
          clearTimeout(timer);
        }

        if (res.ok && res.body) {
          break; // সফল হলে লুপ শেষ
        }

        lastErrorText = await res.text().catch(() => "");
        console.warn(`Attempt "${attempt.label}" (${attempt.model}) failed [${res.status}]: ${lastErrorText.slice(0, 150)}`);
      }

      // গেটওয়ে ব্যাকআপ (যদি সব ফ্রি কী সাময়িক ব্যর্থ হয়)
      if ((!res.ok || !res.body) && process.env["LOVABLE_API_KEY"]) {
        const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...requestPayload, model: "google/gemini-3-flash-preview" }),
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);

        if (gwRes?.ok && gwRes.body) {
          res = gwRes;
        }
      }

      // যদি শত চেষ্টা সত্ত্বেও কোনো সার্ভার সাড়া না দেয়
      if (!res.ok || !res.body) {
        return new Response(formatFriendlyError(res.status, lastErrorText), {
          status: res.status >= 500 || !res.status ? 502 : res.status,
        });
      }

      stages.push("write");
      return streamWithSSEStages(stages, res.body);
    },
  },
});

// ==========================================
// হেল্পার ফাংশন ও রিয়েল-টাইম সার্ভিস
// ==========================================

// ১. সেটিংস ও কী মেমোরি ক্যাশ (ডাটাবেজ ওভারহেড রোধে)
let cacheData: { time: number; s: any; k: any } | null = null;
async function getCachedSettingsAndKeys(admin: any) {
  const now = Date.now();
  if (cacheData && now - cacheData.time < 60_000) {
    return { settings: cacheData.s, keys: cacheData.k };
  }
  const [{ data: s }, { data: k }] = await Promise.all([
    admin.from("ai_settings").select("*").limit(1).maybeSingle(),
    admin.from("ai_keys").select("*").limit(1).maybeSingle(),
  ]);
  cacheData = { time: now, s, k };
  return { settings: s, keys: k };
}

// ২. সার্চ দরকার কিনা বোঝার স্মার্ট ডিটেকশন
function needsSearch(t: string): boolean {
  if (/https?:\/\//.test(t) || t.trim().length < 4) return false;
  // প্রশাসনিক তথ্য, ইউনিয়ন, উপজেলা, জেলা, রিলিজ, খবর, ব্যক্তি, তথ্য
  return /(ইউনিয়ন|উপজেলা|জেলা|গ্রাম|কোথায়|অবস্থান|খবর|সংবাদ|দাম|দর|ইতিহাস|কে ছিলেন|রিলিজ|ভার্সন|latest|version|news|update|gemini|gpt)/i.test(t);
}

// ৩. মাল্টি-সোর্স রিয়েল-টাইম সার্চ (উইকিপিডিয়া + ডকডাকগো + তাভিলি)
async function smartRealtimeSearch(query: string): Promise<string> {
  const cleanQ = query.replace(/[?।,!]/g, " ").trim().slice(0, 100);
  const results: string[] = [];

  // ক) বাংলা উইকিপিডিয়া থেকে তাৎক্ষণিক ফ্রি ভেরিফিকেশন (শূন্য এপিআই কি)
  try {
    const wikiUrl = `https://bn.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json`;
    const wRes = await fetch(wikiUrl, {
      headers: { "User-Agent": "AlAhsanAI/1.0" },
      signal: AbortSignal.timeout(3500),
    });
    if (wRes.ok) {
      const data: any = await wRes.json();
      const hits = data?.query?.search || [];
      for (const h of hits.slice(0, 2)) {
        const snippet = String(h.snippet || "").replace(/<[^>]+>/g, "").trim();
        if (snippet) results.push(`[উইকিপিডিয়া: ${h.title}]\n${snippet}`);
      }
    }
  } catch {}

  // খ) তাভিলি লাইভ সার্চ (যদি কী কনফিগার করা থাকে)
  const tavilyKey = process.env["TAVILY_API_KEY"]?.trim();
  if (tavilyKey && results.length < 2) {
    try {
      const tRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query: cleanQ, max_results: 3 }),
        signal: AbortSignal.timeout(4000),
      });
      if (tRes.ok) {
        const tData: any = await tRes.json();
        for (const r of tData?.results || []) {
          results.push(`[উৎস: ${r.title}]\n${r.content}`);
        }
      }
    } catch {}
  }

  return results.join("\n\n");
}

// ৪. ইউআরএল ওয়েব পেজ রিডার
async function readUrls(text: string): Promise<string> {
  const urls = text.match(/https?:\/\/[^\s<>"')]+/g) || [];
  if (!urls.length) return "";
  const out: string[] = [];

  for (const u of urls.slice(0, 2)) {
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0 (AlAhsanAI Reader)" },
        signal: AbortSignal.timeout(5000),
      });
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

// ৫. লাইভ স্টেজ সহ SSE রেসপন্স স্ট্রিমিং
const encoder = new TextEncoder();
const makeSSE = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

function streamWithSSEStages(stages: string[], upstream: ReadableStream<Uint8Array>): Response {
  const reader = upstream.getReader();
  let isClosed = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (chunk: Uint8Array) => {
        if (isClosed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          isClosed = true;
        }
      };

      // প্রাথমিক ধাপগুলো পাঠানো
      for (const stage of stages) {
        push(makeSSE({ stage }));
      }

      try {
        while (!isClosed) {
          const { done, value } = await reader.read();
          if (done) break;
          push(value);
        }
      } catch {
        push(makeSSE({ error: "সংযোগ বিঘ্নিত হয়েছে। আবার পাঠান।" }));
      } finally {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      isClosed = true;
      reader.cancel().catch(() => {});
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// ৬. মার্জিত বাংলা এরর মেসেজ
function formatFriendlyError(status: number, rawText: string): string {
  const text = rawText.toLowerCase();
  if (status === 403 || text.includes("permission_denied") || text.includes("denied access")) {
    return "গুগল এআই কী-এর অনুমতি বাতিল হয়েছে (Denied Access)। অনুগ্রহ করে গুগল এআই স্টুডিও থেকে একটি নতুন কী নিয়ে বসান।";
  }
  if (status === 429 || text.includes("resource_exhausted") || text.includes("rate limit")) {
    return "অনুরোধের সাময়িক চাপ বৃদ্ধি পেয়েছে। এক মিনিট পর পুনরায় চেষ্টা করুন।";
  }
  if (status === 503 || text.includes("high demand") || text.includes("unavailable")) {
    return "গুগল সার্ভারে এই মুহূর্তে সাময়িক উচ্চ চাপ রয়েছে। সিস্টেমটি অন্য ব্যাকআপ মডেলে শিফট করছে, দয়া করে আবার পাঠান।";
  }
  if (status === 504 || text.includes("timeout")) {
    return "সার্ভার থেকে উত্তর আসতে অতিরিক্ত সময় লাগছিল। আবার প্রশ্ন করুন।";
  }
  return `এআই সার্ভারে সাময়িক সমস্যা হচ্ছে (কোড ${status})। কিছুক্ষণ পর আবার চেষ্টা করুন।`;
}
