import type { Game } from "./game"
import { addCoins } from "./game/progress"
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
            desc: "Потратить 10 монет: удержать курс на месте и укрепить корпус (+1 ЩИТ).",
            cost: 10,
          },
          {
            id: "dive",
            label: "Нырнуть в жерло воронки",
            desc: `Рискнуть: 50% шанс выловить клад (+30 монет) или 50% шанс быть выброшенным в «${placeName}».`,
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
            desc: "Потратить 15 монет: закрепиться на рифе и зарядить лазер на следующий бой.",
            cost: 15,
          },
          {
            id: "crystals",
            label: "Собрать кристаллы",
            desc: "Рискнуть: 60% шанс добыть +25 монет или 40% потерять 1 щит из-за турбулентности.",
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
            desc: "Пожертвовать 12 монет духам глубин и восстановить +1 жизнь.",
            cost: 12,
          },
          {
            id: "explore",
            label: "Обыскать расщелину",
            desc: `50% шанс найти сокровищницу (+35 монет) или 50% шанс обвала — откат в «${placeName}».`,
          },
          {
            id: "leave",
            label: "Осторожно оплыть",
            desc: "Ничего не трогать и спокойно продолжить путь дальше без риска.",
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
            desc: `70% шанс получить +20 монет или 30% шанс быть отброшенным взрывом в «${placeName}».`,
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

  // Проверка стоимости
  if (choice.cost && choice.cost > 0) {
    if (g.coins < choice.cost) return
    g.coins -= choice.cost
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
        addCoins(g, 30)
        outcome = {
          targetId: -1,
          text: "Удача! Вы нырнули в эпицентр и подняли сундук древних глубин (+30 монет)!",
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
        addCoins(g, 25)
        outcome = {
          targetId: -1,
          text: "Вы успешно собрали россыпь сияющих кристаллов (+25 монет)!",
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
        addCoins(g, 35)
        outcome = {
          targetId: -1,
          text: "В расщелине лежал клад затонувшего галеона (+35 монет)!",
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
        addCoins(g, 20)
        outcome = {
          targetId: -1,
          text: "Вы собрали ценные геотермальные минералы (+20 монет)!",
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
  }

  g.campaignEventTarget = outcome.targetId
  event.resolved = true
  event.outcomeText = outcome.text
  g.campaignEvent = outcome.text

  g.sfx.ensure()
  g.sfx.power()
  pushHud(g)
}
