import type { Game } from "./game"
import { pushHud } from "./game/hudSync"
import type { CampaignEventData } from "./types"
import type { CampaignNode } from "./campaignMap"
import { nodeById } from "./campaignMap"

export interface EventOutcome {
  targetId: number // >= 0 means teleport to targetId; -1 means stay on current node
  text: string
}

/**
 * Создаёт структурированное интерактивное событие с выбором для узла.
 */
export function buildCampaignEvent(
  g: Game,
  node: CampaignNode,
  teleportTargetId: number
): CampaignEventData {
  const targetNode =
    teleportTargetId >= 0 && g.campaign ? nodeById(g.campaign, teleportTargetId) : null
  const placeName = targetNode ? targetNode.name : "ПРЕДЫДУЩАЯ ЗОНА"

  switch (node.name) {
    case "ВОДОВОРОТ":
      return {
        id: `event-${node.id}`,
        title: "ВОДОВОРОТ СТИХИЙ",
        text: `Мощная подводная воронка затягивает шар в глубину. Вокруг кружатся обломки и древние реликвии!`,
        choices: [
          {
            id: "stabilize",
            label: "Маневровые двигатели",
            desc: "Потратить 10 💎: удержать курс на месте и укрепить корпус (+1 ЩИТ).",
            cost: 10,
          },
          {
            id: "dive",
            label: "Нырнуть в жерло воронки",
            desc: `Рискнуть: 50% шанс выловить клад (+30 💎) или 50% шанс быть выброшенным в «${placeName}».`,
          },
          {
            id: "surrender",
            label: "Поддаться течению",
            desc: `Позволить водовороту унести вас в «${placeName}», подобрав спасательную капсулу (+1 ЖИЗНЬ).`,
          },
        ],
      }

    case "ТЕЧЕНИЕ":
      return {
        id: `event-${node.id}`,
        title: "ПОДВОДНОЕ ТЕЧЕНИЕ",
        text: `Стремительный термальный поток подхватывает шар. В толще воды вспыхивают люминесцентные кристаллы.`,
        choices: [
          {
            id: "anchor",
            label: "Защитный якорь",
            desc: "Потратить 15 💎: закрепиться на рифе и зарядить лазер на следующий бой.",
            cost: 15,
          },
          {
            id: "crystals",
            label: "Собрать кристаллы",
            desc: "Рискнуть: 60% шанс добыть +25 💎 или 40% потерять 1 щит из-за турбулентности.",
          },
          {
            id: "drift",
            label: "Плыть по течению",
            desc: `Течение плавно выносит шар прямо в локацию «${placeName}».`,
          },
        ],
      }

    case "ГРОТ":
      return {
        id: `event-${node.id}`,
        title: "ЗАТОНУВШИЙ ГРОТ",
        text: `Шар заплывает в тихий полузатопленный грот. Стены мерцают мхом, а на дне виднеется древний алтарь.`,
        choices: [
          {
            id: "offering",
            label: "Подношение алтарю",
            desc: "Пожертвовать 12 💎 духам глубин и восстановить +1 жизнь.",
            cost: 12,
          },
          {
            id: "explore",
            label: "Обыскать расщелину",
            desc: `50% шанс найти сокровищницу (+35 💎) или 50% шанс обвала — откат в «${placeName}».`,
          },
          {
            id: "leave",
            label: "Осторожно оплыть",
            desc: "Ничего не трогать и спокойно продолжить путь дальше без риска.",
          },
        ],
      }

    case "АЛТАРЬ БЕЗДНЫ":
      return {
        id: `event-${node.id}`,
        title: "АЛТАРЬ БЕЗДНЫ",
        text: `Тёмный подводный монумент пульсирует фиолетовой энергией глубин. Древний алтарь требует жертвы или подношения.`,
        choices: [
          {
            id: "abyss_sacrifice",
            label: "Кровавая жертва",
            desc: "Пожертвовать 1 жизнь: обрести Реликвию Вечного Огня (огненный шар в каждом бою забега!).",
          },
          {
            id: "abyss_offering",
            label: "Дар кристаллами",
            desc: "Пожертвовать 30 💎: восстановить здоровье (+1 ЖИЗНЬ) и получить комплект щитов (+2 ЩИТ).",
            cost: 30,
          },
          {
            id: "abyss_leave",
            label: "Уплыть прочь",
            desc: "Не прикасаться к запретной магии глубин и безопасно продолжить путь.",
          },
        ],
      }

    case "СУНДУК КОРСАРОВ":
      return {
        id: `event-${node.id}`,
        title: "ЗАТОНУВШИЙ СУНДУК КОРСАРОВ",
        text: `Среди водорослей лежит окованный бронзой сундук с древним кодовым замком.`,
        choices: [
          {
            id: "chest_smash",
            label: "Сбить замок шаром",
            desc: "65% шанс открыть клад (+60 монет и +30 💎); 35% активировать защитную ловушку (потеря 1 щита).",
          },
          {
            id: "chest_pick",
            label: "Аккуратный взлом",
            desc: "Потратить 15 💎: осторожно вскрыть механизм, зарядить лазер и получить +1 щит.",
            cost: 15,
          },
          {
            id: "chest_leave",
            label: "Оставить на дне",
            desc: "Не рисковать целостностью шара и плыть дальше.",
          },
        ],
      }

    case "ОСЬМИНОГ-ШУЛЕР":
      return {
        id: `event-${node.id}`,
        title: "АЗАРТНЫЙ ОСЬМИНОГ",
        text: `Хитрый осьминог в пиратской треуголке тасует три ракушки с сияющими жемчужинами. «Сыграем, капитан?»`,
        choices: [
          {
            id: "gamble_bet",
            label: "Сыграть на кристаллы",
            desc: "Ставка 25 💎: 55% шанс угадать и получить +50 💎; 45% потерять ставку.",
            cost: 25,
          },
          {
            id: "gamble_trade",
            label: "Попросить талисман",
            desc: "Потратить 20 💎: осьминог делится секретным перком (Огненный старт на следующий бой).",
            cost: 20,
          },
          {
            id: "gamble_leave",
            label: "Отказаться от игры",
            desc: "Вежливо помахать щупальцу и продолжить свой курс.",
          },
        ],
      }

    case "РАЗВИЛКА ТЕЧЕНИЙ":
      return {
        id: `event-${node.id}`,
        title: "РАЗВИЛКА ТЕЧЕНИЙ",
        text: `Фарватер разделяется: один поток ревёт и несёт обломки, другой ведёт в тихую светящуюся лагуну.`,
        choices: [
          {
            id: "current_storm",
            label: "Бурный фарватер",
            desc: `Рискнуть на стремнине: получить +35 💎 и временный разгон лазера, но с риском отката в «${placeName}» (30%).`,
          },
          {
            id: "current_calm",
            label: "Спокойная лагуна",
            desc: "Заплыть в тихие воды: перевести дух, починить обшивку (+1 ЖИЗНЬ) и укрепить энергощит (+1 ЩИТ).",
          },
          {
            id: "current_survey",
            label: "Держаться середины",
            desc: "Сохранить стабильный курс и продолжить обычный маршрут без изменений.",
          },
        ],
      }

    case "ГЕЙЗЕР":
    default:
      return {
        id: `event-${node.id}`,
        title: "ТЕРМАЛЬНЫЙ ГЕЙЗЕР",
        text: `Из глубокой трещины на дне со свистом и пузырями вырывается столб раскалённой воды!`,
        choices: [
          {
            id: "harness",
            label: "Поймать поток тепла",
            desc: "Использовать термическую тягу: Огненный шар на следующий бой и +1 щит.",
          },
          {
            id: "gather",
            label: "Собрать минералы",
            desc: `70% шанс получить +20 💎 или 30% шанс быть отброшенным взрывом в «${placeName}».`,
          },
          {
            id: "bypass",
            label: "Обойти стороной",
            desc: "Безопасно продолжить путь, держась подальше от разлома.",
          },
        ],
      }
  }
}

