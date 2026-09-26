import { describe, expect, it } from "vitest"

import { shuffleMusicTracks } from "./fileMusic"

describe("shuffleMusicTracks", () => {
  it("перемешивает все треки без пропусков и повторов за цикл", () => {
    const tracks = ["a", "b", "c", "d", "e"]
    const shuffled = shuffleMusicTracks(tracks, null, () => 0.37)

    expect(shuffled).toHaveLength(tracks.length)
    expect(new Set(shuffled)).toEqual(new Set(tracks))
  })

  it("не ставит прошлый трек первым на стыке очередей", () => {
    const tracks = ["a", "b", "c", "d"]
    const shuffled = shuffleMusicTracks(tracks, "a", () => 0)

    expect(shuffled[0]).not.toBe("a")
    expect(new Set(shuffled)).toEqual(new Set(tracks))
  })

  it("сохраняет единственный трек, если набор не позволяет избежать повтора", () => {
    expect(shuffleMusicTracks(["only"], "only", () => 0)).toEqual(["only"])
  })
})
