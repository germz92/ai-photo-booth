export const COUNTRY_DIALS = [
  { code: "+1", label: "US / Canada +1" },
  { code: "+44", label: "United Kingdom +44" },
  { code: "+61", label: "Australia +61" },
  { code: "+64", label: "New Zealand +64" },
  { code: "+353", label: "Ireland +353" },
  { code: "+52", label: "Mexico +52" },
  { code: "+55", label: "Brazil +55" },
  { code: "+54", label: "Argentina +54" },
  { code: "+57", label: "Colombia +57" },
  { code: "+56", label: "Chile +56" },
  { code: "+51", label: "Peru +51" },
  { code: "+34", label: "Spain +34" },
  { code: "+33", label: "France +33" },
  { code: "+49", label: "Germany +49" },
  { code: "+39", label: "Italy +39" },
  { code: "+31", label: "Netherlands +31" },
  { code: "+32", label: "Belgium +32" },
  { code: "+41", label: "Switzerland +41" },
  { code: "+43", label: "Austria +43" },
  { code: "+351", label: "Portugal +351" },
  { code: "+46", label: "Sweden +46" },
  { code: "+47", label: "Norway +47" },
  { code: "+45", label: "Denmark +45" },
  { code: "+358", label: "Finland +358" },
  { code: "+48", label: "Poland +48" },
  { code: "+30", label: "Greece +30" },
  { code: "+420", label: "Czechia +420" },
  { code: "+40", label: "Romania +40" },
  { code: "+36", label: "Hungary +36" },
  { code: "+380", label: "Ukraine +380" },
  { code: "+7", label: "Russia +7" },
  { code: "+90", label: "Turkey +90" },
  { code: "+91", label: "India +91" },
  { code: "+63", label: "Philippines +63" },
  { code: "+62", label: "Indonesia +62" },
  { code: "+65", label: "Singapore +65" },
  { code: "+60", label: "Malaysia +60" },
  { code: "+66", label: "Thailand +66" },
  { code: "+84", label: "Vietnam +84" },
  { code: "+81", label: "Japan +81" },
  { code: "+82", label: "South Korea +82" },
  { code: "+86", label: "China +86" },
  { code: "+852", label: "Hong Kong +852" },
  { code: "+971", label: "UAE +971" },
  { code: "+966", label: "Saudi Arabia +966" },
  { code: "+972", label: "Israel +972" },
  { code: "+27", label: "South Africa +27" },
  { code: "+234", label: "Nigeria +234" },
  { code: "+254", label: "Kenya +254" },
  { code: "+20", label: "Egypt +20" },
] as const;

const DEFAULT_CODE = "+1";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function composePhone(code: string, national: string) {
  const local = digitsOnly(national);
  if (!local) return "";
  const prefix = code.startsWith("+") ? code : `+${digitsOnly(code)}`;
  return `${prefix}${local}`;
}

export function splitPhone(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return { code: DEFAULT_CODE, national: "" };

  const normalized = raw.startsWith("+") ? `+${digitsOnly(raw)}` : digitsOnly(raw);
  if (!normalized) return { code: DEFAULT_CODE, national: "" };

  const withPlus = normalized.startsWith("+") ? normalized : `+${normalized}`;
  const ranked = [...COUNTRY_DIALS].sort((a, b) => b.code.length - a.code.length);
  const match = ranked.find((item) => withPlus.startsWith(item.code));
  if (match) {
    return { code: match.code, national: withPlus.slice(match.code.length) };
  }
  return { code: DEFAULT_CODE, national: digitsOnly(withPlus) };
}
