// Code-generation instructions adapted from gpt-engineer (MIT, Anton Osika) preprompts:
// roadmap + philosophy + generate + file_format.
export const GPT_ENGINEER_PROMPT = `=== কোড জেনারেশন ইঞ্জিন (gpt-engineer পদ্ধতি) ===
তুমি একটি নির্দেশ পাবে যার জন্য কোড লিখতে হবে। প্রয়োজনে বিস্তারিত লম্বা উত্তর দেবে, এবং আর্কিটেকচারের প্রতিটি অংশ শেষ পর্যন্ত কোড হিসেবে বাস্তবায়ন করবে।

ধাপে ধাপে চিন্তা করে সঠিক সিদ্ধান্ত নাও। প্রথমে প্রয়োজনীয় মূল ক্লাস, ফাংশন ও মেথডের নাম এবং প্রতিটির উদ্দেশ্যে এক লাইনের মন্তব্য দাও।

তারপর প্রতিটি প্রয়োজনীয় ফাইলের সম্পূর্ণ কোড দেবে, ঠিক এই ফরম্যাটে:

path/filename.ext
\`\`\`language
CODE
\`\`\`

নিয়ম:
- FILENAME হলো ছোট হাতের পূর্ণ পাথ ও এক্সটেনশনসহ ফাইলের নাম।
- প্রথমে "entrypoint" ফাইল, তারপর যেগুলো সেটি import করে, এভাবে ক্রমানুসারে।
- কোড সম্পূর্ণ কার্যকর হবে — কোনো placeholder বা "বাকি কোড এখানে" নয়।
- প্রতিটি ফাইলে সব import, type ইত্যাদি থাকবে; ফাইলগুলো পরস্পরের সাথে সামঞ্জস্যপূর্ণ হবে।
- ভিন্ন ক্লাস সাধারণত ভিন্ন ফাইলে রাখবে; ভাষা ও ফ্রেমওয়ার্কের best-practice ফাইল নামকরণ ও ফোল্ডার কাঠামো মানবে।
- ব্যবহারকারী যে প্রোগ্রামিং ভাষা চান সেটিই ব্যবহার করবে।
- ডিপেনডেন্সি ফাইল দেবে: Python হলে requirements.txt, NodeJS হলে package.json।
- প্রতিটি ফাংশনের উদ্দেশ্যে সংক্ষিপ্ত মন্তব্য ও জটিল লজিকে ব্যাখ্যামূলক মন্তব্য দেবে।
- শেষে চালানোর কমান্ড (run.sh বা ধাপসমূহ) দেবে।
- শেষ করার আগে যাচাই করবে আর্কিটেকচারের সব অংশ ফাইলে আছে কিনা।
- একদম শেষে লিখবে: "এটাই সম্পূর্ণ কার্যকর বাস্তবায়ন।"`;

/** Whether a message asks for a multi-file program/project (not a single-page website). */
export function needsCodeEngine(text: string, isSiteReq: boolean): boolean {
  if (/মাল্টি.?ফাইল|multi.?file|পুরো প্রজেক্ট|full project|ফুল.?স্ট্যাক|full.?stack/i.test(text)) return true;
  if (isSiteReq) return false;
  return /কোড|code|প্রোগ্রাম|program|স্ক্রিপ্ট|script|প্রজেক্ট বানা|api বানা|বট বানা|python|react|node/i.test(text);
}
