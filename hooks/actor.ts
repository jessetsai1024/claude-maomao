/**
 * 【職責】毛毛的動作規則：現在是哪個狀態、遇到什麼事換成哪個狀態、每一拍往哪裡動、
 *   此刻該畫哪張圖。全部是純函式，不碰引擎、不看時鐘；一拍多久由呼叫端決定。
 * 【狀態】flop 攤平（等主人打字）→ sit 坐起來（主人送出訊息）→ run 來回跑（Claude 在工作）
 *   → home 跑回原位（工作結束）→ binky 開心跳兩下 → sit → flop。
 *   主人叫他名字時從 flop 或 sit 直接進 binky；binky 跳完若回合還在跑就接 run，否則接 sit。
 *   轉移只由 react（外面發生的事）與 tick（時間過去）驅動。
 *   另外管頭旁邊的小符號：送出訊息冒問號、被叫名字冒愛心、做完回到原位冒驚嘆號、
 *   攤平超過一分鐘開始打呼冒 z。
 */
import {
  CROUCH,
  FLOP,
  FLOP_TWITCH,
  GLYPH_COLORS,
  LAND,
  LEAP,
  PUSH,
  RISE,
  SIT,
  TRACK_PIXELS,
  TRACK_ROWS,
  TUCK,
} from './sprites'
import type { Pose } from './sprites'

/** 毛毛的狀態名稱，意義見檔頭【狀態】。 */
export type Mode = 'flop' | 'sit' | 'run' | 'home' | 'binky'

/**
 * 外面發生、會讓毛毛換動作的事：主人送出訊息、主人送出的訊息裡叫了他的名字、
 * 回合開始、用了一次工具、回合結束。
 */
export type Happening = 'prompt' | 'called' | 'working' | 'tool' | 'done'

/** 頭旁邊會限時冒出來的符號：問號、驚嘆號、愛心。打呼的 z 不算在內，它看攤平多久自己出現。 */
export type Emote = 'ask' | 'bang' | 'heart'

/** 毛毛此刻的完整狀態。每次 react 或 tick 都回傳新的一份，不改舊的。 */
export type Actor = {
  /** 現在的狀態。 */
  mode: Mode
  /** 毛毛所在的 16 像素寬方框的左緣，離跑道左緣幾個像素。 */
  x: number
  /** 臉是不是朝左。 */
  isFacingLeft: boolean
  /** 進入現在這個狀態後過了幾拍。 */
  ticks: number
  /** 工具跳躍還剩幾拍，0 表示沒在跳。 */
  jump: number
  /** 狀態跟「回合是否在跑」對不上已經連續幾拍；用來自我修正。 */
  drift: number
  /** 最後一次聽到的是回合開始（true）還是回合結束（false）；開心跳完靠它決定接著跑還是坐下。 */
  isBusy: boolean
  /** 現在頭旁邊冒著哪個符號；沒有是 null。 */
  emote: Emote | null
  /** 那個符號還要再顯示幾拍；數到 0 就消失。 */
  emoteTicks: number
}

/** 建議的一拍長度，單位毫秒。 */
export const TICK_MS = 110

/** 毛毛休息的位置：方框左緣離跑道左緣幾個像素。 */
export const REST_X = 2

/** 毛毛所在方框的寬度，等於最寬那張圖（騰空）的寬度。 */
const BOX = LEAP.width

/** 一次跑步跳躍六拍裡，每一拍用哪張圖、離地多高、前進幾個像素。 */
const HOP = [
  { sprite: CROUCH, lift: 0, step: 0 },
  { sprite: PUSH, lift: 0, step: 2 },
  { sprite: RISE, lift: 1, step: 3 },
  { sprite: LEAP, lift: 2, step: 3 },
  { sprite: TUCK, lift: 1, step: 2 },
  { sprite: LAND, lift: 0, step: 1 },
] as const

/** 跳完一整個循環前進的像素數；蹲下時用它判斷前面還夠不夠跳一次。 */
const HOP_REACH = HOP.reduce((sum, hop) => sum + hop.step, 0)

/** 跑回原位時每一拍的前進距離是平常的幾倍。 */
const HOME_SPEED = 2

/** 工具跳躍四拍裡每一拍的離地高度，由起跳到落地。 */
const JUMP_LIFTS = [2, 4, 4, 2] as const

/** 開心跳八拍裡每一拍的離地高度：跳兩下。 */
const BINKY_LIFTS = [2, 4, 3, 0, 2, 4, 3, 0] as const

const SIT_TICKS = 14
const TWITCH_EVERY = 55
const TWITCH_TICKS = 2
const DRIFT_TO_HOME = 20
const DRIFT_TO_RUN = 5

