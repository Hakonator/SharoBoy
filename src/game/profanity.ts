/**
 * Фильтр запрещённых ников.
 *
 * Нормализация ломает типичные обходы: разный регистр, «ё» вместо «е»,
 * leet-подмены (0→о, 4→а, @→а, $→с…), латинские двойники букв (x,y,p,c…),
 * удвоение букв и вставку разделителей (х-у-й, х у й).
 *
 * Список — корни слов, а не все словоформы: после нормализации «П1ЗДЕЦ»,
 * «ппииздца» и «x y e» ловятся одинаково.
 */

/** латиница/цифры → кириллица (только для проверки, ник не искажаем) */
const LOOKALIKE: Record<string, string> = {
  a: "а", b: "в", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о",
  p: "р", t: "т", x: "х", y: "у", "@": "а", "4": "а", "6": "б",
  "8": "в", "3": "е", "0": "о", "$": "с", "!": "и", "1": "и", "5": "s",
};

/** корни запрещённых слов (проверка подстрокой после нормализации) */
const BLOCKED = [
  // русский мат
  "хуй", "хуе", "хуя", "хую", "хуи", "хуё", "хуь",
  "пизд", "пизж", "пезди", "бля", "бль",
  "еба", "ебу", "еби", "ёба", "ебат", "ебан", "ебуч", "ебащ",
  "ъеб", "уеб", "оеб", "заеб", "доеб", "поеб", "выеб", "въеб",
  "мудак", "мудил", "муде", "гандон", "гондон", "шлюх", "шалав",
  "дроч", "залуп", "пидор", "пидар", "гнид", "ссан", "сран",
  "чмо", "долбоеб", "дебил", "далбаеб", "долбае",
  // английский
  "fuck", "fuk", "fck", "phuck", "bitch", "shit", "cunt",
  "asshole", "bastard", "nigg", "faggot", "fag", "whore", "slut",
  "dick", "cock", "pussy", "wanker", "retard",
  // русские корни латиницей и cyrillic-lookalike-написания (xyй, huy, nax…)
  "xyu", "xyi", "xya", "xye", "xyo", "huy", "naxy", "naxuy", "nahuy",
];

/** общий «скелет» ника: регистр, leet-подмены, разделители;
 *  collapse=false оставляет удвоенные буквы («asshole», «nigg», «ссаный») */
function skeleton(raw: string, collapse: boolean): string {
  const lower = raw.toLowerCase().replace(/ё/g, "е");
  let out = "";
  for (const ch of lower) {
    let c = LOOKALIKE[ch] ?? ch;
    if (!/[а-яa-z0-9]/.test(c)) c = ""; // разделители и прочий мусор долой
    out += c;
  }
  // «пприивеет» → «привет»: схлопываем повторяющиеся буквы (2+ подряд)
  return collapse ? out.replace(/(.)\1+/g, "$1") : out;
}

/** визуальные двойники кириллицы → латиница (вторая проверочная форма) */
const TO_LATIN: Record<string, string> = {
  а: "a", в: "b", с: "c", е: "e", н: "h", к: "k", м: "m", о: "o",
  р: "p", т: "t", х: "x", у: "y", и: "i",
};

function toLatin(s: string): string {
  let out = "";
  for (const ch of s) out += TO_LATIN[ch] ?? ch;
  return out;
}

/**
 * Фильтр проверяет ник в четырёх формах сразу:
 *  - кириллической схлопнутой («fuuuck» → «fuck»),
 *  - латинской схлопнутой (кириллические двойники → латиница),
 *  - кириллической несхлопнутой («asshole», «nigg», «ссаный»),
 *  - латинской несхлопнутой.
 * Так ловятся и «хуй»/«xyй», и «fuck»/«f.u.c.k»/«5h1t»/«fuuuck».
 */
export function normalizeForCheck(raw: string): string {
  return skeleton(raw, true);
}

export function containsProfanity(raw: string): boolean {
  const cyr = skeleton(raw, true);
  if (!cyr) return true;
  const cyrFull = skeleton(raw, false);
  const lat = toLatin(cyr);
  const latFull = toLatin(cyrFull);
  return BLOCKED.some(
    (stem) =>
      cyr.includes(stem) || lat.includes(stem) || cyrFull.includes(stem) || latFull.includes(stem)
  );
}

export interface NickCheck {
  ok: boolean;
  nick: string; // нормализованный для хранения вариант (trim + схлопнутые пробелы)
  error: string | null;
}

export function validateNick(raw: string): NickCheck {
  const nick = raw.trim().replace(/\s+/g, " ");
  if (nick.length < 2) {
    return { ok: false, nick, error: "Ник слишком короткий — минимум 2 символа" };
  }
  if (nick.length > 16) {
    return { ok: false, nick, error: "Ник слишком длинный — максимум 16 символов" };
  }
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(nick)) {
    return {
      ok: false,
      nick,
      error: "Только буквы, цифры и символы _ - . и пробел",
    };
  }
  if (containsProfanity(nick)) {
    return { ok: false, nick, error: "Этот ник не пройдёт — выберите другой 🙂" };
  }
  return { ok: true, nick, error: null };
}
