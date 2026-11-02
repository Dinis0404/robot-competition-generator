# 🤖 機器人競賽 · 抽籤生成器

比賽現場用的抽籤 + 倒計時網頁。純靜態網站（HTML / CSS / JS），**不需安裝任何東西**，放上 GitHub Pages 就能直接用。

## 🎲 現場流程

1. **擲骰抽任務** — 6 個隨機任務（2024/2025 賽季現場任務）中，逐顆擲骰抽出 **3** 個；點數對應任務編號，擲到重複自動重擲
2. **併入固定任務** — 4 個 WER2026 預設任務（扶起老人、自動取藥、用藥提醒、活動健身）自動加入，共 7 個任務
3. **擲十面骰配地點** — 程式先將 7 個任務**隨機排序**（有動畫），再逐一擲**十面骰**：點數直接對應場地模型區 1～10 號位；擲到重複地點自動重擲，**每任務最多重擲 3 次**（超過則從剩餘地點隨機指定），保證 7 個任務地點互不重複
4. **比賽倒計時** — **90 分鐘**（賽前準備時間）大螢幕倒數；正式比賽為 180 秒，把 `config.md` 的 `timer_minutes` 改成 `3` 即可
5. **下一輪** — 時間到後可「🔁 開始下一輪」：**沿用本場任務**，地點配對重新隨機，適合多輪賽制

## 🖥 大屏模式與防誤觸

- **🖥 大屏模式**：倒計時頁一鍵進入全螢幕，只顯示巨型時鐘與頂部細進度條，適合投影；滑鼠靜止 3 秒自動隱藏游標與退出鈕，按 `Esc` 或右上角 ✕ 退出
- **🔒 長按重置**：重置按鈕需**按住 1.2 秒**才會生效，快速誤觸只會左右震動提示，比賽中不怕被碰到

所有任務卡片（含固定任務）都能點開看圖片和完整說明；抽籤結果會存在瀏覽器裡（首頁可查看最近 5 場）。

## ✏️ 如何修改內容（不用寫程式）

所有內容都在 **`content/`** 資料夾，用 GitHub 網頁直接 Edit → Commit 即可，網站自動更新。

### 1. 任務：`content/tasks/S1.md` ~ `R6.md`

```markdown
---
title: 方形梁脫離            ← 任務名稱
image: images/tasks/R1.png   ← 圖片路徑（png / jpg 都可以）
tag: 現場任務 · 100 分        ← 卡片上的小標籤
year: 2024                   ← 有填才會顯示「📅 2024 賽季現場任務」小字
---
### 任務說明
（這裡用 Markdown 自由撰寫，會完整顯示在「點看任務細節」彈窗）

### 計分規則
- 得 **100 分**
- 支援 **粗體**、清單、引用 > 等語法
```

> 卡片縮圖會自動取說明文字的第一行。

### 2. 換圖片：`images/tasks/`

把你的任務圖片放進 `images/tasks/`（建議 800×500、png 或 jpg），然後在對應任務 md 的 `image:` 填上新檔名即可。

目前內建圖片來源：S1～S4 取自 WER2026 規則書 PDF 的任務模型圖、R1～R3 裁切自 2024 賽季現場任務說明照片、R4～R6 裁切自 2025 賽季照片；`images/field-map.jpg` 為場地位置圖（顯示於配對結果與倒計時頁）。

### 3. 地點：`content/locations.md`

```
01 | 起點區
02 | 巡線區
...
```

格式為 `編號 | 名稱`，名稱可留空（`|` 保留）。
第二階段的十面骰點數 1～10 直接對應這裡的 10 個地點，**請維護恰好 10 行**。

### 4. 比賽設定：`content/config.md`

```yaml
title: 機器人競賽 · 抽籤生成器   # 活動名稱
fixed_tasks: S1, S2, S3, S4     # 固定任務代號
random_tasks: R1, R2, R3, R4, R5, R6  # 隨機任務池（骰子六面，最多 6 個）
r_draw: 3                       # 抽出幾個隨機任務
locations_draw: 7               # 抽出幾個地點
timer_minutes: 90               # 倒計時分鐘數
```

> 每個任務代號都要有對應的 `content/tasks/代號.md`。

## 🖥️ 本機預覽

瀏覽器禁止本地檔案直接 fetch，需透過小型伺服器：

- **Windows**：雙擊 `start.bat`（需要已安裝 Python）
- **macOS / Linux**：終端機執行 `./start.sh`
- 或用 VS Code 的 **Live Server** 外掛

然後瀏覽器打開 <http://localhost:8000>

## 🚀 部署到 GitHub Pages

1. 在 GitHub 建立一個 repository（例如 `robot-competition-generator`）
2. 把本專案所有檔案推上去：
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/<你的帳號>/robot-competition-generator.git
   git push -u origin main
   ```
3. 到 repo 頁面 → **Settings** → **Pages** → Source 選 **Deploy from a branch** → Branch 選 **main** / **(root)** → Save
4. 等待 1～2 分鐘，網址就是 `https://<你的帳號>.github.io/robot-competition-generator/`

之後每次修改 md → commit → push，網站一分鐘內自動更新。

## 📁 檔案結構

```
├── index.html          # 頁面結構
├── css/style.css       # 主題樣式與動畫
├── js/
│   ├── md-parser.js    # 極簡 Markdown 解析器
│   ├── audio.js        # 音效（Web Audio 合成，無音檔）
│   ├── confetti.js     # 彩帶粒子
│   ├── dice.js         # 六面骰（抽任務）+ 十面骰（配地點）
│   ├── timer.js        # 倒計時引擎
│   └── app.js          # 主流程
├── content/            # ★ 你要編輯的內容
│   ├── config.md       # 比賽設定
│   ├── locations.md    # 地點清單
│   └── tasks/*.md      # 每個任務一個檔
└── images/tasks/       # ★ 任務圖片
```

## ❓ 常見問題

**Q：抽籤公平嗎？有沒有後台？**
本工具為**純前端**靜態網頁，沒有任何伺服器邏輯；隨機數使用瀏覽器的 `crypto.getRandomValues()`（密碼學等級），過程全程在畫面上演出，重複的自動重擲。原始碼全部公開於 GitHub，頁尾也有連結，任何人都可以檢驗。

**Q：為什麼地點要剛好 10 個？**
第二階段的十面骰點數 1～10 直接對應 `locations.md` 的 10 個地點，數量不符時網站會提示。

**Q：可以直接雙擊 index.html 打開嗎？**
不行，會出現「內容載入失敗」。請用 `start.bat` / Live Server / GitHub Pages。

**Q：想加第 7 個隨機任務？**
骰子是六面，隨機任務池最多 6 個。若要更多，可以把 `r_draw` 和任務池一起改小，或未來改用抽卡模式。

**Q：倒計時中可以暫停嗎？**
可以，「⏸ 暫停」後按「▶ 繼續比賽」接續計時；重置需**長按 1.2 秒**（防誤觸），會回到滿時間。

**Q：多輪比賽怎麼進行？**
時間到後點「🔁 開始下一輪」：任務沿用、地點重新隨機配對，再開一場倒計時。若要連任務都重抽，用「🎲 再來一場（重新抽籤）」。
