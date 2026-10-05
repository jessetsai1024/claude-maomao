import * as s from '../hooks/sprites.ts'
const W = 18
const lifts = [0, 0, 1, 2, 1, 0]
const out: Record<string, number[]> = {}
;[s.CROUCH, s.PUSH, s.RISE, s.LEAP, s.TUCK, s.LAND].forEach((sp, i) => { out['f' + (i + 1)] = s.pixelsOf(W, { sprite: sp, x: 1, lift: lifts[i]!, isFacingLeft: false }) })
console.log(JSON.stringify({ W, H: s.TRACK_PIXELS, frames: out, cellsLen: 0 }))
