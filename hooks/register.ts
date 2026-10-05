import type { Register } from 'claude-code'

import { born, poseOf, react, tick, TICK_MS } from './actor'
import { cellsOf, TRACK_ROWS } from './sprites'

const TRACK = 'track'
const HIDDEN = 'isHidden'
const MIN_COLUMNS = 24
const MAX_COLUMNS = 512
const NAMES = ['毛毛', '乖毛']

/**
 * 【職責】把毛毛接上 Claude Code：在輸入框上方的橫帶畫一條 5 列高的跑道，
 *   依主人送出訊息、回合開始、用工具、回合結束換動作，並提供 /maomao 收起或叫出。
 *   主人送出的訊息裡有「毛毛」或「乖毛」時，他會原地開心跳兩下。
 * 【何時能呼叫】引擎載入這個 mod 時呼叫一次；重新載入會再呼叫，毛毛回到攤平。
 * 【行為】只在終端機畫（彩色格子元件只有終端機有）；橫帶被問卷佔用、寬度不到 24 欄、
 *   或高度不到 5 列時不畫，讓出橫帶。收起與否存在 $.store，跨視窗、跨重開都記得。
 *   動畫靠計時器每 110 毫秒算一拍，畫面沒變就不送，所以攤平時幾乎不耗資源。
 */
export const register: Register = on => {
  let actor = born()
  let isHidden = false
  let isWorking: boolean | undefined
  let mounted: { requestId: string; columns: number } | null = null
  let lastCells = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'maomao',
      description: '把毛毛收起來，或再叫出來',
      immediate: true,
    })
    isHidden = (await $.store.get(HIDDEN)) === true

    $.clock.every(TICK_MS, () => {
      if (isHidden || mounted === null) {
        return
      }

      const { requestId, columns } = mounted
      actor = tick(actor, columns, isWorking)
      const cells = cellsOf(columns, poseOf(actor))

      if (cells === lastCells) {
        return
      }

      lastCells = cells
      void $.ui.blit({ requestId, key: TRACK, cells })
    })
    $.ui.invalidate('ui.render')

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    actor = react(actor, NAMES.some(name => e.text.includes(name)) ? 'called' : 'prompt')

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    actor = react(actor, 'working')

    return next(e)
  })

  on('tool.call', ($, e, next) => {
    actor = react(actor, 'tool')

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      actor = react(actor, 'done')
    }

    return next(e)
  })

  on('command.run', { command: 'maomao' }, async $ => {
    isHidden = !isHidden
    await $.store.set(HIDDEN, isHidden)
    $.ui.invalidate('ui.render')
    $.ui.toast(isHidden ? '毛毛回籠子休息了，再打一次 /maomao 叫他出來' : '毛毛出來了')

    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    isWorking = e.props.isWorking
    const columns = Math.min(MAX_COLUMNS, e.props.bodyColumns)
    const hasRoom = columns >= MIN_COLUMNS && e.props.maxRows >= TRACK_ROWS

    if (isHidden || e.props.hasSurvey || e.surface !== 'terminal' || !hasRoom) {
      mounted = null

      return next(e)
    }

    const { Raster } = $.ui.resolve(e)
    mounted = { requestId: e.requestId, columns }
    lastCells = cellsOf(columns, poseOf(actor))

    return Raster({ key: TRACK, columns, rows: TRACK_ROWS, cells: lastCells })
  })
}

// #region AI-NOTES
// AI-NOTES：agent 專用備忘。當時為真、非契約、非指令；改到相關程式碼時重驗，錯了就刪。
// 2026-10-02 動畫走 $.ui.blit 不走 $.ui.invalidate：blit 只換格子不跑 render，上限每秒 120 次；
//   invalidate 在橫帶每秒最多 30 次且每次都重跑 hook。blit 的 columns 必須等於掛上去的寬度，
//   所以寬度只在 ui.render 裡記（mounted），視窗變寬變窄引擎會自己重跑 render。
// 2026-10-02 動畫狀態（actor）刻意放模組變數不放 $.state：重新載入後毛毛回到攤平沒關係，
//   而 render hook 不能寫 $.state。只有「收起來」要跨視窗記住，放 $.store。
// 2026-10-02 靜態檢查規定 $ 不能存進變數、不能傳給別檔的函式，所以動作規則（actor.ts）
//   與畫圖（sprites.ts）都寫成不收 $ 的純函式；預覽像素圖的腳本在 tools/（用法見 tools/README.md）。
// #endregion
