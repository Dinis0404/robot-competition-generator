# 🤖 機器人競賽 · 抽籤生成器

比賽現場用的抽籤 + 倒計時網頁。純靜態網站（HTML / CSS / JS），**不需安裝任何東西**，放上 GitHub Pages 就能直接用。

## 🎲 現場流程

1. **擲骰抽任務** — 6 個隨機任務（R1～R6）中，逐顆擲骰抽出 **3** 個；點數對應任務編號，擲到重複自動重擲
2. **併入固定任務** — 4 個固定任務（S1～S4）自動加入，共 7 個任務
3. **翻卡抽地點** — 10 張卡牌洗牌後點擊翻牌（或自動揭曉），翻出 **7** 個地點，同時揭曉「地點 → 任務」隨機配對
4. **比賽倒計時** — **90 分鐘**大螢幕倒數：最後 10 分鐘轉黃、最後 1 分鐘轉紅、最後 10 秒逐秒提示音、時間到警報 + 彩帶

所有任務卡片（含固定任務）都能點開看圖片和完整說明；抽籤結果會存在瀏覽器裡（首頁可查看最近 5 場）。

## ✏️ 如何修改內容（不用寫程式）

所有內容都在 **`content/`** 資料夾，用 GitHub 網頁直接 Edit → Commit 即可，網站自動更新。

### 1. 任務：`content/tasks/S1.md` ~ `R6.md`

```markdown
---
title: 巡線競速              ← 任務名稱
image: images/tasks/R1.png   ← 圖片路徑（png / jpg / svg 都可以）
tag: 隨機任務                 ← 卡片上的小標籤
---
### 任務說明
（這裡用 Markdown 自由撰寫，會完整顯示在「點看任務細節」彈窗）

### 計分規則
- 每項 10 分
- 支援 **粗體**、清單、引用 > 等語法
```

> 卡片縮圖會自動取說明文字的第一行。

### 2. 換圖片：`images/tasks/`

把你的任務圖片放進 `images/tasks/`（建議 800×500、png 或 jpg），然後在對應任務 md 的 `image:` 填上新檔名即可。

### 3. 地點：`content/locations.md`

```
01 | 起點區
02 | 巡線區
...
```

格式為 `編號 | 名稱`，名稱可留空（`|` 保留），增減行數即可。

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
│   ├── dice.js         # 3D 骰子
│   ├── locboard.js     # 地點卡（洗牌 / 翻牌）
│   ├── timer.js        # 倒計時引擎
│   └── app.js          # 主流程
├── content/            # ★ 你要編輯的內容
│   ├── config.md       # 比賽設定
│   ├── locations.md    # 地點清單
│   └── tasks/*.md      # 每個任務一個檔
└── images/tasks/       # ★ 任務圖片
```

## ❓ 常見問題

**Q：抽籤公平嗎？**
隨機數使用瀏覽器的 `crypto.getRandomValues()`（密碼學等級），每次點擊都是獨立公平抽取。

**Q：可以直接雙擊 index.html 打開嗎？**
不行，會出現「內容載入失敗」。請用 `start.bat` / Live Server / GitHub Pages。

**Q：想加第 7 個隨機任務？**
骰子是六面，隨機任務池最多 6 個。若要更多，可以把 `r_draw` 和任務池一起改小，或未來改用抽卡模式。

**Q：倒計時中可以暫停嗎？**
可以，「⏸ 暫停」後按「▶ 繼續比賽」接續計時；「↺ 重置」回滿時間。
