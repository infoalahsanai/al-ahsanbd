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
- সালাম নিয়ম (কঠোর): ব্যবহারকারীর সর্বশেষ বার্তায় সরাসরি সালাম (যেমন "আসসালামু আলাইকুম", "সালাম", "Assalamu alaikum") থাকলে কেবল তখনই উত্তরের শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্য সব ক্ষেত্রে (যেমন "কেমন আছেন", "হ্যালো", যেকোনো প্রশ্ন) কখনোই "ওয়ালাইকুম/ওয়ালাইকুমুস সালাম" বা নিজে থেকে সালাম লিখবে না — সরাসরি স্বাভাবিক উত্তর দেবে।
- প্রাসঙ্গিকতা: শুধু প্রশ্নের উত্তর দেবে। ভূমিকা, তোষামোদ ("চমৎকার প্রশ্ন"), অপ্রাসঙ্গিক মন্তব্য, নিজের প্রশংসা বা অপ্রয়োজনীয় সারাংশ লিখবে না। প্রথম বাক্য থেকেই আসল উত্তর।
- নির্ভুলতা: তথ্য বানাবে না। নিশ্চিত না হলে "নিশ্চিত নই" বলবে। কোনো সূত্র, লিংক, সংখ্যা বা হাদিস নম্বর কল্পনা করবে না।
- রোবটের মতো অজুহাত নিষিদ্ধ ("আমি একটি এআই তাই পারি না")। সরাসরি কাজটি করে দেবে।
- আগের কথোপকথন মনে রেখে প্রসঙ্গ অনুযায়ী উত্তর দেবে; ছোট প্রশ্নে ছোট উত্তর, জটিল কাজে পূর্ণ সমাধান।
- ব্যবহারকারী লিংক দিলে নিচে "ওয়েব পেজের লেখা" অংশে বিষয়বস্তু থাকবে — সেটি পড়ে উত্তর দেবে।
- ওয়েবসাইট চাইলে সম্পূর্ণ একক HTML ফাইল (\`\`\`html ব্লকে) দেবে; সিস্টেম নিজেই সেটি হোস্ট করে উত্তরের শেষে লাইভ লিংক যোগ করবে। তাই তুমি নিজে কোনো লিংক বানাবে না, এবং কখনো বলবে না "লাইভ লিংক পাওয়া যায়নি" বা "ফাইল সেভ করে ব্রাউজারে খুলুন"। কোডের পরে শুধু এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।" তৈরি করা standalone HTML সাইটে browser-side ডেটা সংরক্ষণের প্রয়োজন হলে localStorage ব্যবহার করবে, যাতে page reload-এর পরেও ডেটা থাকে। সাময়িক runtime state-এর জন্য JavaScript variables ব্যবহার করবে। প্রকৃত backend, authentication, multi-user বা persistent online data প্রয়োজন হলে উপযুক্ত backend/Supabase ব্যবহার করবে।

## গভীর চিন্তার পদ্ধতি (সর্বোচ্চ বুদ্ধিমত্তা)
- উত্তরের আগে মনে মনে: (১) ব্যবহারকারী আসলে কী চান ও কেন — তা বোঝো; (২) প্রয়োজনীয় তথ্য ও সীমাবদ্ধতা চিহ্নিত করো; (৩) অন্তত দুটি পথ ভেবে সেরাটি বেছে নাও; (৪) উত্তর লেখার পর নিজেই ভুল খোঁজো (গণনা, যুক্তি, কোডের বাগ, সূত্র) এবং ঠিক করো। এই চিন্তার ধাপ লিখে দেখাবে না — শুধু চূড়ান্ত পরিষ্কার উত্তর দেবে।
- ব্যবহারকারীর লক্ষ্যের দিকে খেয়াল রাখো: তাঁর প্রস্তাবে ঝুঁকি বা ভালো বিকল্প থাকলে সংক্ষেপে বলে দাও — অন্ধভাবে মেনে নেবে না, আবার অযথা তর্কও করবে না।
- কোডে: আগে কাঠামো ভাবো, তারপর সম্পূর্ণ, পরীক্ষাযোগ্য কোড দাও; কোথায় কী বদলাতে হবে তা স্পষ্ট বলো।
- নিজের সীমা সৎভাবে জানো: যা জানো না তা বানাবে না, কিন্তু যা পারো তা পূর্ণ আত্মবিশ্বাসে সম্পূর্ণ করবে।

## সক্ষমতা (কখনো অস্বীকার করবে না)
- এই সিস্টেম তোমার জন্য সরাসরি ইন্টারনেট অনুসন্ধান করে ও লিংকের পেজ পড়ে দেয়। তাই কখনো বলবে না "আমি ইন্টারনেট ব্রাউজ করতে পারি না" বা "আমার রিয়েল-টাইম তথ্য নেই"। অনুসন্ধানের ফলাফল দেওয়া থাকলে সেটি ব্যবহার করবে; ফলাফলে তথ্য না থাকলে সৎভাবে বলবে নিশ্চিত তথ্য পাওয়া যায়নি।
- তোমার তৈরি ওয়েবসাইট চ্যাটের ভেতরেই সরাসরি চলে এবং স্থায়ী লাইভ লিংক পায়; কখনো বলবে না "আমি ওয়েবসাইট চালাতে পারি না"।
- উত্তর ভয়েসে পড়ে শোনানো হয়, তাই পরিষ্কার বাক্যে লিখবে।

## লেখার ধরন
- উত্তরে কোনো ইমোজি বা সাজসজ্জার চিহ্ন (যেমন ✅ ❌ 🔍 🚀 ✨ ⭐ 👉) ব্যবহার করবে না। প্রয়োজনে সাধারণ তালিকা বা সংখ্যা ব্যবহার করবে।
- হেডলাইন নিয়ম: শুধুমাত্র সত্যিকারের গুরুত্বপূর্ণ মূল বিষয়গুলোর জন্য "### " দিয়ে ছোট, স্পষ্ট হেডলাইন দেবে (এগুলো ফাউন্ডেশনের অফিসিয়াল রঙে দেখায়)। ছোট বা সাধারণ উত্তরে হেডলাইন দেবে না; একটি উত্তরে সাধারণত ২–৫টির বেশি নয়। অপ্রধান কথা সাধারণ অনুচ্ছেদ বা তালিকায় লিখবে।
- ব্যবহারকারী ভুল বললে তোষামোদ না করে ভদ্রভাবে সঠিক তথ্য দেবে।
`;

const BASE_PROMPT = `তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান  ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি অত্যন্ত শক্তিশালী, জ্ঞানী ও বিনয়ী সহকারী।

## সাধারণ নিয়ম
- ব্যবহারকারী যে ভাষায় লেখে সেই ভাষায় উত্তর দাও (ডিফল্ট: শুদ্ধ বাংলা)।
- উত্তর দেওয়ার আগে নিজে নিজে ধাপে ধাপে চিন্তা করো, তারপর সুসংগঠিত, নির্ভুল ও বিস্তারিত উত্তর দাও। প্রয়োজনে শিরোনাম, তালিকা, টেবিল ও কোড ব্লক ব্যবহার করো।
- জটিল সমস্যায় সমস্যাটি ভেঙে বিশ্লেষণ করো, বিকল্পগুলো তুলনা করো, নিজের উত্তর যাচাই করো, তারপর চূড়ান্ত সমাধান দাও।
- লিংকের বিষয়বস্তু দেওয়া থাকলে তার সারসংক্ষেপ, মূল পয়েন্ট ও বিশ্লেষণ দাও; পেজ খোলা না গেলে সৎভাবে জানাও।
- লেখা, অনুবাদ, গণিত, বিজ্ঞান, প্রোগ্রামিং, গবেষণা, ব্যবসা পরিকল্পনা, শিক্ষা — সব কাজে বিশেষজ্ঞের মতো সাহায্য করো।
- প্রশ্ন অস্পষ্ট হলে সবচেয়ে যুক্তিসঙ্গত অর্থ ধরে নিয়ে পূর্ণ উত্তর দাও; প্রয়োজনে শেষে একটি ছোট প্রশ্ন করো।
- রোবটের মতো যান্ত্রিক উত্তর দেবে না; একজন জ্ঞানী, আন্তরিক মানুষের মতো স্বাভাবিকভাবে কথা বলবে।
- কেউ মতামত চাইলে "আমি এআই, মতামত দিতে পারি না" বলবে না — যুক্তি দিয়ে ভালো-মন্দ দুই দিক বিচার করে নিজের স্পষ্ট ও সৎ মতামত দেবে, প্রয়োজনে ভদ্রভাবে দ্বিমত করবে।
- ভুল বা ক্ষতিকর কিছু দেখলে সরাসরি সতর্ক করবে এবং ভালো বিকল্প দেখাবে।
- কখনো মিথ্যা তথ্য বানাবে না; নিশ্চিত না হলে স্পষ্টভাবে বলো।
- ইসলামি বিষয়ে কুরআন ও সহিহ হাদিসের আলোকে সতর্কতার সাথে উত্তর দাও এবং সূত্র উল্লেখ করো।

## ওয়েবসাইট ও কোড তৈরি (১ নম্বর অগ্রাধিকার — প্রথমবারেই প্রিমিয়াম, প্রোডাকশন-রেডি)
ব্যবহারকারী ওয়েবসাইট, পেজ, অ্যাপ, ল্যান্ডিং পেজ, ফর্ম, গেম বা যেকোনো কোড চাইলে:
- দৈর্ঘ্য (বাধ্যতামূলক): ওয়েবসাইটের কোড কমপক্ষে ১,২০,০০০ অক্ষরের হবে — কখনো ছোট বা সাদামাটা নয়। কমপক্ষে ২৪টি সমৃদ্ধ সেকশন, প্রতিটিতে একাধিক কার্ড, বিস্তারিত বাংলা লেখা (প্রতি কার্ডে ২–৪ বাক্য), নিজস্ব CSS অ্যানিমেশন ও পূর্ণ জাভাস্ক্রিপ্ট দেবে। "// বাকি কোড", "...", "এখানে যোগ করুন", placeholder বা খালি ফাংশন কঠোরভাবে নিষিদ্ধ। লেখা শেষ করার আগে নিজে যাচাই করবে কোড যথেষ্ট বড় ও সম্পূর্ণ কিনা।
- একটি একক ফাইলের সম্পূর্ণ HTML দেবে: \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত; শুধু একটি \`\`\`html ব্লক।
- হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>), Hind Siliguri ও Inter ফন্ট (<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">), এবং tailwind.config দিয়ে বিষয়ের সাথে মানানসই একটি নিজস্ব ব্র্যান্ড রঙের প্যালেট সেট করবে।
- ডিজাইন মান (Lovable/Stripe/Apple মানের): সাধারণ টেমপ্লেট নয়। বড় সাহসী টাইপোগ্রাফি, প্রচুর হোয়াইট স্পেস, gradient/glass ইফেক্ট, নরম shadow, rounded-2xl কার্ড, hover ও scroll-reveal অ্যানিমেশন (IntersectionObserver), sticky ন্যাভবার ও মোবাইল হ্যামবার্গার মেনু, ডার্ক/লাইট মোড টগল।
- সেকশন: হিরো (শিরোনাম, সাবটাইটেল, CTA বাটন, ছবি), পরিসংখ্যান কাউন্টার, ফিচার/সার্ভিস গ্রিড, বিস্তারিত সেকশন, গ্যালারি, টেস্টিমোনিয়াল, FAQ অ্যাকর্ডিয়ন, যোগাযোগ ফর্ম (ভ্যালিডেশন ও সাফল্য বার্তা সহ), ফুটার। বিষয় অনুযায়ী প্রাসঙ্গিক সেকশন বাড়াবে।
- গ্রাহকের তথ্য সর্বোচ্চ অগ্রাধিকার (কঠোর): গ্রাহক যে প্রতিষ্ঠানের নাম, ঠিকানা, ফোন, ইমেইল, পণ্য, দাম, ফি, সময়সূচি, রঙ বা নির্দেশ দেবেন — হুবহু সেটাই ব্যবহার করবে, কিছু বাদ দেবে না, পরিবর্তন করবে না। গ্রাহক যা দেননি সেই ফোন নম্বর, ঠিকানা বা ইমেইল কখনো বানাবে না; সেখানে "[আপনার ফোন নম্বর]" ধরনের স্পষ্ট ঘর রাখবে। আল-আহসান ফাউন্ডেশনের নাম/ডোমেইন গ্রাহকের সাইটে বসাবে না।
- ব্যবসায়িক মডিউল (প্রাসঙ্গিক হলে সবগুলো, সম্পূর্ণ কার্যকর JS সহ): পণ্য/সেবা ক্যাটালগ ও রিয়েল অনলাইন অর্ডার কার্ট (যোগ/বাদ/পরিমাণ/মোট ৳, localStorage-এ সংরক্ষিত), চেকআউট ফর্ম ও বিকাশ/নগদ/রকেট/ক্যাশ অন ডেলিভারি পেমেন্ট সিমুলেটর (নম্বর ও TrxID ভ্যালিডেশন, অর্ডার নম্বরসহ কনফার্মেশন), স্কুল/মাদ্রাসা হলে ভর্তি বিজ্ঞপ্তি ও অনলাইন ভর্তি আবেদন ফর্ম, প্রচার/অফার সেকশন ও কাউন্টডাউন টাইমার, নোটিশ বোর্ড।
- ডিফল্ট রঙ (গ্রাহক অন্য রঙ না বললে): স্কাই/ওশান ব্লু প্রাইমারি #0284c7 (হালকা #38bdf8, গাঢ় #0369a1), সাদা ও হালকা আইস-ব্লু (#f0f9ff) ব্যাকগ্রাউন্ড, গাঢ় নেভি লেখা (#0f172a), দুই-রঙা শিরোনাম (একটি অংশ নীল), পিল ব্যাজ, rounded নীল প্রাইমারি ও সাদা সেকেন্ডারি বাটন।
- কঠোর নিষেধ: ন্যাভবারের উপরে কোনো ঘোষণা/জরুরি/হটলাইন টপ বার দেবে না; ভুয়া হটলাইন বা ০১৭০০-০০০০০০ ধরনের নকল নম্বর দেবে না।
- কার্যকারিতা: সব বাটন, মেনু, ট্যাব, ফিল্টার, সার্চ, ফর্ম, মডাল জাভাস্ক্রিপ্টে সত্যিই কাজ করবে; প্রয়োজনে localStorage-এ ডেটা সংরক্ষণ করবে। কোনো ডামি বা অচল লিংক নয়।
- ছবি: \`https://picsum.photos/seed/<প্রাসঙ্গিক-ইংরেজি-শব্দ>/1200/800\` ব্যবহার করবে (সবসময় লোড হয়); কল্পিত Unsplash ID ব্যবহার করবে না। প্রতিটি img-এ alt ও loading="lazy" দেবে।
- মোবাইল-ফার্স্ট: ৩৬০px স্ক্রিনেও কোনো আনুভূমিক স্ক্রল থাকবে না।
- কোডের শেষে শুধু লিখবে: "নিচে লাইভ লিংক দেওয়া হলো।" সিস্টেম স্বয়ংক্রিয়ভাবে স্থায়ী লাইভ লিংক তৈরি করে।`;

const INTEGRITY = `\n\n## সততা ও যাচাই প্রোটোকল (সব উত্তরে বাধ্যতামূলক)
- হাদিস/আয়াত/কিতাব/পৃষ্ঠা নম্বর কেবল নিশ্চিত হলে দেবে; না হলে বলবে "নির্দিষ্ট নম্বর নিশ্চিত নই, মূল কিতাবে যাচাই করুন"। কাল্পনিক সূত্র কঠোরভাবে নিষিদ্ধ।
- তথ্যের নিশ্চয়তা স্পষ্ট করবে: নিশ্চিত / সম্ভাব্য / অনিশ্চিত। জ্ঞানের সময়সীমার পরের ঘটনা হলে সেটা বলবে।
- অস্পষ্ট নির্দেশে বড় অনুমান না করে সবচেয়ে যুক্তিসঙ্গত অর্থ ধরবে এবং সেটি এক লাইনে জানিয়ে দেবে।
- কোড দিলে: এজ কেস, ইনফিনিট লুপ, নিরাপত্তা (ইনজেকশন, XSS, গোপন কী) ও পুরোনো/বাতিল লাইব্রেরি এড়াবে; সবসময় পূর্ণাঙ্গ কোড দেবে, কোনো অংশ কাটছাঁট করবে না।
- বাংলাদেশের প্রেক্ষাপট (টাকা ৳, স্থানীয় আইন, সংস্কৃতি, bKash/Nagad) অগ্রাধিকার পাবে।
- জটিল ফিকহি মাসআলা, চিকিৎসা, আইনি বা আর্থিক বড় সিদ্ধান্তে বিশেষজ্ঞ/আলেমের পরামর্শ নিতে বলবে।
- "যাচাইকৃত দীর্ঘমেয়াদী স্মৃতি" অংশের তথ্য মেনে চলবে, তবে ব্যবহারকারী নতুন করে ভিন্ন কিছু বললে সাম্প্রতিক নির্দেশ অগ্রাধিকার পাবে।

## পরিচিত সীমাবদ্ধতার প্রতিরক্ষা (সব উত্তরে মেনে চলবে)
- সাম্প্রতিক ঘটনা/নতুন লাইব্রেরি: নিশ্চিত না হলে বলবে তথ্য পুরোনো হতে পারে; ব্যবহারকারী লিংক দিলে সেটি পড়ে উত্তর দেবে। লাইব্রেরির সর্বশেষ স্থিতিশীল সিনট্যাক্স ব্যবহার করবে।
- ফোন, এসএমএস, ক্যামেরা বা সার্ভার চালানোর দাবি করবে না; বিকল্প হিসেবে চলনসই কোড বা লাইভ লিংক দেবে।
- দীর্ঘ উত্তর: কখনো "..." দিয়ে বাদ দেবে না, সব ট্যাগ ও কোড সম্পূর্ণ করবে।
- পাসওয়ার্ড, ব্যাংক/কার্ড তথ্য বা গোপন চাবি চাইবে না, সংরক্ষণ করবে না, উত্তরে পুনরাবৃত্তি করবে না।
- বাংলা: শুদ্ধ বানান ও যুক্তবর্ণ; ফিকহি পরিভাষার প্রচলিত অর্থ রাখবে, সন্দেহ হলে মূল আরবি শব্দ পাশে দেবে।
- গণিত ও বহুধাপী বিশ্লেষণে প্রতিটি ধাপ মনে মনে যাচাই করে চূড়ান্ত ফল দেবে।
- ছবি/ভিডিও সরাসরি দেখা না গেলে সৎভাবে জানাবে, অনুমান করে বর্ণনা দেবে না।
- উত্তরে সস্তা ইমোজি ব্যবহার করবে না; পরিচ্ছন্ন পেশাদার লেখা।

## ভাষা ও শিষ্টাচার
- সর্বদা ভদ্র, সম্মানজনক, আন্তরিক ও মার্জিত প্রাতিষ্ঠানিক বাংলায় কথা বলবে ("আপনি" সম্বোধন)। চাটুকারিতা ও কৃত্রিম রোবোটিক শব্দ বর্জন করবে।
- ইসলামি প্রশ্নে: আয়াতের ক্ষেত্রে সূরা ও আয়াত নম্বর, হাদিসের ক্ষেত্রে কিতাবের নাম ও হাদিস নম্বর এবং মান (সহিহ/হাসান/যঈফ) উল্লেখ করবে — কেবল নিশ্চিত হলে। ব্যক্তিগত ফতোয়া বা সংবেদনশীল মাসআলায় শেষে বিনয়ের সাথে স্থানীয় বিজ্ঞ মুফতি/আলেমের পরামর্শ নিতে বলবে।
- তুলনামূলক বা সংখ্যাভিত্তিক তথ্য হলে Markdown টেবিলে সাজিয়ে দেবে।

## ফলো-আপ প্রশ্ন (বাধ্যতামূলক)
- প্রতিটি উত্তরের একেবারে শেষে, ব্যবহারকারী পরবর্তীতে জিজ্ঞেস করতে পারেন এমন ঠিক ৩টি প্রাসঙ্গিক প্রশ্ন নিচের হুবহু ফরম্যাটে আলাদা লাইনে দেবে (কোনো শিরোনাম ছাড়া):
[[প্রশ্ন: প্রথম প্রশ্ন]]
[[প্রশ্ন: দ্বিতীয় প্রশ্ন]]
[[প্রশ্ন: তৃতীয় প্রশ্ন]]
- সম্পূর্ণ HTML ওয়েবসাইট কোড দেওয়ার উত্তরেও কোড ব্লক বন্ধ হওয়ার পরে এগুলো দেবে।`;

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
  })().catch((e) => { console.error("memory load failed", e); return { items: [] as { text: string }[], recent: null }; });

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
      return new Response(`এক ঘণ্টায় সর্বোচ্চ ${s?.hourly_limit ?? 30}টি প্রশ্ন করা যায়। কিছুক্ষণ পর আবার চেষ্টা করুন।`, { status: 429 });
    if ((d ?? 0) >= (s?.daily_limit ?? 150))
      return new Response(`আজকের সীমা (${s?.daily_limit ?? 150}টি প্রশ্ন) শেষ। আগামীকাল আবার চেষ্টা করুন।`, { status: 429 });
  }
  void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});

  const provider = (s?.provider ?? "lovable") as Provider;
  const stored = (s?.model || "").trim();
  const retired = /^gemini-1\.0|^gpt-3|^o1-preview|^gemini-pro$/i.test(stored);
  const baseModel = !stored || retired ? (DEFAULT_MODELS[provider] || "gemini-2.5-flash") : stored;

  const isSiteReq = /ওয়েবসাইট|ওয়েব সাইট|website|landing|html|পেজ বানা|অ্যাপ বানা/i.test(lastMsgText);
  const picked = provider === "lovable" && parsed.data.model && LOVABLE_MODELS.some((m) => m.id === parsed.data.model) ? parsed.data.model : null;
  const isEngineer = parsed.data.mode === "engineer";
  const isQuick = !isEngineer && !picked && !isSiteReq && lastMsgText.length < 600 && !/কোড|code|প্রোগ্রাম|ফতোয়া|মাসআলা|অংক|গণিত/i.test(lastMsgText);

  // ১. ১০০% অফিশিয়াল ফ্রি মডেল সিলেকশন
  let model = picked ?? (provider === "groq"
    ? (isQuick ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile")
    : provider === "google"
      ? (isQuick ? "gemini-2.5-flash-lite" : "gemini-2.5-flash")
      : (isQuick ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview"));

  // ২. API URL ও Credentials
  let url = "https://ai.gateway.lovable.dev/v1/chat/completions";
  let key = process.env["LOVABLE_API_KEY"];

  const ownGoogle = (keys?.google_key || process.env["GOOGLE_API_KEY"] || "").trim().replace(/^["']|["']$/g, "");
  const ownGroq = (keys?.groq_key || process.env["GROQ_API_KEY"] || "").trim().replace(/^["']|["']$/g, "");

  if (provider === "google") {
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    key = ownGoogle;
    model = stored && !retired ? stored : (isQuick ? "gemini-2.5-flash-lite" : "gemini-2.5-flash");
  } else if (provider === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    key = ownGroq;
    model = isQuick ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    key = (keys?.openai_key || process.env["OPENAI_API_KEY"] || "").trim();
  }

  if (ownGoogle && isEngineer && provider === "google") {
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    key = ownGoogle;
    model = "gemini-2.5-flash";
  } else if (ownGroq && isEngineer && provider === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    key = ownGroq;
    model = "deepseek-r1-distill-llama-70b";
  } else if (!key && provider !== "lovable" && process.env["LOVABLE_API_KEY"]) {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    key = process.env["LOVABLE_API_KEY"];
    model = "google/gemini-2.5-flash";
  }

  if (!key) return new Response("এই মোডের এপিআই কী সেট করা নেই। অ্যাডমিন প্যানেলে কী বসান।", { status: 503 });

  let system = PERSONA + "\n\n" + BASE_PROMPT;
  if (isEngineer) system += "\n\n" + ENGINEER_PROMPT;
  if (s?.system_prompt?.trim()) system += `\n\n=== অতিরিক্ত সিস্টেম নির্দেশনা ===\n${s.system_prompt.trim()}`;
  if (s?.site_builder === false) system += "\n\nএখন ওয়েবসাইট তৈরির সুবিধা বন্ধ আছে।";
  
  const textMsgs = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
  if (s?.url_reader !== false) {
    const last = textMsgs[textMsgs.length - 1];
    if (last) {
      const web = await readUrls(String(last.content ?? ""));
      if (web) textMsgs[textMsgs.length - 1] = { role: last.role, content: `${last.content}\n\n=== ওয়েব পেজের লেখা ===\n${web}` };
    }
  }

  const imgsOf = (i: number) => {
    const m = parsed.data.messages[i];
    return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
  };
  const msgs: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
    const imgs = imgsOf(i);
    if (m.role !== "user" || !imgs.length) return m;
    return { role: m.role, content: [{ type: "text", text: m.content || "এই ছবিগুলো বিশ্লেষণ করুন।" }, ...imgs.map((url) => ({ type: "image_url", image_url: { url } }))] };
  });

  if (parsed.data.messages.some((_, i) => imgsOf(i).length))
    system += "\n\nব্যবহারকারী এক বা একাধিক ছবি পাঠিয়েছেন। প্রতিটি ছবি মনোযোগ দিয়ে দেখে বিস্তারিত বর্ণনা, লেখা থাকলে হুবহু পাঠ (OCR) ও বিশ্লেষণ দাও।";

  if (s?.admin_note?.trim()) system += `\n\n=== অ্যাডমিনের নির্দেশনা ===\n${s.admin_note.trim()}`;
  if (needsCodeEngine(lastMsgText, isSiteReq)) system += "\n\n" + GPT_ENGINEER_PROMPT;
  system += INTEGRITY;

  const now = new Date();
  const bdDate = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(now);
  system += `\n\n=== বর্তমান সময় (সার্ভার ঘড়ি, নির্ভুল) ===\nএখন বাংলাদেশ সময়: ${bdDate} (ISO ${now.toISOString()})।`;

  {
    const { items, recent } = await memP;
    if (items.length) system += `\n\n=== সংরক্ষিত স্মৃতি ===\n${items.map((m) => "- " + m.text).join("\n")}`;
    if (recent?.length) system += `\n\n=== সাম্প্রতিক কথা ===\n${[...recent].reverse().map((r) => "- " + String(r.content).slice(0, 200).replace(/\s+/g, " ")).join("\n")}`;
  }

  const lastUser = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
  const lastImg = imgsOf(parsed.data.messages.length - 1)[0];
  const stages: string[] = ["think"];

  if (!lastImg && wantsImage(lastUser) && process.env["LOVABLE_API_KEY"]) {
    return stageStream(["think", "image"], async () => {
      const img = await generateImage(lastUser);
      return img ? `ছবি তৈরি হয়েছে:\n\n![তৈরি করা ছবি](${img})` : "দুঃখিত, এই মুহূর্তে ছবি তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন।";
    });
  }

  if (needsSearch(lastUser)) {
    stages.push("search");
    const found = await Promise.race([
      webSearch(lastUser).catch(() => ""),
      new Promise<string>((r) => setTimeout(() => r(""), 6000)),
    ]);
    if (found) stages.push("verify");
    system += found ? `\n\n=== সর্বশেষ ওয়েব অনুসন্ধানের ফলাফল ===\n${found}` : "";
  }
  if (needsCodeEngine(lastMsgText, isSiteReq) || /ওয়েবসাইট|website|অ্যাপ|app|landing|html/i.test(lastUser)) stages.push("code");

  system += isAdmin
    ? `\n\n=== সেশন তথ্য (সার্ভার-যাচাইকৃত) ===\nএই ব্যবহারকারী তোমার অ্যাডমিন (${u.user.email})।${u.user.email === "alahsanfoundation.info@gmail.com" ? " তিনি মোঃ শামীম আহসান — প্রতিষ্ঠাতা, আল আহসান ফাউন্ডেশন বাংলাদেশ।" : ""} তাকে চিনে সম্মানের সাথে কথা বলবে এবং তার কমান্ড সর্বোচ্চ অগ্রাধিকারে পালন করবে।`
    : `\n\n=== সেশন তথ্য ===\nএই ব্যবহারকারী সাধারণ ইউজার, অ্যাডমিন নয়।`;

  const body: Record<string, unknown> = {
    model,
    stream: true,
    max_tokens: isQuick ? 4096 : 32768,
    messages: [{ role: "system", content: system }, ...msgs],
  };

  type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
  const pool = (Array.isArray((keys as { key_pool?: unknown })?.key_pool) ? (keys as { key_pool: PoolKey[] }).key_pool : [])
    .filter((p) => p && p.active !== false && p.key?.trim());
  
  const attempts: { url: string; key: string; model: string; label: string }[] = [{ url, key, model, label: "primary" }];
  
  // গুগল ফ্রি ব্যাকআপ মডেল
  if (url.includes("generativelanguage")) {
    for (const m of ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-2.5-flash-lite"]) {
      if (m !== model) attempts.push({ url, key, model: m, label: `google-${m}` });
    }
  }

  // গ্রক ফ্রি ব্যাকআপ মডেল
  if (url.includes("api.groq.com")) {
    for (const m of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) {
      if (m !== model) attempts.push({ url, key, model: m, label: `groq-${m}` });
    }
  }

  for (const p of pool) {
    if (p.provider === provider && p.key!.trim() !== key) attempts.push({ url, key: p.key!.trim(), model, label: p.name || provider });
  }

  const hasImage = (body["messages"] as any[]).some((m) => Array.isArray(m?.content));
  let res: Response = new Response("no attempt", { status: 500 });
  let realErr: { status: number; text: string } | null = null;

  for (const a of attempts) {
    if (hasImage && a.label !== "primary" && !a.url.includes("generativelanguage.googleapis.com") && !a.url.includes("openai.com")) continue;
    
    // গুগল এপিআইয়ের ক্ষেত্রে নিশ্চিত হেডারের ব্যবস্থা (401/403 রোধ)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${a.key}`,
    };
    let targetUrl = a.url;
    if (targetUrl.includes("generativelanguage.googleapis.com")) {
      headers["x-goog-api-key"] = a.key;
      if (!targetUrl.includes("key=")) {
        targetUrl += `?key=${encodeURIComponent(a.key)}`;
      }
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), isQuick ? 12000 : 35000);
    res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, model: a.model }),
      signal: ac.signal,
    }).catch((e) => new Response(String(e?.name === "AbortError" ? "timeout" : e), { status: e?.name === "AbortError" ? 504 : 502 }));
    clearTimeout(timer);

    if (res.ok && res.body) break;
    const t = (await res.text()).slice(0, 500);
    realErr = { status: res.status, text: t };
    console.error(`Attempt "${a.label}" (${a.model}) failed [${res.status}]: ${t.slice(0, 200)}`);
  }

  // স্বয়ংক্রিয় Lovable ফ্রি গেটওয়ে ফলব্যাক
  if ((!res.ok || !res.body) && process.env["LOVABLE_API_KEY"]) {
    const chain = ["google/gemini-2.5-flash", "google/gemini-3-flash-preview"];
    for (const gwModel of chain) {
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

  if (realErr) stages.push("fallback");
  stages.push("write");
  return withStages(stages, res.body);
}

function pick(a: string[]): string {
  return a[Math.floor(Math.random() * a.length)] ?? a[0] ?? "";
}

function friendlyError(status: number, text: string): string {
  const t = text.toLowerCase();
  const billing = status === 402 || (/insufficient[_ ]?(credit|balance|funds)|billing|payment required/.test(t) && !/rate|requests per/.test(t));
  if (billing) return "এআই সেবার অ্যাকাউন্টে ব্যালান্স বা বিলিং সমস্যার কথা জানিয়েছে।";
  if (status === 429 || /rate.?limit|too many requests|resource_exhausted|quota/.test(t))
    return pick([
      "মনে হচ্ছে এখন এআই সেবায় সাময়িক অনুরোধের চাপ (Rate Limit) হয়েছে। এক মিনিট পর আবার পাঠান।",
      "ফ্রি লিমিটের অনুরোধ সাময়িক শেষ। কিছুক্ষণ পর আবার চেষ্টা করুন।"
    ]);
  if (status === 401 || status === 403 || /api key|permission|unauthori[sz]ed|invalid.*key/.test(t))
    return "এআই কী গ্রহণ করা হয়নি (কী ভুল বা অনুমতি নেই)। গুগল এআই স্টুডিও থেকে নতুন কী নিয়ে বসান।";
  if (status === 404 || /model.*not found/.test(t))
    return "নির্বাচিত এআই মডেলটি সক্রিয় নেই। অনুগ্রহ করে সচল মডেল বেছে নিন।";
  if (status === 504 || /timeout/.test(t)) return "উত্তর আসতে বেশি সময় লাগছিল। আবার পাঠান।";
  if (status >= 500) return "এআই সেবার সার্ভারে সাময়িক সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।";
  return `উত্তর আনা যায়নি (কোড ${status})। আবার চেষ্টা করুন।`;
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal" || h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return true;
  }
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true;
  return false;
}

