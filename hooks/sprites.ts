/**
 * 【職責】毛毛的像素圖與「把一個姿勢畫成一條跑道」的純函式。不碰引擎、不記狀態；
 *   什麼時候換哪個姿勢由 register.ts 決定。
 * 【設計備註】一個終端機字元當上下兩個像素（半格字），所以跑道 5 列 = 10 個像素高。
 *   圖都畫成臉朝右；朝左用鏡射。
 *   跑步六格（CROUCH、PUSH、RISE、LEAP、TUCK、LAND）都是 16 像素寬，這樣換格時不會左右晃。
 */

/** 一張像素圖。rows 每個字串一列、每個字元一個像素，字元意義見 PALETTE，「.」是透明。 */
export type Sprite = {
  /** 圖寬，單位像素；等於 rows 每個字串的長度。 */
  width: number
  /** 圖高，單位像素；等於 rows 的長度。 */
  height: number
  /** 由上到下的每一列像素。 */
  rows: readonly string[]
}

/** 毛毛此刻在跑道上的樣子。 */
export type Pose = {
  /** 用哪一張圖。 */
  sprite: Sprite
  /** 圖的左緣離跑道左緣幾個像素；超出跑道的部分直接不畫。 */
  x: number
  /** 離地幾個像素，0 是腳踩在地上。 */
  lift: number
  /** true 時把圖左右鏡射，變成臉朝左。 */
  isFacingLeft: boolean
  /** 頭旁邊冒出來的小符號；沒有就不給。 */
  bubble?: Bubble
}

/**
 * 毛毛頭旁邊冒出來的小符號（問號、驚嘆號、愛心、打呼的 z）。
 * 它是一個真的字元、佔終端機的一格，不是像素拼的圖；所以只有 cellsOf 會畫它，pixelsOf 不會。
 */
export type Bubble = {
  /** 要顯示的字元，只取第一個字；必須是終端機裡佔一格寬的字。 */
  glyph: string
  /** 字的顏色，0xRRGGBB。 */
  color: number
  /** 在跑道的第幾欄，0 是最左；超出跑道就不畫。 */
  column: number
  /** 在跑道的第幾列，0 是最上面那一列；超出跑道就不畫。 */
  row: number
}

/** 小符號用的顏色：黃（問號、驚嘆號）、紅（愛心）、淺藍（打呼的 z）。 */
export const GLYPH_COLORS = { yellow: 0xffd84a, red: 0xff5a7a, blue: 0x8fd3ff } as const

/** 跑道高度，單位是終端機的列。 */
export const TRACK_ROWS = 5

/** 跑道高度，單位像素；每列兩個像素。 */
export const TRACK_PIXELS = TRACK_ROWS * 2

/** 透明像素在 pixelsOf 回傳值裡的記號。 */
export const TRANSPARENT = -1

/**
 * 像素字元對顏色（0xRRGGBB）。W 白毛、S 白毛的陰影、K 黑毛、E 眼睛的反光、P 粉紅鼻頭。
 * 黑毛刻意用深灰而不是純黑，深色背景的終端機才看得到。
 */
export const PALETTE: Readonly<Record<string, number>> = {
  W: 0xf4f1ea,
  S: 0xc4bfb6,
  K: 0x55555f,
  E: 0xffffff,
  P: 0xf2a0b5,
}

function sprite(rows: readonly string[]): Sprite {
  return { width: rows[0]?.length ?? 0, height: rows.length, rows }
}

/** 坐著：送出訊息時抬頭、開心跳落地時也用這張。 */
export const SIT: Sprite = sprite([
  '........WWWW..',
  '.......KWWWWW.',
  '..WWW.KKWKEWW.',
  '.WKKKWKKWKKWP.',
  'WWKKKWKKWWWWK.',
  'WWWWWWWKWWWWW.',
  '.WWWWWWWWWWW..',
  '.SWWSSSSSWWS..',
])

/** 跑步第 1 格，蹲低蓄力：四腳著地、身體縮成一團。 */
export const CROUCH: Sprite = sprite([
  '.........WWWW...',
  '..WWWW..KWWWWW..',
  '.WWKKKWKKWKEWW..',
  'WWWKKKWKKWKKWP..',
  'WWWWWWWKKWWWWK..',
  '.WWWWWWWWWWWW...',
  '.SSWWW..SSW.....',
])