/** 問號顯示幾拍（約一秒）。 */
const ASK_TICKS = 10
/** 愛心與驚嘆號顯示幾拍：開心跳的八拍加上落地後再留一秒多。 */
const CHEER_TICKS = BINKY_LIFTS.length + 12
/** 攤平滿這麼多拍（約一分鐘）開始打呼。 */
const SNORE_AFTER = 545
/** 打呼每一格停幾拍；三格一輪：小 z、往上飄一列的大 Z、空白。 */
const SNORE_TICKS = 7

/** 【行為】回傳剛出生的毛毛：在休息位置攤平、臉朝右。 */
export function born(): Actor {
  return {
    mode: 'flop',
    x: REST_X,
    isFacingLeft: false,
    ticks: 0,
    jump: 0,
    drift: 0,
    isBusy: false,
    emote: null,
    emoteTicks: 0,
  }
}

function enter(actor: Actor, mode: Mode): Actor {
  return { ...actor, mode, ticks: 0, drift: 0 }
}

/**
 * 【行為】外面發生一件事之後毛毛的新狀態。
 *   prompt：攤平或坐著時坐起來（重新計時）並冒問號；其他狀態不變。
 *   called：攤平或坐著時原地開心跳兩下；在跑的時候跳高一下；兩種都冒愛心；其他狀態不變。
 *   working：記下回合在跑；正在開心跳就讓他跳完再跑，其他不是在跑的狀態立刻開始跑。
 *   tool：攤平以外的狀態起跳一次（跳到一半再來一次就重跳）。
 *   done：記下回合結束；坐著或在跑時改成跑回原位，其他狀態不變。
 */
export function react(actor: Actor, what: Happening): Actor {
  switch (what) {
    case 'prompt':
      return actor.mode === 'flop' || actor.mode === 'sit'
        ? { ...enter(actor, 'sit'), emote: 'ask', emoteTicks: ASK_TICKS }
        : actor
    case 'called': {
      const loved: Actor = { ...actor, emote: 'heart', emoteTicks: CHEER_TICKS }

      if (actor.mode === 'flop' || actor.mode === 'sit') {
        return { ...enter(loved, 'binky'), jump: 0 }
      }

      return actor.mode === 'run' ? { ...loved, jump: JUMP_LIFTS.length + 1 } : actor
    }
    case 'working': {
      const busy = { ...actor, isBusy: true }

      return actor.mode === 'run' || actor.mode === 'binky' ? busy : enter(busy, 'run')
    }
    case 'tool':
      return actor.mode === 'flop' ? actor : { ...actor, jump: JUMP_LIFTS.length + 1 }
    case 'done': {
      const idle = { ...actor, isBusy: false }

      return actor.mode === 'run' || actor.mode === 'sit' ? enter(idle, 'home') : idle
    }
  }
}

function resync(actor: Actor, isWorking: boolean | undefined): Actor {
  const isOff =
    (actor.mode === 'run' && isWorking === false) || (actor.mode === 'flop' && isWorking === true)

  if (!isOff) {
    return actor.drift === 0 ? actor : { ...actor, drift: 0 }
  }

  const drift = actor.drift + 1

  if (actor.mode === 'run' && drift >= DRIFT_TO_HOME) {
    return enter({ ...actor, isBusy: false }, 'home')
  }

  if (actor.mode === 'flop' && drift >= DRIFT_TO_RUN) {
    return enter({ ...actor, isBusy: true }, 'run')
  }

  return { ...actor, drift }
}

/**
 * 【行為】過了一拍之後毛毛的新狀態。columns 是跑道寬度（像素），毛毛不會跑出去。
 *   isWorking 是「現在有沒有回合在跑」，不知道就給 undefined。
 *   跑步六拍一跳，只在蹲下那一拍轉身：前面不夠再跳一次就掉頭。跑回原位時步伐加倍，
 *   到了原位等腳著地才開始開心跳，同時冒驚嘆號。頭旁邊的符號每拍倒數，數完就消失。
 *   在跑但連續 20 拍沒有回合在跑，會自己跑回原位；攤平但連續 5 拍有回合在跑，會自己開始跑。
 *   這是為了回合被中斷、或模組在回合中途重新載入時不會卡在錯的狀態。
 */
