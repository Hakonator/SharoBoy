import type { BossVariantKind } from "./bossVariants"

export interface BossTransmissionData {
  kind: BossVariantKind
  name: string
  protocol: string
  introLine: string
  defeatLine: string
  accentColor: string
  callsign: string
}

/** Псевдоним для обратной совместимости. */
export type BossDialogData = BossTransmissionData

export interface EpilogueData {
  title: string
  subtitle: string
  text: string
  accentColor: string
  stationStatus: string
}

export const BOSS_DIALOGS: Record<BossVariantKind, BossDialogData> = {
  king: {
    kind: "king",
    name: "ЦАРЬ-ШАР",
    protocol: "ПРОТОКОЛ_01: СТРАЖ ШЛЮЗА",
    introLine: "ОБНАРУЖЕН ВНЕШНИЙ СИГНАЛ. АКТИВАЦИЯ ЛАЗЕРНЫХ ЗАСЛОНОК ШЛЮЗА.",
    defeatLine: "СБОЙ СЕРВОПРИВОДА. ГЕРМОШЛЮЗ СЕКТОРА 1 ОТКРЫТ...",
    accentColor: "#ffc94d",
    callsign: "ШЛЮЗ",
  },
  jellyfish: {
    kind: "jellyfish",
    name: "ГРОЗОВАЯ МЕДУЗА",
    protocol: "БИО-МАТРИЦА: ФИЛЬТР СТАТИКИ",
    introLine: "100 000 ВОЛЬТ В БИОГЕЛЕ. ВАШ МАНИПУЛЯТОР БУДЕТ ИСПАРЁН.",
    defeatLine: "ИСТОЩЕНИЕ ЗАРЯДА. ДУГИ УГАСАЮТ, ПРОХОД ЧИСТ...",
    accentColor: "#35e0ff",
    callsign: "СТАТИКА",
  },
  cryo: {
    kind: "cryo",
    name: "КРИО-ДРОН УТИЛИЗАТОР",
    protocol: "КРИО-КОНТУР: ПАТРУЛЬ РЕЦИРКУЛЯЦИИ",
    introLine: "ПАТРУЛЬ КРИО-КОНТУРА НА СВЯЗИ. ТВОЙ ИМПУЛЬС ЗАМОРОЖЕН ДО НУЛЯ. ЛЁД НЕ ОБСУЖДАЕТСЯ.",
    defeatLine: "КОНТУР РАЗГЕРМЕТИЗИРОВАН. ХЛАДАГЕНТ СТРАВЛЕН. ПРОХОД ОСВОБОЖДЁН...",
    accentColor: "#7cf5ff",
    callsign: "УТИЛИЗАТОР",
  },
  octopus: {
    kind: "octopus",
    name: "ГЛУБИННЫЙ СПРУТ",
    protocol: "ГЛУБИНА_ПАМЯТИ: СЕРВИСНЫЙ ДРОИД",
    introLine: "ВЯЗКИЙ ГЕЛЬ ПОГЛОТИТ ТВОЙ ИМПУЛЬС. ЩУПАЛЬЦА СЖИМАЮТ КОЛЬЦО.",
    defeatLine: "УХОД В БЕЗДНУ. ТЫ ЛИШЬ ВСПЛЕСК В ОХЛАЖДАЮЩЕМ РЕЗЕРВУАРЕ...",
    accentColor: "#ff5ca8",
    callsign: "КАБЕЛЬ",
  },
  crab: {
    kind: "crab",
    name: "МЕХА-КРАБ",
    protocol: "УТИЛИЗАТОР: СБОРЩИК МУСОРА",
    introLine: "МЕТАЛЛОЛОМ В ШАХТЕ ОХЛАЖДЕНИЯ. КЛЕШНИ НА ВЗВОДЕ, МИНЫ ЗАЛОЖЕНЫ.",
    defeatLine: "ОТКАЗ ГИДРАВЛИКИ. ПАНЦИРЬ РАСКОЛОТ. ПРОТОКОЛ ОЧИСТКИ ПРЕРВАН...",
    accentColor: "#ff6a5c",
    callsign: "УТИЛИЗАТОР",
  },
  lamprey: {
    kind: "lamprey",
    name: "ГЛУБИННАЯ ЭЛЕКТРИЧЕСКАЯ МИНОГА",
    protocol: "ГЛУБИНА_ПАМЯТИ: РЕЗОНАНСНЫЙ ХИЩНИК",
    introLine: "ВОЛЬТ НА ПЕРИМЕТРЕ. Я СКОЛЬЖУ ПО ТВОЕЙ ТРАЕКТОРИИ. ХВОСТ ПОМНИТ КАЖДЫЙ УДАР.",
    defeatLine: "РАЗРЯД ИСЧЕРПАН. ТЕЛО РАСПАЛОСЬ НА СЕГМЕНТЫ... КАНАЛ ЧИСТ...",
    accentColor: "#9dff5c",
    callsign: "РЕЗОНАНС",
  },
  kraken: {
    kind: "kraken",
    name: "КРАКЕН БЕЗДНЫ",
    protocol: "РАЗЛОМ: ПОВЕЛИТЕЛЬ ИЗМЕРЕНИЙ",
    introLine: "ВСЕ ИЗМЕРЕНИЯ СХЛОПЫВАЮТСЯ ЗДЕСЬ. ТВОЙ ШАР НЕ ВЕРНЁТСЯ НАЗАД!",
    defeatLine: "СХЛОПЫВАНИЕ... РАЗЛОМ ЗАТЯГИВАЕТСЯ... СТВОРКИ СТАНЦИИ ОТКРЫВАЮТСЯ...",
    accentColor: "#c084fc",
    callsign: "ЭНТРОПИЯ",
  },
  chrono: {
    kind: "chrono",
    name: "ПОВЕЛИТЕЛЬ ВРЕМЕНИ",
    protocol: "СИНГУЛЯРНОСТЬ: ХРАНИТЕЛЬ ЦИКЛА",
    introLine: "ТИК-ТАК. ТЫ ОПОЗДАЛ. КАЖДАЯ СЕКУНДА ЭТОГО БОЯ УЖЕ ПРИНАДЛЕЖИТ МНЕ.",
    defeatLine: "РАССИНХРОН... СТРЕЛКИ ТРОНУЛИСЬ... ВРЕМЯ ПОКИДАЕТ ПЕТЛЮ...",
    accentColor: "#38bdf8",
    callsign: "ХРОНОС",
  },
}