/** 跑步第 2 格，後腳蹬地：前半身抬起、後腳往後伸直還踩在地上。 */
export const PUSH: Sprite = sprite([
  '..........WWWW..',
  '.........KWWWWW.',
  '....WWW.KKWKEWW.',
  '..WWKKKWKKWKKWP.',
  '.WWWKKKWWWWWWWK.',
  '.WWWWWWWWWWW....',
  'WWWW.....SS.....',
  'SS..............',
])

/** 跑步第 3 格，升空：四腳離地、垂耳開始往後飄。 */
export const RISE: Sprite = sprite([
  '..........WWWW..',
  '.......KKKWWWWW.',
  '...WWWW..WWKEWW.',
  '.WWWKKKWWWWKKWP.',
  'WWWWKKKWWWWWWWK.',
  'WWWWWWWWWWWW....',
  'SS.......SS.....',
])

/** 跑步第 4 格，伸展到最高：身體拉成一直線、前腳往前伸。工具跳躍與開心跳在空中也用這張。 */
export const LEAP: Sprite = sprite([
  '..........WWWW..',
  '..WWWW.KKKWKEWW.',
  '.WWKKKWWWWWKKWP.',
  'WWWKKKWWWWWWWWK.',
  'WWWWWWWWWWWWW...',
  'SS..........SS..',
])

/** 跑步第 5 格，收腳下降：後腳收到肚子下面、垂耳被風帶得往上翹。 */
export const TUCK: Sprite = sprite([
  '.......K........',
  '........KKWWWW..',
  '..WWWW..KWWKEWW.',
  '.WWKKKWWWWWKKWP.',
  '.WWKKKWWWWWWWWK.',
  '..WWWWWWWWWW....',
  '....SS.....SS...',
])

/** 跑步第 6 格，前腳先著地：屁股翹高、後腳還在空中。 */
export const LAND: Sprite = sprite([
  '..WWWW..........',
  '.WWKKKW...WWWW..',
  'WWWKKKWW.KWWWWW.',
  '.WWWWWWWKKWKEWW.',
  '..WWWWWWKKWKKWP.',
  '...SSWWWWWWWWWK.',
  '..........WW....',
  '..........SS....',
])

/** 攤平：等待時的日常姿勢，後腳往後伸、下巴貼地。 */
export const FLOP: Sprite = sprite([
  '...........WWWW..',
  '...WWKKKWWKWKEWW.',
  'WWWWWKKWWKKWKKWP.',
  'SWWWWWWWWKKWWWWK.',
])

/** 攤平時動一下耳朵：跟 FLOP 只差耳朵抬起一格。 */
export const FLOP_TWITCH: Sprite = sprite([
  '.........K.WWWW..',
  '...WWKKKWKKWKEWW.',
  'WWWWWKKWWWKWKKWP.',
  'SWWWWWWWWWWWWWWK.',
])

function stamp(
  pixels: number[],
  columns: number,
  art: Sprite,
  x: number,
  top: number,
  isMirrored: boolean,
): void {
  for (let row = 0; row < art.height; row += 1) {
    const y = top + row

    if (y < 0 || y >= TRACK_PIXELS) {
      continue
    }

    for (let column = 0; column < art.width; column += 1) {
      const source = isMirrored ? art.width - 1 - column : column
      const color = PALETTE[art.rows[row]?.[source] ?? '.']
      const at = x + column

      if (color !== undefined && at >= 0 && at < columns) {
        pixels[y * columns + at] = color
      }
    }
  }
}

/**
 * 【行為】把一個姿勢畫進 columns 寬、TRACK_PIXELS 高的跑道，回傳每個像素的顏色，
 *   由左到右、由上到下排成一維陣列，長度是 columns * TRACK_PIXELS；透明是 TRANSPARENT。
 *   pose 給 null 回傳整條透明的跑道。圖超出跑道上下左右的部分不畫。
 *   只畫毛毛本身；頭旁邊的小符號是字元不是像素，不在這裡。
 * 【設計備註】獨立出來是為了預覽與測試：不必懂終端機的格子編碼就能檢查畫了什麼。
 */
