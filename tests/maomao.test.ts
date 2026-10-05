import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { born, poseOf, react, REST_X, tick } from '../hooks/actor'
import type { Actor } from '../hooks/actor'
import { cellsOf, FLOP, LEAP, pixelsOf, TRACK_PIXELS, TRACK_ROWS, TRANSPARENT } from '../hooks/sprites'

const COLUMNS = 80
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: COLUMNS,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
}

const TOGGLE = {
  command: 'maomao',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: COLUMNS },
} as const

// 代替引擎回應：毛毛讓出橫帶時畫一行空字、toast 直接收下、store 與時鐘用記憶體裡的假貨
function engine(on: On): void {
  mock.store(on)
  mock.clock(on)
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: [''] })
  })
}

function after(actor: Actor, ticks: number, isWorking?: boolean): Actor {
  let now = actor

  for (let n = 0; n < ticks; n += 1) {
    now = tick(now, COLUMNS, isWorking)
  }

  return now
}

test('等待時在原位攤平', async () => {
  const resting = after(born(), 200, false)

  expect(resting.mode).toBe('flop')
  expect(resting.x).toBe(REST_X)
  expect(poseOf(born()).sprite).toBe(FLOP)
})

test('工作時跑出去、不跑出跑道，做完回原位開心跳再攤平', async () => {
  let actor = react(react(born(), 'prompt'), 'working')
  let farthest = 0

  for (let n = 0; n < 300; n += 1) {
    actor = tick(actor, COLUMNS, true)
    farthest = Math.max(farthest, actor.x)
    expect(actor.x).toBeGreaterThanOrEqual(0)
    expect(actor.x + LEAP.width).toBeLessThanOrEqual(COLUMNS)
  }

  expect(actor.mode).toBe('run')
  expect(farthest).toBeGreaterThan(COLUMNS / 2)

  actor = react(actor, 'done')
  const modes = new Set<string>()

  for (let n = 0; n < 80; n += 1) {
    actor = tick(actor, COLUMNS, false)
    modes.add(actor.mode)
  }

  expect(modes.has('binky')).toBe(true)
  expect(actor.mode).toBe('flop')
  expect(actor.x).toBe(REST_X)
})

test('被叫名字時原地開心跳兩下，沒事就坐下再攤平', async () => {
  let actor = react(born(), 'called')
  const lifts: number[] = []

  expect(actor.mode).toBe('binky')

  for (let n = 0; n < 8; n += 1) {
    lifts.push(poseOf(actor).lift)
    actor = tick(actor, COLUMNS, false)
    expect(actor.x).toBe(REST_X)
  }

  expect(lifts.filter(lift => lift === 4)).toHaveLength(2)
  expect(actor.mode).toBe('sit')
  expect(after(actor, 20, false).mode).toBe('flop')
})

test('被叫名字後回合馬上開始，也會先跳完再去跑', async () => {
  const called = react(react(born(), 'called'), 'working')

  expect(called.mode).toBe('binky')
  expect(after(called, 4).mode).toBe('binky')
  expect(after(called, 8).mode).toBe('run')
})

test('跑步一個循環是六張不同的圖，而且每張都畫得進跑道', async () => {
  let actor = react(born(), 'working')
  const seen = new Set<unknown>()

  for (let n = 0; n < 6; n += 1) {
    const pose = poseOf(actor)

    seen.add(pose.sprite)
    expect(pose.sprite.width).toBe(LEAP.width)
    expect(pose.sprite.height + pose.lift).toBeLessThanOrEqual(TRACK_PIXELS)
    actor = tick(actor, COLUMNS, true)
  }

  expect(seen.size).toBe(6)
  expect(actor.x).toBeGreaterThan(REST_X)
})

test('送出訊息冒問號，一秒多之後消失', async () => {
  const asked = react(born(), 'prompt')

  expect(poseOf(asked).bubble?.glyph).toBe('?')
  expect(poseOf(after(asked, 5, false)).bubble?.glyph).toBe('?')
  expect(poseOf(after(asked, 12, false)).bubble).toBeUndefined()
})

