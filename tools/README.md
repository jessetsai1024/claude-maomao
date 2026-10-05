# 預覽工具（改像素圖後自己看用）

在這個資料夾裡跑，輸出的 json 與 png 都留在這裡，不進版本管理也沒關係。

    bun run dump.ts > frames.json && python3 render.py   # 各姿勢並排：preview-dark.png、preview-light.png
    bun run sim.ts  > sim.json    && python3 strip.py    # 一整輪動作的連環圖：strip-1.png、strip-2.png

改圖之後一定要打開圖看：側面一隻耳朵、一個眼罩、鼻頭下面一個黑點。
