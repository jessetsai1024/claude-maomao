import * as s from '../hooks/sprites.ts'
import * as a from '../hooks/actor.ts'
const W = 64
let actor = a.born()
const frames: Record<string, number[]> = {}
const log: string[] = []
let n = 0
const snap = (label: string) => { frames[String(n).padStart(3,'0') + ' ' + label] = s.pixelsOf(W, a.poseOf(actor)); log.push(`${n} ${label} mode=${actor.mode} x=${actor.x} left=${actor.isFacingLeft} jump=${actor.jump}`) }
const run = (k: number, label: string, every = 1, working?: boolean) => { for (let i = 0; i < k; i++) { actor = a.tick(actor, W, working); n++; if (i % every === 0) snap(label) } }
snap('flop')

actor = a.react(actor, 'prompt'); run(2, 'sit', 1, false)
actor = a.react(actor, 'working'); snap('run'); run(12, 'run', 1, true)
actor = a.react(actor, 'tool'); run(5, 'tool-jump', 1, true)
run(26, 'turn', 2, true)
actor = a.react(actor, 'done'); run(26, 'home/binky', 1, false)

console.log(JSON.stringify({ W, H: s.TRACK_PIXELS, frames, log }))
