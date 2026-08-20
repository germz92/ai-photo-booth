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
- Do not invent a new location. If the source does not name a landscape, sky, or outdoor setting, keep it a portrait with the same implied background. Never add rolling hills, desert, prairie, mountains, or a cinematic establishing shot unless those words are already in the source.

Gender:
- Default is gender-neutral. Use person, subject, they/them. Describe clothing by cut, fabric, and formality only if the source already named that garment.
- Do not add man, woman, male, female, masculine, feminine, boy, girl, his, her, he, she, or gendered tropes unless those ideas already appear in the source prompt, or the user message explicitly asks to adapt for a masculine or feminine look.
- When asked to adapt for a look, change only gendered presentation, pronouns, and wardrobe. Copy the scene, background, lighting, atmosphere, props, and framing from the source. Follow the look instructions exactly.`;

const GENDER_PATTERN =
  /\b(men|man|women|woman|male|female|masculine|feminine|boy|girl|gentleman|lady|ladies|guys|his|her|hers|him|he|she|gender(?:ed)?|non[- ]?binary|trans(?:gender)?)\b/i;

const LOOK_ADAPT: Record<"masculine" | "feminine", string> = {
  masculine: `Rewrite this as a masculine look for Qwen Image Edit.

Scene lock (do not break this):
- Copy the source scene, background, location, lighting, atmosphere, props, and framing.
- Do not relocate the portrait. Do not add rolling hills, desert, prairie, mountains, sky vistas, or any setting the source did not already name.
- If the source is a cinematic/studio portrait, keep it that. Genre words like western, noir, or royal describe wardrobe and mood, not a new landscape.

Required:
- First sentence must be: "Transform the person in the input image into a man..." then continue with the SAME framing and the SAME scene as the source.
- Use he / him / his throughout. Never use they, she, woman, or feminine.
- Keep his recognizable facial features, skin tone, and general pose. Present him as a man.
- Wardrobe must stay in the source genre and formality. Only gender the garments. If the source is western, keep western wear (shirt, jacket, trousers, hat as already implied). Do not restyle into a tuxedo or corporate suit unless the source was already formal/corporate.
- For generic event themes with no genre wardrobe, map formality:
  - formal / black-tie → tuxedo or dark tailored suit, dress shirt, tie or bow tie
  - corporate / event-ready → tailored men's suit or blazer, dress shirt, trousers, optional tie
  - smart casual → men's jacket or overshirt, collared shirt or knit, tailored trousers
- Name real garments. Do not say "masculine attire" or "gendered styling".
- Hair should read as a natural men's finish while still resembling the subject.`,
  feminine: `Rewrite this as a feminine look for Qwen Image Edit.

Scene lock (do not break this):
- Copy the source scene, background, location, lighting, atmosphere, props, and framing.
- Do not relocate the portrait. Do not add rolling hills, desert, prairie, mountains, sky vistas, or any setting the source did not already name.
- If the source is a cinematic/studio portrait, keep it that. Genre words like western, noir, or royal describe wardrobe and mood, not a new landscape.

Required:
- First sentence must be: "Transform the person in the input image into a woman..." then continue with the SAME framing and the SAME scene as the source.
- Use she / her / hers throughout. Never use they, he, man, or masculine.
- Keep her recognizable facial features, skin tone, and general pose. Present her as a woman.
- Wardrobe must stay in the source genre and formality. Only gender the garments. If the source is western, keep western wear (shirt, jacket, skirt or trousers, hat as already implied). Do not restyle into an evening gown unless the source was already formal/black-tie.
- For generic event themes with no genre wardrobe, map formality:
  - formal / black-tie → evening gown or tailored formal dress, refined heels if visible
  - corporate / event-ready → tailored dress, or blouse with a blazer and trousers or a pencil skirt
  - smart casual → blouse or knit, tailored trousers or midi skirt, women's jacket
- Name real garments. Do not say "feminine attire" or "gendered styling".
- Hair should read as a natural women's finish while still resembling the subject.`,
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