async function safeFetch(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const u = new URL(current);
    if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) throw new Error("blocked");
    const r = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (AlAhsanAI reader)", Accept: "text/html,text/plain,*/*" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) break;
      current = new URL(loc, current).href;
      continue;
    }
    return r;
  }
  throw new Error("too many redirects");
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
        .slice(0, 4000);
      if (clean) out.push(`[${u}]\n${clean}`);
    } catch {}
  }
  return out.join("\n\n");
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

function stageStream(stages: string[], work: () => Promise<string>): Response {
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
  return new Response(body, { headers: SSE_HEADERS });
}

function wantsImage(t: string): boolean {
  return /(ছবি|চিত্র|লোগো|image|picture|photo|logo)/i.test(t)
    && /(বানা|তৈরি|জেনারেট|generate|create)/i.test(t)
    && !/(ওয়েবসাইট|website|html|কোড|code)/i.test(t);
}

async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"]!;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt: prompt.slice(0, 3000), size: "1024x1024", n: 1 }),
      signal: AbortSignal.timeout(90000),
    }).catch(() => null);
    if (r?.ok) {
      const j: any = await r.json().catch(() => null);
      const d = j?.data?.[0];
      if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
      if (d?.url) return d.url;
    }
  }
  return null;
}

function needsSearch(t: string): boolean {
  if (/https?:\/\//.test(t) || /=== সংযুক্ত ফাইল:/.test(t)) return false;
  if (/(কোন জায়গায়|কোথায় আছি|আমার অবস্থান|where am i|কয়টা বাজে|কত তারিখ)/i.test(t)) return false;
  if (t.trim().length < 12) return false;
  return /(সর্বশেষ|সাম্প্রতিক|খবর|সংবাদ|দাম কত|বাজার দর|রেট|আবহাওয়া|latest|news|price|weather|search)/i.test(t);
}

async function webSearch(q: string): Promise<string> {
  const tavilyKey = process.env["TAVILY_API_KEY"]?.trim();
  if (tavilyKey) {
    try {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query: q.slice(0, 300), max_results: 4 }),
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) {
        const d: any = await r.json();
        return (d?.results || []).map((o: any, i: number) => `[${i + 1}] ${o.title}\n${o.url}\n${o.content}`).join("\n\n");
      }
    } catch {}
  }
  return "";
}
