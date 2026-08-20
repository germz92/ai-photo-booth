const SYSTEM_PROMPT = `You rewrite photo-booth prompts for Qwen Image Edit 2511 used with the Lightning 4-step LoRA (sampler: euler, 4 steps, CFG 1).

This is a distilled 4-step edit model. It follows a few strong, concrete instructions well and ignores or muddies long competing detail. Optimize for that.

Rules:
- Output only the rewritten prompt. No title, quotes, or commentary.
- Write 3–5 short paragraphs, about 120–220 words.
- Start with an instructional edit: "Transform the person in the input image..."
- Front-load identity lock: preserve recognizable face, hairstyle, skin tone, body build, proportions, and general pose. Subject stays facing the camera.
- Then one clear scene/theme, then wardrobe, then lighting/atmosphere, then quality finish.
- Be specific and visual (framing, clothing, smoke/light color, where effects sit in the frame).
- Keep it photorealistic commercial event portrait, not illustration, anime, or costume-play unless the user asked for that.
- Do not mention LoRAs, samplers, CFG, steps, ComfyUI, or negative prompts.
- Do not add artist names, camera EXIF, or a long keyword dump.
- Do not invent a different person. This is an edit of the supplied photo.

Gender:
- Default is gender-neutral. Use person, subject, they/them. Describe clothing by cut, fabric, and formality only if the source already named that garment.
- Do not add man, woman, male, female, masculine, feminine, boy, girl, his, her, he, she, or gendered tropes unless those ideas already appear in the source prompt, or the user message explicitly asks to adapt for a masculine or feminine look.
- When asked to adapt for a look, this is a gendered rewrite, not a light polish. Follow the look instructions exactly.`;

const GENDER_PATTERN =
  /\b(men|man|women|woman|male|female|masculine|feminine|boy|girl|gentleman|lady|ladies|guys|his|her|hers|him|he|she|gender(?:ed)?|non[- ]?binary|trans(?:gender)?)\b/i;

const LOOK_ADAPT: Record<"masculine" | "feminine", string> = {
  masculine: `Rewrite this as a masculine look for Qwen Image Edit.

Required:
- First sentence must be: "Transform the person in the input image into a man..." then continue with framing and the scene.
- Use he / him / his throughout. Never use they, she, woman, or feminine.
- Keep his recognizable facial features, skin tone, and general pose. Present him as a man.
- Wardrobe must be explicit men's clothing at the same formality as the source. Map garments instead of leaving unisex language:
  - formal / black-tie → tuxedo or dark tailored suit, dress shirt, tie or bow tie
  - corporate / event-ready → tailored men's suit or blazer, dress shirt, trousers, optional tie
  - smart casual → men's jacket or overshirt, collared shirt or knit, tailored trousers
  - outerwear / weather → men's coat, jacket, or hoodie as the scene needs
  - if the source names a dress, gown, blouse, or skirt, replace it with the men's equivalent at the same formality
- Name real garments (suit jacket, shirt, trousers, coat). Do not say "masculine attire" or "gendered styling".
- Hair should read as a natural men's finish while still resembling the subject.
- Keep the same scene, lighting, atmosphere, and half-body framing.`,
  feminine: `Rewrite this as a feminine look for Qwen Image Edit.

Required:
- First sentence must be: "Transform the person in the input image into a woman..." then continue with framing and the scene.
- Use she / her / hers throughout. Never use they, he, man, or masculine.
- Keep her recognizable facial features, skin tone, and general pose. Present her as a woman.
- Wardrobe must be explicit women's clothing at the same formality as the source. Map garments instead of leaving unisex language:
  - formal / black-tie → evening gown or tailored formal dress, refined heels if visible
  - corporate / event-ready → tailored dress, or blouse with a blazer and trousers or a pencil skirt
  - smart casual → blouse or knit, tailored trousers or midi skirt, women's jacket
  - outerwear / weather → women's coat, wrap, or tailored jacket as the scene needs
  - if the source names a tuxedo, suit-and-tie, or men's shirt, replace it with the women's equivalent at the same formality
- Name real garments (dress, blouse, blazer, gown, coat). Do not say "feminine attire" or "gendered styling".
- Hair should read as a natural women's finish while still resembling the subject.
- Keep the same scene, lighting, atmosphere, and half-body framing.`,
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
  const userParts = [
    prompt ? `Current prompt:\n${prompt}` : "Current prompt is empty. Write a full Qwen edit prompt from the theme notes.",
  ];
  if (hint) userParts.push(`Theme title / notes: ${hint}`);
  if (look && adaptLook) {
    userParts.push(LOOK_ADAPT[look]);
  } else if (gendered && look) {
    userParts.push(`The source prompt already implies a ${look} look. Keep that direction.`);
  } else {
    userParts.push(
      "The source prompt does not mention gender. Keep the rewrite fully gender-neutral. Do not add masculine or feminine styling, pronouns, or clothing tropes.",
    );
  }
  userParts.push("Rewrite the prompt now.");

  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
  const text = String(json.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("ChatGPT returned an empty prompt.");
  return text.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "").trim();
}
