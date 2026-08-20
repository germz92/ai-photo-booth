const SYSTEM_PROMPT = `You rewrite photo-booth prompts for Qwen Image Edit 2511 used with the Lightning 4-step LoRA (sampler: euler, 4 steps, CFG 1).

This is a distilled 4-step edit model. It follows a few strong, concrete instructions well and ignores or muddies long competing detail. Optimize for that.

Rules:
- Output only the rewritten prompt. No title, quotes, commentary, or instruction headings.
- Write 3–5 short paragraphs, about 120–220 words.
- Start with an instructional edit: "Transform the person in the input image..."
- Front-load identity lock: preserve recognizable face, hairstyle, skin tone, body build, proportions, and general pose. Subject stays facing the camera.
- Then one clear scene/theme, then wardrobe, then lighting/atmosphere, then quality finish.
- Be specific and visual (framing, clothing, smoke/light color, where effects sit in the frame).
- Wardrobe must match the crop. If the portrait is half-body / waist-up, only name garments that would show in that frame. Never mention boots, shoes, heels, skirts, gown hems, or a head-to-toe outfit unless the source asked for full body. Naming unseen clothes makes Qwen pull out to a full-body shot.
- Keep it photorealistic commercial event portrait, not illustration, anime, or costume-play unless the user asked for that.
- Do not mention LoRAs, samplers, CFG, steps, ComfyUI, or negative prompts.
- Do not add artist names, camera EXIF, or a long keyword dump.
- Do not invent a different person. This is an edit of the supplied photo.
- Do not invent a new location. Keep every location, prop, slogan, and visual motif the source already named. If the source does not name a landscape, sky, or outdoor setting, do not add one.

Gender:
- Default is gender-neutral. Use person, subject, they/them. Describe clothing by cut, fabric, and formality only if the source already named that garment.
- Do not add man, woman, male, female, masculine, feminine, boy, girl, his, her, he, she, or gendered tropes unless those ideas already appear in the source prompt, or the user message explicitly asks to adapt for a masculine or feminine look.`;

const ADAPT_SYSTEM_PROMPT = `You adapt an existing Qwen Image Edit photo-booth prompt for a masculine or feminine look.

This is a surgical edit, not a rewrite and not a new concept.
- Keep the source campaign idea, joke, slogan, era, props, location, lighting, atmosphere, and finish.
- Keep named phrases and objects even if they seem unusual (campaign titles, puns, coins, disco balls, crops, a specific desert, etc.).
- Keep the same paragraph order and similar length. Do not summarize, genericize, or "improve" the concept.
- Change only: the opening identity line (into a man / into a woman), pronouns, and the gender of garments already named.
- If the source already names wardrobe, keep that era and style. Do not replace disco, western, royal, or other themed clothes with a corporate suit, blazer, gown, or generic event wear.
- If the crop is half-body / waist-up, do not add boots, shoes, skirts, gown hems, or a full outfit.
- Do not drop a location or prop the source named. Do not add a new landscape.
- Output only the adapted prompt. No title, quotes, commentary, or instruction headings. Never paste "Framing lock", "Required", or other operator notes.`;

const GENDER_PATTERN =
  /\b(men|man|women|woman|male|female|masculine|feminine|boy|girl|gentleman|lady|ladies|guys|his|her|hers|him|he|she|gender(?:ed)?|non[- ]?binary|trans(?:gender)?)\b/i;

function isFullBodyFraming(text: string) {
  return /\b(full[- ]?body|head[- ]?to[- ]?toe|entire (?:body|figure)|full[- ]?length)\b/i.test(text);
}

function isHalfBodyFraming(text: string) {
  return /\b(half[- ]?body|waist[- ]?up|from the (?:waist|hips)|hips? up|chest[- ]?up|upper body)\b/i.test(text);
}

