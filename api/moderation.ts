// Server-side chat moderation: blocklist + normalization, no AI.
// Catches leetspeak (f4ck), spacing tricks (f u c k), repeated letters (fuuuck),
// and Cyrillic/Greek lookalike letters. Both sides (dictionary and message) are
// normalized identically, so the checks stay consistent.

const CONFUSABLES: Record<string, string> = {
  // leetspeak / symbols
  "@": "a", "4": "a", "8": "b", "(": "c", "<": "c", "3": "e", "6": "g",
  "1": "i", "!": "i", "|": "i", "0": "o", "9": "q", "$": "s", "5": "s",
  "7": "t", "+": "t", "2": "z", "v": "u", // v→u catches "fvck"
  // cyrillic lookalikes
  "а": "a", "е": "e", "ё": "e", "о": "o", "р": "p", "с": "c", "х": "x",
  "у": "y", "і": "i", "к": "k", "м": "m", "н": "h", "т": "t", "в": "b",
  // greek lookalikes
  "α": "a", "ε": "e", "ο": "o", "ρ": "p", "ι": "i", "ν": "v",
  "τ": "t", "χ": "x", "κ": "k", "μ": "m",
};

// vulgar / offensive / racist terms (EN + 中文). Only unambiguous words —
// short words that appear inside innocent words (e.g. "ass" in "grass") are excluded.
const RAW_WORDS: string[] = [
  // english profanity (incl. common misspellings used to dodge filters)
  "fuck", "fucking", "fucker", "motherfucker", "fuk", "fack", "fock",
  "fcuk", "phuck", "shit", "bullshit", "bitch",
  "cunt", "dick", "pussy", "cock", "whore", "slut", "bastard", "asshole",
  "dumbass", "jackass", "piss", "cum", "jizz", "dildo", "porn", "rape",
  // english slurs
  "nigger", "nigga", "faggot", "fag", "retard", "kike", "chink", "gook",
  "spic", "wetback", "tranny", "coon", "jap",
  // 中文脏话
  "傻逼", "煞笔", "沙币", "傻屄", "沙壁", "煞壁", "傻b", "沙b", "煞b",
  "操你", "肏", "草泥马", "妈的", "妈卖批",
  "王八蛋", "贱人", "婊子", "狗娘养", "死全家", "去死", "滚蛋", "废物",
  "nmsl", "cnm", "rnm", "mlgb", "tmd",
  // 中文歧视用语
  "支那", "黑鬼", "尼哥", "白皮猪", "东亚病夫",
];

function normalize(text: string): string {
  const mapped = Array.from(text.toLowerCase())
    .map((ch) => CONFUSABLES[ch] ?? ch)
    .join("");
  // strip everything that isn't a latin letter or CJK character (kills spacing tricks),
  // then collapse repeated characters (fuuuck -> fuk, 操操操 -> 操)
  return mapped
    .replace(/[^a-z一-鿿]/g, "")
    .replace(/([a-z一-鿿])\1+/g, "$1");
}

const WORDS = RAW_WORDS.map(normalize).filter((w) => w.length > 0);

export function isOffensive(text: string): boolean {
  const n = normalize(text);
  if (!n) return false;
  return WORDS.some((w) => n.includes(w));
}