test('被叫名字冒愛心，做完回到原位冒驚嘆號', async () => {
  expect(poseOf(react(born(), 'called')).bubble?.glyph).toBe('♥')

  let actor = react(after(react(born(), 'working'), 30, true), 'done')
  const seen = new Set<string | undefined>()

  for (let n = 0; n < 60; n += 1) {
    actor = tick(actor, COLUMNS, false)
    seen.add(poseOf(actor).bubble?.glyph)
  }

  expect(seen.has('!')).toBe(true)
  expect(poseOf(actor).bubble).toBeUndefined()
})

test('攤平滿一分鐘開始打呼，符號在跑道裡，被叫就不打呼', async () => {
  expect(poseOf(after(born(), 500, false)).bubble).toBeUndefined()

  let actor = after(born(), 545, false)
  const seen = new Set<string | undefined>()

  for (let n = 0; n < 21; n += 1) {
    const bubble = poseOf(actor).bubble

    seen.add(bubble?.glyph)

    if (bubble !== undefined) {
      expect(bubble.row).toBeGreaterThanOrEqual(0)
      expect(bubble.row).toBeLessThan(TRACK_ROWS)
      expect(bubble.column).toBeGreaterThan(REST_X + FLOP.width - 1)
    }

    actor = tick(actor, COLUMNS, false)
  }

  expect([...seen].sort()).toEqual(['Z', 'z', undefined])
  expect(poseOf(react(actor, 'called')).bubble?.glyph).toBe('♥')
})

test('符號是一個字元、只改它那一格，不影響毛毛的像素', async () => {
  const asked = poseOf(react(born(), 'prompt'))
  const plain = { ...asked, bubble: undefined }
  const withMark = cellsOf(COLUMNS, asked)
  const without = cellsOf(COLUMNS, plain)

  expect(withMark).toHaveLength(without.length)
  expect(withMark).not.toBe(without)
  expect(pixelsOf(COLUMNS, asked)).toEqual(pixelsOf(COLUMNS, plain))

  let differing = 0

  for (let at = 0; at < withMark.length; at += 16) {
    if (withMark.slice(at, at + 16) !== without.slice(at, at + 16)) {
      differing += 1
    }
  }

  expect(differing).toBe(1)
})

test('用工具時跳得比跑步高', async () => {
  const running = after(react(born(), 'working'), 8, true)
  const jumping = tick(react(running, 'tool'), COLUMNS, true)
  const peak = tick(jumping, COLUMNS, true)

  expect(poseOf(jumping).lift).toBe(2)
  expect(poseOf(peak).lift).toBe(4)
  expect(poseOf(peak).sprite.height + poseOf(peak).lift).toBeLessThanOrEqual(TRACK_PIXELS)
})

test('回合被中斷沒收到結束通知，也會自己回家', async () => {
  const stuck = after(react(born(), 'working'), 40, true)
  const home = after(stuck, 150, false)

  expect(home.mode).toBe('flop')
  expect(home.x).toBe(REST_X)
})

test('畫出來的跑道大小正確，毛毛以外是透明的', async () => {
  const pixels = pixelsOf(COLUMNS, poseOf(born()))
  const painted = pixels.filter(color => color !== TRANSPARENT).length
  const expected = FLOP.rows.join('').replaceAll('.', '').length

  expect(pixels).toHaveLength(COLUMNS * TRACK_PIXELS)
  expect(painted).toBe(expected)
  expect(cellsOf(COLUMNS, null)).toHaveLength(COLUMNS * TRACK_ROWS * 16)
})

test('橫帶畫出跑道，/maomao 收起來再叫出來', async ($, on) => {
  engine(on)

  const ui = await $.ui.mount({
    plugin: 'maomao',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND,
  })
  const track = await ui.find({ type: 'Raster' })

  expect(track?.props.rows).toBe(TRACK_ROWS)
  expect(track?.props.columns).toBe(COLUMNS)

  await $.command.run(TOGGLE)
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()

  await $.command.run(TOGGLE)
  expect((await ui.find({ type: 'Raster' }))?.props.rows).toBe(TRACK_ROWS)

  await ui.unmount()
})

test('桌面版沒有彩色格子元件，讓出橫帶不畫', async ($, on) => {
  engine(on)

  const ui = await $.ui.mount({
    plugin: 'maomao',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: BAND,
  })

  expect(await ui.findAll({ type: 'Raster' })).toHaveLength(0)
  await ui.unmount()
})