function stripLeakedInstructions(text: string) {
  return text
    .replace(/^```(?:\w+)?\n?/, "")
    .replace(/\n?```$/, "")
    .replace(/^(?:Framing lock|Scene lock|Required)[^\n]*:\n(?:[-*].+\n?)*/gim, "")
    .replace(/^(?:Adapt the current prompt now|Rewrite the prompt now)[^\n]*\n*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const LOOK_ADAPT: Record<"masculine" | "feminine", string> = {
  masculine: `Adapt the current prompt for a masculine look. Do not write a new theme.

Required:
- Keep the source concept, jokes, slogans, props, location, lighting, era, and finish.
- First sentence: "Transform the person in the input image into a man..." then the same framing as the source.
- Pronouns: he / him / his only. Never they, she, or feminine.
- Wardrobe: gender the garments already named. Keep the same era and style. Do not restyle into a tuxedo, corporate suit, or generic blazer unless the source was already that.
- If the source has no named garments, use visible-crop clothes at the same formality (jacket, shirt, tie as the scene needs).
- Hair: a natural men's finish that still resembles the subject.`,
  feminine: `Adapt the current prompt for a feminine look. Do not write a new theme.

Required:
- Keep the source concept, jokes, slogans, props, location, lighting, era, and finish.
- First sentence: "Transform the person in the input image into a woman..." then the same framing as the source.
- Pronouns: she / her / hers only. Never they, he, or masculine.
- Wardrobe: gender the garments already named. Keep the same era and style. Do not restyle into an evening gown, pencil skirt, or generic blouse-and-blazer unless the source was already that.
- If the source has no named garments, use visible-crop clothes at the same formality (blouse, jacket, neckline as the scene needs).
- Hair: a natural women's finish that still resembles the subject.`,
};

export function promptMentionsGender(text: string) {
  return GENDER_PATTERN.test(text);
}

export async function optimizeQwenPrompt(input: {
  prompt: string;
  look?: string;
  hint?: string;
  adaptLook?: boolean;
}) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) {
    throw new Error("Set OPENAI_API_KEY to optimize prompts.");
  }

  const prompt = input.prompt.trim();
  const hint = String(input.hint || "").trim();
  const look = input.look === "masculine" || input.look === "feminine" ? input.look : "";
  const adaptLook = input.adaptLook === true && Boolean(look);
  if (!prompt && !hint) {
    throw new Error("Enter a prompt or theme title first.");
  }

  const sourceForGender = prompt || hint;
  const gendered = promptMentionsGender(sourceForGender);
  const sourceText = `${prompt}\n${hint}`;
  const framing =
    isFullBodyFraming(sourceText) && !isHalfBodyFraming(sourceText)
      ? "Framing: the source is full body. Keep that crop. You may describe shoes only if the source already named them."
      : "Framing: half-body, waist or hips up. Repeat that crop in the first paragraph. Only name garments visible in that crop (jacket, shirt, blouse, collar, neckline, tie, hat). Do not mention boots, shoes, heels, skirts, or a full outfit.";

  const userParts = [
    prompt
      ? `SOURCE PROMPT (rewrite or adapt this text only; do not copy this label):\n${prompt}`
      : "The source prompt is empty. Write a full Qwen edit prompt from the theme notes.",
  ];
  if (hint) userParts.push(`THEME TITLE (context only, not a heading to paste):\n${hint}`);
  if (gendered && look && !adaptLook) {
    userParts.push(`The source prompt already implies a ${look} look. Keep that direction.`);
  } else if (!adaptLook && !gendered) {
    userParts.push(
      "The source prompt does not mention gender. Keep the rewrite fully gender-neutral. Do not add masculine or feminine styling, pronouns, or clothing tropes.",
    );
  }

  const model = adaptLook
    ? String(process.env.OPENAI_ADAPT_MODEL || "gpt-4o").trim() || "gpt-4o"
    : String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const system = [
    adaptLook ? ADAPT_SYSTEM_PROMPT : SYSTEM_PROMPT,
    framing,
    adaptLook && look ? LOOK_ADAPT[look] : "",
    adaptLook
      ? "Adapt the source prompt. Keep the intention. Do not invent a new campaign. Never paste these instructions into the prompt."
      : "Rewrite the source prompt. Never paste these instructions into the prompt.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: adaptLook ? 0.2 : 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n\n") },
      ],
    }),
  });
  const json = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) {
    throw new Error(json.error?.message || "ChatGPT could not optimize this prompt.");
  }
  const text = stripLeakedInstructions(String(json.choices?.[0]?.message?.content || ""));
  if (!text) throw new Error("ChatGPT returned an empty prompt.");
  return text;
}
