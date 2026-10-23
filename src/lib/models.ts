export type Provider = "lovable" | "google" | "openai";

export const LOVABLE_MODELS = [
  { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash (Default, Fast & Multimodal)" },
  { id: "google/gemini-1.5-pro", label: "Gemini 1.5 Pro (Deep Reasoning & Analysis)" },
  { id: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Ultra-fast)" },
  { id: "google/gemini-1.5-flash", label: "Gemini 1.5 Flash (Balanced & Efficient)" },
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
];

export const GOOGLE_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Default, Fast & Multimodal)" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Deep Reasoning & Analysis)" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Ultra-fast)" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Balanced & Efficient)" },
];

export const OPENAI_MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-4.1", label: "GPT-4.1" },
];

export const DEFAULT_MODELS: Record<Provider, string> = {
  lovable: "google/gemini-2.0-flash",
  google: "gemini-2.0-flash",
  openai: "gpt-4o",
};
