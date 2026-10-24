export type Provider = "lovable" | "google" | "openai" | "groq" | "openrouter";

export const LOVABLE_MODELS = [
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra (Default, Intelligent & Multimodal)" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
];

export const GOOGLE_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Default, Fast & Multimodal)" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Ultra-fast)" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Balanced & Efficient)" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Deep Reasoning & Analysis)" },
];

// Groq text models from live documentation (all verified free tier)
export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Groq Free Tier)" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Groq Free Tier, Ultra-Fast)" },
  { id: "openai/gpt-oss-120b", label: "OpenAI GPT-OSS 120B (Groq)" },
  { id: "openai/gpt-oss-20b", label: "OpenAI GPT-OSS 20B (Groq)" },
  { id: "qwen/qwen3-32b", label: "Qwen3 32B (Groq, Reasoning)" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B (Groq)" },
];

// OpenRouter zero-price models verified from public catalogue
export const OPENROUTER_MODELS = [
  { id: "openrouter/free", label: "Free Models Router (Automatic Free Routing)" },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "NVIDIA Nemotron 3 Nano Omni Reasoning (free)" },
  { id: "google/gemma-4-31b-it:free", label: "Google Gemma 4 31B IT (free)" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "Google Gemma 4 26B A4B IT (free)" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Meta Llama 3.3 70B Instruct (free)" },
  { id: "meta-llama/llama-3.1-8b-instruct:free", label: "Meta Llama 3.1 8B Instruct (free)" },
  { id: "cohere/north-mini-code:free", label: "Cohere North Mini Code (free)" },
  { id: "nvidia/nemotron-3.5-lightning:free", label: "NVIDIA Nemotron 3.5 Lightning (free)" },
  { id: "liquid/lfm-2.5-2.6b:free", label: "Liquid LFM 2.5 2.6B (free)" },
  { id: "recursive/flint-v1.0:free", label: "Recursive Flint (free)" },
  { id: "xingchen-agi/xing4.0-29b-a4b:free", label: "XingChen 4.0 29B A4B (free)" },
  { id: "dots-studio/dots-3-note-preview:free", label: "Dots 3 Note Preview (free)" },
];

export const OPENAI_MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-4.1", label: "GPT-4.1" },
];

export const DEFAULT_MODELS: Record<Provider, string> = {
  lovable: "openai/gpt-6-astra",
  google: "gemini-2.0-flash",
  openai: "gpt-4o",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openrouter/free",
};

export const ALL_AVAILABLE_MODELS = [
  ...LOVABLE_MODELS.map((m) => ({ ...m, provider: "lovable" as Provider })),
  ...GOOGLE_MODELS.map((m) => ({ ...m, provider: "google" as Provider })),
  ...OPENAI_MODELS.map((m) => ({ ...m, provider: "openai" as Provider })),
  ...GROQ_MODELS.map((m) => ({ ...m, provider: "groq" as Provider })),
  ...OPENROUTER_MODELS.map((m) => ({ ...m, provider: "openrouter" as Provider })),
];
