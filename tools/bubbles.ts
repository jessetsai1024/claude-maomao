// 列出每種小符號是哪個字、放在第幾欄第幾列：bun run bubbles.ts
import * as a from '../hooks/actor.ts'
const W = 80
const after = (actor: a.Actor, n: number) => { for (let i = 0; i < n; i++) actor = a.tick(actor, W, false); return actor }
let done = a.react(after(a.react(a.born(), 'working'), 3), 'done')
while (done.emote !== 'bang') done = a.tick(done, W, false)
const cases: Record<string, a.Actor> = {
  '送出訊息': a.react(a.born(), 'prompt'),
  '被叫名字': a.react(a.born(), 'called'),
  '被叫名字跳到最高': after(a.react(a.born(), 'called'), 2),
  '做完回到原位': done,
  '打呼第 1 格': after(a.born(), 545),
  '打呼第 2 格': after(a.born(), 552),
}
for (const [name, actor] of Object.entries(cases)) {
  const b = a.poseOf(actor).bubble
  console.log(name.padEnd(12, '　'), b ? `${b.glyph}  欄 ${b.column} 列 ${b.row} 顏色 #${b.color.toString(16)}` : '（沒有）')
}
