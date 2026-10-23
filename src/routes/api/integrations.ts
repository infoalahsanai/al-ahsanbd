import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/integrations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "অনুমোদন নেই" }, { status: 401 });
        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) return Response.json({ error: "সার্ভার কনফিগারেশন অসম্পূর্ণ" }, { status: 500 });
        const auth = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: user, error } = await auth.auth.getUser(token);
        if (error || !user.user) return Response.json({ error: "লগইন করুন" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.user.id, _role: "admin" });
        if (!isAdmin) return Response.json({ error: "শুধু অ্যাডমিন" }, { status: 403 });

        const body = await request.json().catch(() => null);
        const index = Number(body?.index);
        if (!Number.isInteger(index) || index < 0 || index >= 10) return Response.json({ error: "ইন্টিগ্রেশন নির্বাচন সঠিক নয়" }, { status: 400 });
        const { data: keys, error: keyError } = await supabaseAdmin.from("ai_keys").select("key_pool").eq("id", 1).maybeSingle();
        if (keyError) return Response.json({ error: "ইন্টিগ্রেশন সেটিংস পড়া যায়নি" }, { status: 500 });
        const pool = Array.isArray(keys?.key_pool) ? keys.key_pool as Array<Record<string, unknown>> : [];
        const entry = pool[index];
        if (!entry || entry["active"] === false) return Response.json({ error: "ইন্টিগ্রেশন নেই বা বন্ধ আছে। আগে সেটিংস সংরক্ষণ করুন।" }, { status: 404 });

        const provider = String(entry["provider"] ?? "");
        const secret = typeof entry["key"] === "string" ? entry["key"].trim() : "";

        if (body?.action === "models" && (provider === "groq" || provider === "openrouter")) {
          try {
            if (provider === "openrouter") {
              const headers: Record<string, string> = {};
              if (secret) headers["Authorization"] = `Bearer ${secret}`;
              const response = await fetch("https://openrouter.ai/api/v1/models", { headers, signal: AbortSignal.timeout(12000) });
              if (!response.ok) return Response.json({ error: `OpenRouter model catalogue ত্রুটি (${response.status})` }, { status: 502 });
              const result = await response.json() as { data?: Array<{ id?: string; name?: string; pricing?: { prompt?: string | number; completion?: string | number } }> };
              const freeModels = (result.data ?? []).filter((model) => {
                if (!model.id) return false;
                if (model.id === "openrouter/free") return true;
                const pPrompt = Number(model.pricing?.prompt);
                const pComp = Number(model.pricing?.completion);
                return pPrompt === 0 && pComp === 0;
              }).map((m) => ({ id: m.id!, label: `${m.name || m.id} (free)` }));
              if (!freeModels.some((m) => m.id === "openrouter/free")) {
                freeModels.unshift({ id: "openrouter/free", label: "Free Models Router (automatic)" });
              }
              return Response.json({ ok: true, models: freeModels });
            } else {
              if (!secret) return Response.json({ error: "Groq API key দিন এবং সংরক্ষণ করুন; মডেল তালিকা key অনুযায়ী দেখানো হয়" }, { status: 400 });
              const response = await fetch("https://api.groq.com/openai/v1/models", {
                headers: { Authorization: `Bearer ${secret}` },
                signal: AbortSignal.timeout(10000),
              });
              if (!response.ok) return Response.json({ error: `Groq model catalogue ত্রুটি (${response.status})` }, { status: 502 });
              const result = await response.json() as { data?: Array<{ id?: string; active?: boolean; owned_by?: string }> };
              const models = (result.data ?? []).filter((m) => m.id && m.active !== false)
                .map((m) => ({ id: m.id!, label: `${m.id} (আপনার Groq account-এ উপলভ্য; free-tier quota পরিবর্তনশীল)` }));
              return Response.json({ ok: true, models });
            }
          } catch {
            return Response.json({ error: `${provider} model catalogue-এ সংযোগ করা যায়নি` }, { status: 502 });
          }
        }

        const city = typeof entry["model"] === "string" && entry["model"].trim() ? entry["model"].trim() : "Dhaka";
        const path = typeof entry["model"] === "string" && entry["model"].trim() ? entry["model"].trim().replace(/^\/+|\/+$/g, "") : "posts/1";
        let upstream: Response | null = null;
        try {
          if (provider === "weather") {
            if (!secret) return Response.json({ error: "OpenWeatherMap API key দিন এবং সংরক্ষণ করুন" }, { status: 400 });
            const startedAt = Date.now();
            upstream = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(secret)}&units=metric`, { signal: AbortSignal.timeout(10000) });
            const latencyMs = Date.now() - startedAt;
            if (upstream.ok) {
              const data = await upstream.json() as { name?: string; main?: { temp?: number }; weather?: Array<{ description?: string }> };
              const description = data.weather?.[0]?.description ?? "আবহাওয়ার তথ্য পাওয়া গেছে";
              return Response.json({ ok: true, signal: "online", latencyMs, message: `OpenWeatherMap সচল · ${data.name ?? city}: ${description}, ${typeof data.main?.temp === "number" ? `${Math.round(data.main.temp)}°C` : ""} · ${latencyMs} ms` });
            }
          } else if (provider === "google") {
            if (!secret) return Response.json({ error: "Google API key দিন এবং সংরক্ষণ করুন" }, { status: 400 });
            const model = typeof entry["model"] === "string" && entry["model"].trim() ? entry["model"].trim() : "gemini-2.0-flash";
            const startedAt = Date.now();
            upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret)}`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with OK." }] }], generationConfig: { maxOutputTokens: 8 } }), signal: AbortSignal.timeout(12000),
            });
            const latencyMs = Date.now() - startedAt;
            if (upstream.ok) return Response.json({ ok: true, signal: "online", latencyMs, message: `Google Gemini সচল · ${model} · ${latencyMs} ms` });
          } else if (provider === "openai") {
            if (!secret) return Response.json({ error: "OpenAI API key দিন এবং সংরক্ষণ করুন" }, { status: 400 });
            const model = typeof entry["model"] === "string" && entry["model"].trim() ? entry["model"].trim() : "gpt-4o";
            const startedAt = Date.now();
            upstream = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 8 }), signal: AbortSignal.timeout(12000),
            });
            const latencyMs = Date.now() - startedAt;
            if (upstream.ok) return Response.json({ ok: true, signal: "online", latencyMs, message: `OpenAI সচল · ${model} · ${latencyMs} ms` });
          } else if (provider === "custom") {
            return Response.json({ error: "Custom endpoint-এ সার্ভার probe নিরাপত্তার কারণে বন্ধ; সংরক্ষিত custom API chat routing-এ আগের মতোই ব্যবহারযোগ্য" }, { status: 400 });
          } else if (provider === "groq" || provider === "openrouter") {
            if (!secret) return Response.json({ error: `${provider} API key দিন এবং সংরক্ষণ করুন` }, { status: 400 });
            const model = typeof entry["model"] === "string" && entry["model"].trim()
              ? entry["model"].trim()
              : provider === "groq" ? "llama-3.3-70b-versatile" : "openrouter/free";
            const endpoint = provider === "groq"
              ? "https://api.groq.com/openai/v1/chat/completions"
              : "https://openrouter.ai/api/v1/chat/completions";
            const startedAt = Date.now();
            upstream = await fetch(endpoint, {
              method: "POST",
              headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 8 }),
              signal: AbortSignal.timeout(12000),
            });
            const latencyMs = Date.now() - startedAt;
            if (upstream.ok) {
              return Response.json({ ok: true, signal: "online", latencyMs, message: `${provider} সচল · ${model} · ${latencyMs} ms` });
            }
          } else if (provider === "jsonplaceholder") {
            if (!/^(posts|todos|users|comments|albums|photos)(\/\d+)?$/.test(path)) return Response.json({ error: "নিরাপদ পরীক্ষার path দিন: posts/1, todos/1 বা users/1" }, { status: 400 });
            const startedAt = Date.now();
            upstream = await fetch(`https://jsonplaceholder.typicode.com/${path}`, { signal: AbortSignal.timeout(10000) });
            const latencyMs = Date.now() - startedAt;
            if (upstream.ok) {
              const payload: unknown = await upstream.json();
              const preview = JSON.stringify(payload).slice(0, 80);
              return Response.json({ ok: true, signal: "online", latencyMs, message: `JSONPlaceholder সচল (${path}) · ${latencyMs} ms · ${preview}…` });
            }
          } else {
            return Response.json({ error: "প্রোভাইডার নির্বাচন সঠিক নয়" }, { status: 400 });
          }
        } catch {
          return Response.json({ error: "API-তে সংযোগ করা যায়নি; পরে আবার চেষ্টা করুন" }, { status: 502 });
        }
        const message = upstream?.status === 401 || upstream?.status === 403
          ? `${provider} API key ভুল, নিষ্ক্রিয় বা অনুমতি নেই`
          : upstream?.status === 402 ? `${provider} account-এ balance/credit দরকার`
          : upstream?.status === 429 ? `${provider} rate limit অতিক্রম হয়েছে`
          : provider === "weather" && upstream?.status === 404 ? "শহর পাওয়া যায়নি"
          : `${provider} ত্রুটি (${upstream?.status ?? "network"})`;
        return Response.json({ error: message }, { status: 502 });
      },
    },
  },
});
