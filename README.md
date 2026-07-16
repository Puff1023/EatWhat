# 今天吃什麼 🍽️

煩惱要吃什麼的時候,轉一下輪盤讓命運決定!

- 🎯 依主題分不同輪盤:早餐、午餐、晚餐、飯類、麵類、飲料
- 🍜 **綜合**輪盤:把所有主題的食物混在一起隨機抽
- ✏️ 直接在手機/網頁上新增、刪除、修改食物,還能自訂新主題
- 📲 可加到手機主畫面,像 App 一樣使用(PWA、離線可用)
- ⚡ 改完內容 push 到 GitHub,網站自動更新

---

## 手機加到主畫面

**iPhone(Safari)**
1. 用 Safari 打開網站
2. 點下方「分享」按鈕 →「加入主畫面」

**Android(Chrome)**
1. 用 Chrome 打開網站
2. 點右上角「⋮」→「安裝應用程式 / 加到主畫面」
3. 或直接點網站裡的「📲 加到主畫面」按鈕

---

## 兩種更新方式

### 1. 平常改食物 —— 不用碰程式碼
直接在網頁右上角按 **✏️**,就能:
- 新增 / 刪除 / 修改食物
- 改主題名稱和圖示
- 用左邊「＋ 主題」新增自己的主題
- 「還原預設」把某個主題還原成原本的清單

> 這些修改存在你自己的手機/瀏覽器裡,不影響別人。

### 2. 改「大家看到的預設」—— 改一個檔案就好
編輯 [`data.js`](data.js),裡面就是各主題的預設食物清單,格式很直覺:

```js
{ id: 'rice', name: '飯類', emoji: '🍚', items: ['滷肉飯', '雞肉飯', ...] }
```

改完 **push 到 GitHub**,GitHub Actions 會自動重新部署,網站幾分鐘內就更新好,
使用者的 App 下次打開也會自動抓到最新版(service worker 快取會自動更新)。

---

## 上線到 GitHub Pages(第一次設定)

1. 在 GitHub 建一個 repo(例如 `EatWhat`)。
2. 把這個資料夾的內容 push 上去(見下方指令)。
3. 到 repo 的 **Settings → Pages → Build and deployment → Source**,選 **GitHub Actions**。
4. 完成!之後每次 push 到 `main` 都會自動部署。
   網址會是:`https://<你的帳號>.github.io/EatWhat/`

```bash
git init
git add .
git commit -m "食物輪盤第一版"
git branch -M main
git remote add origin https://github.com/<你的帳號>/EatWhat.git
git push -u origin main
```

---

## 檔案說明

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 頁面結構 |
| `styles.css` | 樣式 |
| `app.js` | 輪盤邏輯、編輯功能 |
| `data.js` | **預設食物清單(要改內容改這裡)** |
| `manifest.webmanifest` | PWA 設定(名稱、圖示、顏色) |
| `sw.js` | Service Worker(離線 + 自動更新) |
| `icons/` | App 圖示 |
| `.github/workflows/deploy.yml` | 自動部署設定 |