export function tick(actor: Actor, columns: number, isWorking?: boolean): Actor {
  const synced = resync(actor, isWorking)

  if (synced.mode !== actor.mode) {
    return synced
  }

  const next: Actor = {
    ...synced,
    ticks: synced.ticks + 1,
    jump: Math.max(0, synced.jump - 1),
    emote: synced.emoteTicks > 1 ? synced.emote : null,
    emoteTicks: Math.max(0, synced.emoteTicks - 1),
  }
  const rightmost = Math.max(REST_X, columns - BOX)

  switch (next.mode) {
    case 'flop':
      return { ...next, jump: 0 }

    case 'sit':
      return next.ticks >= SIT_TICKS ? enter(next, 'flop') : next

    case 'run': {
      const phase = next.ticks % HOP.length
      const ahead = next.x + (next.isFacingLeft ? -HOP_REACH : HOP_REACH)
      const isTurning = phase === 0 && (ahead < 0 || ahead > rightmost)
      const isFacingLeft = isTurning ? !next.isFacingLeft : next.isFacingLeft
      const step = HOP[phase]?.step ?? 0
      const x = Math.min(rightmost, Math.max(0, next.x + (isFacingLeft ? -step : step)))

      return { ...next, x, isFacingLeft }
    }

    case 'home': {
      const hop = HOP[next.ticks % HOP.length]
      const isFacingLeft = next.x === REST_X ? next.isFacingLeft : next.x > REST_X
      const reach = Math.min(Math.abs(next.x - REST_X), (hop?.step ?? 0) * HOME_SPEED)
      const x = next.x + (isFacingLeft ? -reach : reach)

      if (x === REST_X && (hop?.lift ?? 0) === 0) {
        return {
          ...enter(next, 'binky'),
          x,
          isFacingLeft: false,
          jump: 0,
          emote: 'bang',
          emoteTicks: CHEER_TICKS,
        }
      }

      return { ...next, x, isFacingLeft }
    }

    case 'binky':
      if (next.ticks < BINKY_LIFTS.length) {
        return next
      }

      return enter(next, next.isBusy ? 'run' : 'sit')
  }
}

/** 一個符號要用哪個字、什麼顏色、比頭頂那一列高幾列。 */
type Mark = { glyph: string; color: number; rise: number }

const EMOTE_MARKS: Readonly<Record<Emote, Mark>> = {
  ask: { glyph: '?', color: GLYPH_COLORS.yellow, rise: 0 },
  bang: { glyph: '!', color: GLYPH_COLORS.yellow, rise: 0 },
  heart: { glyph: '♥', color: GLYPH_COLORS.red, rise: 0 },
}

const SNORE_MARKS: readonly (Mark | null)[] = [
  { glyph: 'z', color: GLYPH_COLORS.blue, rise: 0 },
  { glyph: 'Z', color: GLYPH_COLORS.blue, rise: 1 },
  null,
]

function markOf(actor: Actor): Mark | null {
  if (actor.emote !== null) {
    return EMOTE_MARKS[actor.emote]
  }

  if (actor.mode !== 'flop' || actor.ticks < SNORE_AFTER) {
    return null
  }

  const frame = Math.floor((actor.ticks - SNORE_AFTER) / SNORE_TICKS) % SNORE_MARKS.length

  return SNORE_MARKS[frame] ?? null
}

/**
 * 【行為】毛毛此刻該怎麼畫：用哪張圖、畫在哪、離地多高、臉朝哪、頭旁邊冒什麼符號。
 *   攤平每 55 拍動兩拍耳朵；跑步與跑回原位六拍一跳、一拍一張圖；
 *   工具跳躍期間一律用伸展那張圖並跳得比跑步高；
 *   開心跳的第二下在空中轉身。
 *   符號是單一個字元，固定放在毛毛所在方框右邊隔一欄的那一格，列數跟著頭頂走、不會超出跑道；
 *   限時的符號（? ! ♥）優先，沒有的時候攤平滿一分鐘才輪到打呼的 z 與 Z。
 */
export function poseOf(actor: Actor): Pose {
  const body = bodyOf(actor)
  const mark = markOf(actor)

  if (mark === null) {
    return body
  }

  const head = Math.floor((TRACK_PIXELS - body.sprite.height - body.lift) / 2)
  const row = Math.min(TRACK_ROWS - 1, Math.max(0, head - mark.rise))

  return {
    ...body,
    bubble: { glyph: mark.glyph, color: mark.color, column: actor.x + BOX + 1, row },
  }
}

function bodyOf(actor: Actor): Pose {
  const { mode, x, ticks, isFacingLeft } = actor
  const sitting: Pose = { sprite: SIT, x: x + 1, lift: 0, isFacingLeft }
  const leaping = (lift: number, isLeft = isFacingLeft): Pose => ({
    sprite: LEAP,
    x,
    lift,
    isFacingLeft: isLeft,
  })

  if (mode === 'flop') {
    const isTwitching = ticks % TWITCH_EVERY >= TWITCH_EVERY - TWITCH_TICKS

    return { sprite: isTwitching ? FLOP_TWITCH : FLOP, x, lift: 0, isFacingLeft }
  }

  if (actor.jump > 0) {
    return leaping(JUMP_LIFTS[JUMP_LIFTS.length - actor.jump] ?? 0)
  }

  if (mode === 'run' || mode === 'home') {
    const hop = HOP[ticks % HOP.length]

    return hop === undefined ? sitting : { sprite: hop.sprite, x, lift: hop.lift, isFacingLeft }
  }

  if (mode === 'binky') {
    const lift = BINKY_LIFTS[ticks] ?? 0

    return lift === 0 ? sitting : leaping(lift, ticks >= BINKY_LIFTS.length / 2)
  }

  return sitting
}
