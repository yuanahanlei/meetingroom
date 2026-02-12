# 🏢 會議室租借系統  
> Next.js + Prisma + PostgreSQL

一套專為公司內部打造的會議室租借系統。  
設計核心為：**直覺操作、避免撞期、低學習成本。**

---

## ✨ 功能特色

- 📅 Google Calendar 風格時間軸
- 🖱 拖曳選取時段建立預約
- 👥 部門分組與會者選擇器
- 🔒 前端 + 後端雙重防撞期驗證
- 🗓 僅允許預約兩個月內時段
- 🏢 依會議室容量提供人數建議
- ⚡ 單頁操作完成預約流程

---

# 🧱 技術架構

| 技術 | 說明 |
|------|------|
| Next.js (App Router) | 前端 + Server Actions |
| Prisma ORM | 型別安全資料庫操作 |
| PostgreSQL | 主資料庫 |
| Tailwind CSS | UI 設計 |
| Server Actions | 後端驗證邏輯 |

---

# 🚀 安裝與啟動

## 1️⃣ 安裝套件

```bash
npm install
```

## 2️⃣ 設定環境變數

```bash
cp .env.example .env
```

修改：

```
DATABASE_URL="postgresql://user:password@localhost:5432/meeting"
```

---

## 3️⃣ 建立資料庫

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

---

## 4️⃣ 啟動開發環境

```bash
npm run dev
```

開啟瀏覽器：

```
http://localhost:3000
```

---

# 🖥 主要頁面

## `/` 或 `/overview`

### 📊 主畫面（時間軸總覽）

- 時間範圍：08:30–17:30
- 每 30 分鐘一格
- 會議室橫向排列
- 已預約顯示為灰色
- 空白區域可拖曳選取

---

# 📝 建立預約流程

1. 拖曳選取空白時段  
2. 點擊「預約」  
3. 開啟確認 Modal  
4. 填寫資訊  
5. 送出 → 即時刷新畫面  

---

# 📦 預約確認 Modal

### 功能

- 顯示日期
- 可調整開始 / 結束時間
- 填寫會議主題
- 設定人數
- 部門分組與會者選擇

### UI 設計原則

- Modal 高度不超出螢幕
- 與會者區塊獨立滾動
- Footer 固定
- 若撞期 → 禁止送出

---

# 👤 `/me/reservations`

### 我的預約

- 查看個人預約紀錄
- 可取消預約
- 不限制是否已開始

---

# ⏰ 時間設計

## 資料庫欄位

```ts
startAt  DateTime
endAt    DateTime
```

## 規則

- 僅允許預約兩個月內
- 30 分鐘為單位
- 同 `roomId` 不可時間重疊
- 時間軸固定 08:30–17:30

---

# 🛡 防撞期機制

系統採三層防護：

---

### ① 前端即時檢查

拖曳時即判斷是否 overlap。

---

### ② Modal 內再次驗證

使用者調整時間時重新驗證。

---

### ③ Server Action 最終檢查

```ts
aStart < bEnd && aEnd > bStart
```

避免 race condition。

---

# 🧑‍🤝‍🧑 與會者選擇器

元件：

```tsx
<AttendeePicker />
```

功能：

- 依部門分組
- 預設收合
- 支援搜尋
- 全部展開 / 收合
- hidden input 傳回 server action

設計目標：

> Modal 高度固定、內容內部滾動、不干擾操作。

---

# 🔐 權限設計

可擴充：

- 公司 SSO
- JWT
- Session-based 認證

預留檔案：

```
src/lib/auth.ts
```

---

# 🧠 上線前強化建議

建議加入 PostgreSQL Exclusion Constraint：

```sql
EXCLUDE USING gist (
  roomId WITH =,
  tsrange(startAt, endAt) WITH &&
)
WHERE (status = 'CONFIRMED');
```

資料庫層級防撞期。

---

# 🎨 UI 設計理念

本專案不是傳統表單系統。

核心原則：

- 拖曳 > 下拉選單
- 單頁完成操作
- 不跳頁
- 不過度彈窗
- 視覺清楚優先於功能堆疊

---

# 🔮 未來擴充方向

- 週視圖 / 多日視圖
- 會議室設備篩選
- 管理者封鎖時段
- QR Code 報到
- Email / Slack 通知
- 使用統計報表
- 管理後台

---

# 📌 專案定位

這是一套為公司內部設計的會議室管理系統，  
以：

- 直覺操作  
- 避免撞期  
- 低學習成本  

為核心目標。

---

# 📄 License

Internal Use Only  