/**
 * Обработка выбора варианта в событии кампании.
 */
export function chooseCampaignEventChoice(g: Game, choiceIndex: number) {
  if (!g.campaignEventData || g.campaignEventData.resolved) return
  const event = g.campaignEventData
  const choice = event.choices[choiceIndex]
  if (!choice) return

  // Проверка стоимости в кристаллах забега
  if (choice.cost && choice.cost > 0) {
    if (g.crystals < choice.cost) return
    g.crystals -= choice.cost
  }

  const defaultTarget = g.campaignEventTarget
  let outcome: EventOutcome = { targetId: -1, text: "Вы продолжили путь." }

  switch (choice.id) {
    // ВОДОВОРОТ
    case "stabilize":
      g.shield = Math.min(5, g.shield + 1)
      outcome = {
        targetId: -1,
        text: "Маневровые двигатели стабилизировали шар! Вы удержались на месте и получили энергощит (+1 ЩИТ).",
      }
      break

    case "dive": {
      const lucky = Math.random() < 0.5
      if (lucky) {
        g.addCrystals(30)
        outcome = {
          targetId: -1,
          text: "Удача! Вы нырнули в эпицентр и подняли сундук древних глубин (+30 💎)!",
        }
      } else {
        outcome = {
          targetId: defaultTarget,
          text: "Вихрь оказался слишком силён! Шар закружило и выбросило на пройденный узел.",
        }
      }
      break
    }

    case "surrender":
      g.lives = Math.min(5, g.lives + 1)
      outcome = {
        targetId: defaultTarget,
        text: "Течение унесло вас назад, но по пути шар подобрал спасательную капсулу (+1 ЖИЗНЬ)!",
      }
      break

    // ТЕЧЕНИЕ
    case "anchor":
      g.campaignPerks.laserStart = true
      outcome = {
        targetId: -1,
        text: "Якорь надёжно закрепил шар на рифе. Лазерные системы полностью заряжены на следующий бой!",
      }
      break

    case "crystals": {
      const lucky = Math.random() < 0.6
      if (lucky) {
        g.addCrystals(25)
        outcome = {
          targetId: -1,
          text: "Вы успешно собрали россыпь сияющих кристаллов (+25 💎)!",
        }
      } else {
        if (g.shield > 0) g.shield--
        outcome = {
          targetId: -1,
          text: "Турбулентность встряхнула шар — потерян 1 щит, но вы удержались на курсе.",
        }
      }
      break
    }

    case "drift":
      outcome = {
        targetId: defaultTarget,
        text: "Течение плавно доставило шар в пройденную локацию.",
      }
      break

    // ГРОТ
    case "offering":
      g.lives = Math.min(5, g.lives + 1)
      outcome = {
        targetId: -1,
        text: "Древний алтарь озарился мягким светом — корпус шара полностью восстановлен (+1 ЖИЗНЬ)!",
      }
      break

    case "explore": {
      const lucky = Math.random() < 0.5
      if (lucky) {
        g.addCrystals(35)
        outcome = {
          targetId: -1,
          text: "В расщелине лежал клад затонувшего галеона (+35 💎)!",
        }
      } else {
        outcome = {
          targetId: defaultTarget,
          text: "Каменный свод грота обвалился! Волна вытолкнула шар обратно.",
        }
      }
      break
    }

    case "leave":
      outcome = {
        targetId: -1,
        text: "Вы осторожно покинули грот и продолжили путь без происшествий.",
      }
      break

    // ГЕЙЗЕР
    case "harness":
      g.campaignPerks.fireStart = true
      g.shield = Math.min(5, g.shield + 1)
      outcome = {
        targetId: -1,
        text: "Термальная энергия зарядила шар! В следующем бою шар будет огненным (+1 ЩИТ).",
      }
      break

    case "gather": {
      const lucky = Math.random() < 0.7
      if (lucky) {
        g.addCrystals(20)
        outcome = {
          targetId: -1,
          text: "Вы собрали ценные геотермальные минералы (+20 💎)!",
        }
      } else {
        outcome = {
          targetId: defaultTarget,
          text: "Внезапный выброс пара подбросил шар и отшвырнул назад!",
        }
      }
      break
    }

    case "bypass":
      outcome = {
        targetId: -1,
        text: "Вы аккуратно обошли опасный гейзер и продолжили движение.",
      }
      break

    // АЛТАРЬ БЕЗДНЫ
    case "abyss_sacrifice":
      if (g.lives > 1) {
        g.lives--
      } else if (g.shield > 0) {
        g.shield--
      }
      g.campaignRelics.relicFire = true
      outcome = {
        targetId: -1,
        text: "Тёмный алтарь принял жертву! Вы получили Реликвию Вечного Огня — шар пылает в каждом бою!",
      }
      break

    case "abyss_offering":
      g.lives = Math.min(5, g.lives + 1)
      g.shield = Math.min(5, g.shield + 2)
      outcome = {
        targetId: -1,
        text: "Древние духи приняли кристаллы: корпус исцелён (+1 ЖИЗНЬ) и усилен экранами (+2 ЩИТ)!",
      }
      break

    case "abyss_leave":
      outcome = {
        targetId: -1,
        text: "Вы благоразумно отплыли от алтаря Бездны и продолжили свой путь.",
      }
      break

    // СУНДУК КОРСАРОВ
    case "chest_smash": {
      const lucky = Math.random() < 0.65
      if (lucky) {
        g.addCoins(60)
        g.addCrystals(30)
        outcome = {
          targetId: -1,
          text: "Замок раскололся! Из сундука хлынуло сокровище: +60 монет и +30 💎!",
        }
      } else {
        if (g.shield > 0) g.shield--
        outcome = {
          targetId: -1,
          text: "Сработала охранная ловушка сундука! Взрывом сбило 1 щит, но шар уцелел.",
        }
      }
      break
    }

    case "chest_pick":
      g.campaignPerks.laserStart = true
      g.shield = Math.min(5, g.shield + 1)
      outcome = {
        targetId: -1,
        text: "Механизм замка аккуратно обезврежен! Найдены лазерная батарея и энергощит (+1 ЩИТ).",
      }
      break

    case "chest_leave":
      outcome = {
        targetId: -1,
        text: "Вы решили не рисковать и оставили загадочный сундук на дне.",
      }
      break

    // ОСЬМИНОГ-ШУЛЕР
    case "gamble_bet": {
      const lucky = Math.random() < 0.55
      if (lucky) {
        g.addCrystals(50)
        outcome = {
          targetId: -1,
          text: "Жемчужина угадана! Осьминог с почётом вручает выигрыш (+50 💎)!",
        }
      } else {
        outcome = {
          targetId: -1,
          text: "Осьминог ловко перетасовал ракушки — ставка проиграна. В другой раз повезёт!",
        }
      }
      break
    }

    case "gamble_trade":
      g.campaignPerks.fireStart = true
      outcome = {
        targetId: -1,
        text: "Осьминог подмигнул и передал пиротехнический порошок: огненный старт в следующем бою!",
      }
      break

    case "gamble_leave":
      outcome = {
        targetId: -1,
        text: "Вы вежливо отказались от азартных игр и поплыли дальше по фарватеру.",
      }
      break

    // РАЗВИЛКА ТЕЧЕНИЙ
    case "current_storm": {
      const lucky = Math.random() < 0.7
      if (lucky) {
        g.addCrystals(35)
        g.campaignPerks.laserStart = true
        outcome = {
          targetId: -1,
          text: "Вы оседлали бешеный поток! Награда за отвагу: +35 💎 и заряженный лазер!",
        }
      } else {
        outcome = {
          targetId: defaultTarget,
          text: "Штормовое течение закружило шар и выбросило обратно на пройденный рубеж!",
        }
      }
      break
    }

    case "current_calm":
      g.lives = Math.min(5, g.lives + 1)
      g.shield = Math.min(5, g.shield + 1)
      outcome = {
        targetId: -1,
        text: "Тихая лагуна позволила восстановить силы: +1 жизнь и +1 защитный экран!",
      }
      break

    case "current_survey":
      outcome = {
        targetId: -1,
        text: "Вы сохранили выверенный курс и спокойно продолжили исследование фарватера.",
      }
      break
  }

  g.campaignEventTarget = outcome.targetId
  event.resolved = true
  event.outcomeText = outcome.text
  g.campaignEvent = outcome.text

  g.sfx.ensure()
  g.sfx.power()
  pushHud(g)
}
