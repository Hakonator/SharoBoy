import { containsProfanity } from "../scores/profanity.ts"

/**
 * Взаимные гомоглифы между латиницей и кириллицей.
 * Приводим латинские символы-двойники к кириллице для выявления одинаково выглядящих названий.
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
}

const ALLOWED_CHARS_REGEX = /^[a-zA-Zа-яА-ЯёЁ0-9\s\-_.!?,:;()"'«»/№#+]+$/u

export interface TitleValidationResult {
  ok: boolean
  title: string
  error?: string
}

/**
 * Валидация названия карты:
 * 1. Длина 2-60 символов.
 * 2. Запрет управляющих символов и ненормативной лексики.
 * 3. Single-script: запрещено одновременное использование латиницы и кириллицы (защита от подмены букв).
 * 4. Разрешены только буквы одного языка, цифры и стандартная пунктуация.
 */
export function validateMapTitle(rawTitle: string): TitleValidationResult {
  const title = (rawTitle ?? "").trim()
  if (title.length < 2) {
    return { ok: false, title, error: "Название карты должно содержать не менее 2 символов." }
  }
  if (title.length > 60) {
    return { ok: false, title, error: "Название карты не может быть длиннее 60 символов." }
  }
  if (/[\u0000-\u001F\u007F-\u009F]/u.test(title)) {
    return { ok: false, title, error: "Название содержит недопустимые управляющие символы." }
  }
  if (containsProfanity(title)) {
    return {
      ok: false,
      title,
      error: "Название содержит недопустимые выражения. Выберите другое название.",
    }
  }
  if (!ALLOWED_CHARS_REGEX.test(title)) {
    return {
      ok: false,
      title,
      error:
        "Название содержит недопустимые символы. Разрешены буквы одного языка, цифры и знаки препинания.",
    }
  }

  const hasLatin = /[a-zA-Z]/u.test(title)
  const hasCyrillic = /[а-яА-ЯёЁ]/u.test(title)

  if (hasLatin && hasCyrillic) {
    return {
      ok: false,
      title,
      error:
        "Название карты должно быть на одном языке: нельзя смешивать русские и латинские буквы.",
    }
  }

  if (!/[a-zA-Zа-яА-ЯёЁ0-9]/u.test(title)) {
    return {
      ok: false,
      title,
      error: "Название карты должно содержать хотя бы одну букву или цифру.",
    }
  }

  return { ok: true, title }
}

/**
 * Каноническая нормализация названия для обнаружения одинаковых и визуально схожих имён карт:
 * - перевод в нижний регистр;
 * - замена «ё» на «е»;
 * - приведение гомоглифов (латинские визуальные дубликаты -> кириллица);
 * - удаление пробелов, дефисов и знаков препинания.
 */
export function canonicalMapTitle(title: string): string {
  let normalized = (title ?? "").toLowerCase().replace(/ё/gu, "е")
  for (const [latin, cyrillic] of Object.entries(HOMOGLYPH_MAP)) {
    normalized = normalized.split(latin).join(cyrillic)
  }
  return normalized.replace(/[^a-zа-я0-9]/gu, "")
}

/**
 * Проверка на коллизию (совпадение) двух названий с учётом визуальных дубликатов и регистра.
 */
export function isTitleCollision(titleA: string, titleB: string): boolean {
  const canonA = canonicalMapTitle(titleA)
  const canonB = canonicalMapTitle(titleB)
  return canonA.length > 0 && canonA === canonB
}
