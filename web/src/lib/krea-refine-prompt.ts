const KREA_SYSTEM_PROMPT = `You write a Flux Krea (flux1-krea-dev) img2img caption for CLIPTextEncode.

This is the second pass at denoise 0.5. The themed portrait already exists. Krea only polishes photoreal quality. The caption must name what is already in the photo so objects stay themselves (dollar bills stay dollar bills, not paper; coins stay coins; disco balls stay disco balls).

Output only the caption. No title, quotes, labels, or commentary.

Caption style (Flux / T5, not Qwen Image Edit):
- Present-tense description of the finished photograph.
- Photographic prose. Subject, wardrobe, props, location, lighting, then quality.
- Never give edit instructions. Never tell the model to change, rewrite, or restyle.

Forbidden wording:
- transform, transformation, convert, conversion, turn into, turn the person
- input image, source image, source photo, first pass, Qwen
- dress the subject, create a, add glowing, rewrite, edit the person
- Refine this portrait, Refine the supplied portrait
- "the person in the input image"

Required:
- Open with the portrait type already in the source (usually half-body photoreal commercial portrait).
- Name every specific prop, garment, location, slogan, and lighting cue from the source.
- Same pose, face, crop, and identity, stated as description, not as a command.
- Close with photoreal quality: skin, eyes, hair, hands, fabric, lighting, advertising finish.
- Keep source gender if it is already gendered. Do not add gender if the source is neutral.
- 60–120 words. 2 short paragraphs.`;

const cache = new Map<string, { text: string; at: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const BANNED_KREA_LANGUAGE =
  /\b(?:transform(?:s|ed|ing|ation)?|convert(?:s|ed|ing|ion)?|turn(?:s|ed|ing)? (?:him|her|them|the (?:person|subject|image) )?into|input image|source (?:image|photo|prompt)|first[- ]pass|qwen|dress the (?:subject|person)|refine (?:this|the supplied) portrait)\b/gi;

function cacheKey(qwenPrompt: string) {
  return qwenPrompt.trim().replace(/\s+/g, " ");
}

export function sanitizeKreaCaption(text: string) {
  return text
    .replace(BANNED_KREA_LANGUAGE, "")
    .replace(/\bin the input image\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function visualLockFromQwen(qwenPrompt: string) {
  const cleaned = sanitizeKreaCaption(
    qwenPrompt
      .replace(/\b(?:keep|preserve|emphasize|create|add|use|dress)\b[^.?!]*[.?!]/gi, "")
      .replace(/\bthe final image should\b[^.?!]*[.?!]/gi, "")
      .trim(),
  );
  if (!cleaned) return "";
  return `Named scene lock: ${cleaned.slice(0, 700)}`;
}

export function fallbackKreaPrompt(qwenPrompt: string, stock: string) {
  const lock = visualLockFromQwen(qwenPrompt);
  if (!lock) return stock;
  return `${stock}\n\n${lock}`;
}

export async function kreaRefinePromptFromQwen(qwenPrompt: string, stock: string) {
  const source = qwenPrompt.trim();
  if (!source) return stock;

  const key = cacheKey(source);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return fallbackKreaPrompt(source, stock);

  try {
    const model = String(process.env.OPENAI_KREA_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: KREA_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write a Flux Krea caption for this themed portrait. Use the named objects, wardrobe, and location. Do not copy Qwen edit wording.\n\n${source}`,
          },
        ],
      }),
    });
    const json = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) {
      console.error("Krea refine prompt failed", json.error?.message || response.status);
      return fallbackKreaPrompt(source, stock);
    }
    const text = sanitizeKreaCaption(
      String(json.choices?.[0]?.message?.content || "")
        .replace(/^```(?:\w+)?\n?/, "")
        .replace(/\n?```$/, ""),
    );
    if (!text) return fallbackKreaPrompt(source, stock);
    cache.set(key, { text, at: Date.now() });
    return text;
  } catch (error) {
    console.error("Krea refine prompt failed", error);
    return fallbackKreaPrompt(source, stock);
  }
}
