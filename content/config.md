---
title: 機器人競賽 · 抽籤生成器
fixed_tasks: S1, S2, S3, S4
random_tasks: R1, R2, R3, R4, R5, R6
r_draw: 3
timer_minutes: 90
---

# 設定說明（本段不會顯示在網頁上）

上方 `---` 之間的區域是設定區，改完存檔（GitHub 上直接 Edit → Commit）網站就會更新：

- `title`：活動名稱，顯示在頁面頂部與歡迎畫面
- `fixed_tasks`：固定任務代號，逗號分隔，全部自動加入比賽
- `random_tasks`：隨機任務池代號，逗號分隔（骰子為六面，最多 6 個）
- `r_draw`：要抽出幾個隨機任務
- `timer_minutes`：決賽倒計時分鐘數

注意事項：

- 每個任務代號都要有對應的 `content/tasks/代號.md` 檔案
- 第二階段使用**十面骰**（點數 1～10 直接對應地點），`content/locations.md` 須維護**恰好 10 個地點**
- 任務總數（固定任務 + 抽出的隨機任務）不可超過 10，否則地點不夠分配
