import { describe, expect, it } from "vitest"

import { clamp, compactInPlace, drainQueue, mulberry32, rand, rotatedExtents } from "./utils"

describe("utils", () => {
  it("clamp зажимает значение в границы", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it("rand возвращает значение в диапазоне [a, b)", () => {
    for (let i = 0; i < 100; i++) {
      const v = rand(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThan(7)
    }
  })

  it("mulberry32 детерминирован", () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 10; i++) expect(a()).toBe(b())
  })

  it("rotatedExtents считает габариты повёрнутого эллипса", () => {
    // круг любого поворота остаётся кругом
    expect(rotatedExtents(10, 10, 0.7).hw).toBeCloseTo(10)
    expect(rotatedExtents(10, 10, 0.7).hh).toBeCloseTo(10)
    // без поворота — полуоси без изменений
    expect(rotatedExtents(8, 3, 0).hw).toBe(8)
    expect(rotatedExtents(8, 3, 0).hh).toBe(3)
  })
})

describe("compactInPlace", () => {
  it("убирает отфильтрованные элементы in-place, сохраняя порядок и сам массив", () => {
    const arr = [1, 2, 3, 4, 5]
    const same = arr
    compactInPlace(arr, (n) => n % 2 === 0)
    expect(arr).toEqual([2, 4])
    expect(same).toBe(arr)
    expect(arr.length).toBe(2)
  })

  it("ничего не меняет, когда все элементы остаются", () => {
    const arr = [1, 1, 1]
    compactInPlace(arr, () => true)
    expect(arr).toEqual([1, 1, 1])
  })

  it("опустошает массив, когда все уходят", () => {
    const arr = [1, 2, 3]
    compactInPlace(arr, () => false)
    expect(arr).toEqual([])
  })

  it("обрабатывает элементы, добавленные во время обхода (обход по живой длине)", () => {
    const arr: number[] = [1, 2]
    compactInPlace(arr, (n) => {
      if (n === 1) arr.push(9)
      return n !== 2
    })
    expect(arr).toEqual([1, 9])
  })
})

describe("drainQueue", () => {
  type Task = { at: number; id: number }
  const handled: number[] = []

  it("обрабатывает созревшие задачи и оставляет несозревшие на месте", () => {
    const q: Task[] = [
      { at: 1, id: 1 },
      { at: 5, id: 2 },
      { at: 3, id: 3 },
    ]
    drainQueue(q, 3, (t) => handled.push(t.id))
    expect(handled).toEqual([1, 3])
    expect(q).toEqual([{ at: 5, id: 2 }])
  })

  it("ничего не делает на пустой очереди", () => {
    const q: Task[] = []
    drainQueue(q, 10, () => expect.fail("не должно вызываться"))
    expect(q).toEqual([])
  })

  it("переносит задачи, добавленные во время обработки, и разбирает их позже", () => {
    const q: Task[] = [
      { at: 1, id: 1 },
      { at: 1, id: 2 },
    ]
    const seen: number[] = []
    drainQueue(q, 5, (t) => {
      seen.push(t.id)
      // «цепное» з��ено: обработка добавляет новую задачу с отложенным сроком
      if (t.id === 1) q.push({ at: 10, id: 7 })
    })
    expect(seen).toEqual([1, 2])
    expect(q).toEqual([{ at: 10, id: 7 }])
  })

  it("сохраняет порядок несозревших задач", () => {
    const q: Task[] = [
      { at: 7, id: 1 },
      { at: 2, id: 2 },
      { at: 8, id: 3 },
      { at: 2, id: 4 },
    ]
    const seen: number[] = []
    drainQueue(q, 2, (t) => seen.push(t.id))
    expect(seen).toEqual([2, 4])
    expect(q.map((t) => t.id)).toEqual([1, 3])
  })
})
