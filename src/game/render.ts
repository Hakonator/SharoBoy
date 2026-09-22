/**
 * Пиксельный рендеринг игровой сцены — публичный фасад.
 * Вся логика состояния остаётся в Game; сюда передаются снимки данных.
 * Реализация разбита на модули в папке render/ по единой ответственности.
 */
export * from "./render/background"
export * from "./render/blocks"
export * from "./render/boss"
export * from "./render/fish"
export * from "./render/jelly"
export * from "./render/minibosses"
export * from "./render/paddle"
export * from "./render/powers"
export * from "./render/projectiles"
export * from "./render/fx"