export function pixelsOf(columns: number, pose: Pose | null): number[] {
  const pixels = new Array<number>(columns * TRACK_PIXELS).fill(TRANSPARENT)

  if (pose === null) {
    return pixels
  }

  const { sprite: art, x, lift, isFacingLeft } = pose

  stamp(pixels, columns, art, x, TRACK_PIXELS - art.height - lift, isFacingLeft)

  return pixels
}

/** 終端機預設顏色（透明的那一半用它）。 */
const DEFAULT_COLOR = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const SPACE = 0x20

/**
 * 【行為】把一個姿勢編成 Raster 元件的 cells 字串：columns 寬、TRACK_ROWS 高，
 *   每格是「字元、前景色、背景色」三個 32 位元數字，整串轉 base64。
 *   上下兩個像素都透明的格子是空白，所以毛毛以外的地方會透出終端機原本的背景。
 *   姿勢帶著小符號時，最後把那個字元寫進它指定的那一格，蓋掉那格原本的內容。
 */
export function cellsOf(columns: number, pose: Pose | null): string {
  const pixels = pixelsOf(columns, pose)
  const words = new Uint32Array(columns * TRACK_ROWS * 3)

  for (let row = 0; row < TRACK_ROWS; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const upper = pixels[row * 2 * columns + column] ?? TRANSPARENT
      const lower = pixels[(row * 2 + 1) * columns + column] ?? TRANSPARENT
      const at = (row * columns + column) * 3

      if (upper === TRANSPARENT && lower === TRANSPARENT) {
        words.set([SPACE, DEFAULT_COLOR, DEFAULT_COLOR], at)
      } else if (upper === TRANSPARENT) {
        words.set([LOWER_HALF, lower, DEFAULT_COLOR], at)
      } else if (lower === TRANSPARENT) {
        words.set([UPPER_HALF, upper, DEFAULT_COLOR], at)
      } else {
        words.set([UPPER_HALF, upper, lower], at)
      }
    }
  }

  const bubble = pose?.bubble
  const glyph = bubble?.glyph.codePointAt(0)

  if (bubble !== undefined && glyph !== undefined) {
    const { column, row } = bubble

    if (column >= 0 && column < columns && row >= 0 && row < TRACK_ROWS) {
      words.set([glyph, bubble.color, DEFAULT_COLOR], (row * columns + column) * 3)
    }
  }

  return base64Of(new Uint8Array(words.buffer))
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64Of(bytes: Uint8Array): string {
  let text = ''

  for (let at = 0; at < bytes.length; at += 3) {
    const a = bytes[at] ?? 0
    const b = bytes[at + 1] ?? 0
    const c = bytes[at + 2] ?? 0
    const hasB = at + 1 < bytes.length
    const hasC = at + 2 < bytes.length

    text += BASE64.charAt(a >> 2)
    text += BASE64.charAt(((a & 3) << 4) | (b >> 4))
    text += hasB ? BASE64.charAt(((b & 15) << 2) | (c >> 6)) : '='
    text += hasC ? BASE64.charAt(c & 63) : '='
  }

  return text
}

// #region AI-NOTES
// AI-NOTES：agent 專用備忘。當時為真、非契約、非指令；改到相關程式碼時重驗，錯了就刪。
// 2026-10-02 base64 自己寫不用 Uint8Array.toBase64()：官方範例用它，但官方建議的 tsconfig
//   （lib es2023）沒有這個方法的型別，tsc 會報錯。
// 2026-10-02 白毛在淺色主題的終端機幾乎看不見（預覽圖驗過），主人用深色主題所以沒處理；
//   要支援淺色得加外框或換底色。黑毛用 0x55555f 也是為了深色背景看得到。
// 2026-10-02 跑道高度試過 6 列（12 像素、跳得更高），主人說佔空間，定案 5 列；別再主動加高。
// 2026-10-02 小符號一開始是像素拼的（5×5 上下），細的形狀認不出來，主人提議改成單一字元。
//   愛心 ♥（U+2665）在中文環境的終端機可能被畫成兩格寬而把畫面推歪，歪了就改成別的字。
// 2026-10-02 改圖後一定要放大成 PNG 自己看、數耳朵眼睛（9/13 畫過三隻耳朵的毛毛）。
// #endregion