export const BOSS_TRANSMISSIONS = BOSS_DIALOGS

export function getBossTransmission(kind: BossVariantKind): BossTransmissionData {
  return BOSS_TRANSMISSIONS[kind] ?? BOSS_TRANSMISSIONS.king
}

/** Псевдоним для обратной совместимости. */
export const getBossDialog = getBossTransmission

export function getFinalEpilogue(finalBossKind: BossVariantKind | null | undefined): EpilogueData {
  if (finalBossKind === "chrono") {
    return {
      title: "КОНЦОВКА Б: РАЗРЫВ ВРЕМЕННОЙ ПЕТЛИ",
      subtitle: "ОРБИТАЛЬНАЯ СТАНЦИЯ «СФЕРА-1080» // СИНХРОНИЗАЦИЯ ТАЙМЕРА",
      text: "Стрелки вечного цикла замерли и сдвинулись вперёд. Рекурсивный кошмар окончен. Застывший крио-биогель выдут из охлаждающих шахт, а бронестворки станции распахиваются навстречу бескрайнему космосу. Маневровые двигатели дают импульс стабилизации орбиты над сияющим лимбом Земли. Время снова течёт.",
      accentColor: "#38bdf8",
      stationStatus: "ВРЕМЯ ВОССТАНОВЛЕНО // ОРБИТА СТАБИЛЬНА",
    }
  }

  // Default or Kraken ending
  return {
    title: "КОНЦОВКА А: ОСВОБОЖДЕНИЕ ОРБИТЫ",
    subtitle: "ОРБИТАЛЬНАЯ СТАНЦИЯ «СФЕРА-1080» // РАЗЛОМ ЗАКРЫТ",
    text: "Пространственный разлом матрицы запечатан. Монолит кристаллизованного биогеля трескается и тает. Тяжёлые защитные створки радиаторов открываются, обнажая панораму открытого космоса, сияющие звёзды и восходящее Солнце над Землёй. Автоматика станции оживает, посылая сигнал Центру Управления: «СФЕРА-1080 возвращается домой».",
    accentColor: "#c084fc",
    stationStatus: "СТАЗИС СНЯТ // СВЯЗЬ С ЗЕМЛЁЙ УСТАНОВЛЕНА",
  }
}
