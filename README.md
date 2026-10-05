# 毛毛：8-bit 垂耳兔在輸入框上面

一個 [Claude Code](https://claude.com/claude-code) 的 mod。8-bit 的黑白荷蘭垂耳兔「毛毛」在輸入框上方：等你打字時攤平、Claude 工作時跑、用工具時跳。訊息裡叫「毛毛」或「乖毛」他會開心跳兩下。`/maomao` 打一次關、再打一次開。

English summary at the end.



`tools/` 是改像素圖時自己看用的預覽工具（bun 加 python3），不影響 mod 本身。毛毛是 Jesse 家的兔子，七歲，右眼一圈黑、鼻頭一個黑點，畫的時候對照的是本尊。

## 需要什麼

- Claude Code **2.1.287 以上**（mod 功能 2026-10-01 起預設開放）。
- 不用 Node、不用裝套件。mod 跑在 Claude Code 自己的引擎裡。

## 安裝

**用 marketplace（推薦）**

```bash
claude plugin marketplace add jessetsai1024/claude-maomao
claude plugin install maomao@claude-maomao
```

然後在對話裡打 `/reload-plugins`，或重開 Claude Code。

**或者 clone 下來接捷徑**（之後 `git pull` 就是更新）

macOS／Linux：

```bash
git clone https://github.com/jessetsai1024/claude-maomao.git
cd claude-maomao && ./install.sh
```

Windows（原生版，在 PowerShell 裡）：

```powershell
git clone https://github.com/jessetsai1024/claude-maomao.git
cd claude-maomao
.\install.ps1
```

原理：放在 `~/.claude/skills/maomao/` 底下的 plugin 會被 Claude Code 自動載入，腳本只是建一個捷徑指回這個 repo（Windows 用目錄接合點，不需要管理員權限）。PowerShell 說不准跑腳本就先 `Set-ExecutionPolicy -Scope Process Bypass`。裝完關掉所有 Claude Code 視窗再重開。

移除：`./uninstall.sh` 或 `.\uninstall.ps1`，只拿掉捷徑。

## 注意

- 不要同時用兩種方式載入同一個 mod（marketplace 裝了就不要再接捷徑；`settings.json` 的 `env` 裡也別再放 `CLAUDE_CODE_PLUGIN_DIRS` 指到它），會出現兩份。
- **Windows 還沒實機跑過。**路徑處理有單元測試，但作者手邊沒有 Windows 機器。有問題請開 issue，附 Claude Code 版本和畫面。
- 想改：直接改檔案，存檔後 Claude Code 會熱重載。`claude plugin validate .`、`claude plugin test .`；第一次載入後 `.claude-plugin/types/` 會出現型別檔，之後 `tsc -p .` 可以做型別檢查（那個資料夾是引擎寫的，已在 `.gitignore`）。

## 來歷

2026 年 10 月 2 日到 3 日之間做的，作者是 Jesse 與螢（鏡 螢，號石火，一個 Claude 分身）。原本六個 mod 放在同一個 repo claude-mods，10 月 6 日拆成一個 mod 一個 repo，舊 repo 已移除。MIT 授權。

---

## English

**maomao** is a mod for Claude Code: An 8-bit black-and-white Holland Lop rabbit that lives in the band above the prompt: flops while you type, runs while Claude works, hops on every tool call. Say "毛毛" in a message and he does a happy double hop. `/maomao` toggles him.  `tools/` holds preview scripts (bun + python3) for editing the sprites; the mod does not need them. Maomao is a real rabbit.

Install with `claude plugin marketplace add jessetsai1024/claude-maomao` then `claude plugin install maomao@claude-maomao`; or clone and run `./install.sh` (macOS/Linux) or `.\install.ps1` (native Windows, junction, no admin), which links the repo into `~/.claude/skills/maomao` so `git pull` is the update. Requires Claude Code ≥ 2.1.287. UI text is Traditional Chinese. Windows has unit tests but no on-device test yet. Split out of a former six-mod repo on 2026-10-06. MIT.
