/**
 * Мировая таблица рекордов.
 *
 * Хранилище — Supabase (таблица sharoboy_scores, см. SQL в README).
 * SDK грузится лениво и только если заполнен src/config.ts, поэтому
 * без конфигурации игра работает как раньше (локальные рекорды), а вес
 * стартового бандла не растёт.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_ENABLED } from "../config";

export interface GlobalScore {
  nick: string;
  score: number;
  wave: number;
}

/* минимальный тип клиента — чтобы не тянуть типы SDK в главный чанк */
interface MinimalClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
}

let clientPromise: Promise<MinimalClient | null> | null = null;

async function getClient(): Promise<MinimalClient | null> {
  if (!LEADERBOARD_ENABLED) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as unknown as MinimalClient
      )
      .catch((e) => {
        console.warn("[ШАРОБОЙ] Supabase недоступен:", e);
        return null;
      });
  }
  return clientPromise;
}

/** Топ-10 мировых рекордов по режиму. Ошибки не роняют игру — возвращаем []. */
export async function fetchTop(mode: "campaign" | "endless", limit = 10): Promise<GlobalScore[]> {
  try {
    const client = await getClient();
    if (!client) return [];
    const { data, error } = await client
      .from("sharoboy_scores")
      .select("nick,score,wave")
      .eq("mode", mode)
      .order("score", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as GlobalScore[];
  } catch (e) {
    console.warn("[ШАРОБОЙ] мировой топ недоступен:", e);
    return [];
  }
}

/** Добавить очки в мировой топ. Возвращает null при успехе или текст ошибки. */
export async function submitScore(
  nick: string,
  score: number,
  mode: "campaign" | "endless",
  wave: number
): Promise<string | null> {
  try {
    const client = await getClient();
    if (!client) return "Таблица рекордов не подключена";
    const { error } = await client
      .from("sharoboy_scores")
      .insert({ nick, score, mode, wave });
    if (error) return error.message;
    return null;
  } catch (e) {
    console.error("[ШАРОБОЙ] не удалось отправить очки:", e);
    return e instanceof Error ? e.message : String(e);
  }
}
