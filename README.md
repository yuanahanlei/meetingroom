# 🏢 會議室租借系統

**Next.js + Prisma + PostgreSQL**

這是一套公司內部使用的會議室租借系統，設計重點為：

- 📅 Google Calendar 風格時間軸  
- 🖱 拖曳選取時段建立預約  
- 👥 部門分組與會者選擇  
- 🔒 前端 + 後端雙重防撞期機制  
- 🗓 僅允許預約兩個月內時段  
- 🏢 依會議室容量提供人數建議  

> 本專案以「直覺操作」與「避免撞期」為核心設計原則。

---

## 1️⃣ 技術架構

### 使用技術

- Next.js (App Router)
- Prisma ORM
- PostgreSQL
- Tailwind CSS
- Server Actions

### 核心設計理念

- 單日時間軸操作
- 拖曳選取優先於傳統表單
- 所有預約最終由後端驗證

---

## 2️⃣ 安裝與啟動

```bash
npm install
cp .env.example .env
```

修改 `.env` 內的：

```env
DATABASE_URL=
```

接著執行：

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

啟動後開啟：

```
http://localhost:3000
```

---

## 3️⃣ 主要功能頁面

### `/` 或 `/overview`

#### 主畫面（時間軸總覽）

- 時間範圍：08:30–17:30
- 每 30 分鐘一格
- 會議室橫向排列
- 已預約區塊顯示為灰色
- 空白區域可拖曳選取

---

### 建立預約流程

1. 拖曳選取空白時段  
2. 點擊「預約」  
3. 開啟確認 Modal  
4. 填寫資訊  
5. 送出後刷新畫面  

---

### 預約確認 Modal

#### 功能

- 顯示日期
- 可調整開始 / 結束時間
- 填寫會議主題
- 設定人數
- 選擇與會者（部門分組）

#### 設計特點

- Modal 高度限制在螢幕內
- 與會者區塊獨立滾動
- Footer 固定在底部
- 若時間包含撞期 → 禁止送出

---

### `/me/reservations`

#### 我的預約

- 查看個人預約紀錄
- 可取消預約
- 不限制是否已開始

---

## 4️⃣ 時間設計

### 資料庫欄位

```ts
startAt  DateTime
endAt    DateTime
```

### 時間規則

- 僅允許預約兩個月內
- 以 30 分鐘為單位
- 同 `roomId` 不可重疊

### 時間軸範圍

```
08:30 – 17:30
```

---

## 5️⃣ 防撞期機制

本系統採三層防護：

### ① 前端拖曳即時檢查

拖曳選取時即檢查是否 overlap。

### ② Modal 內再次驗證

調整開始 / 結束時間後重新驗證。

### ③ Server Action 最終檢查

送出時查詢資料庫：

```ts
aStart < bEnd && aEnd > bStart
```

避免 race condition。

---

## 6️⃣ 與會者選擇器

### 元件功能

- 依部門分組
- 預設全部收起
- 可搜尋姓名 / Email / 部門
- 可全部展開 / 收起
- 以 hidden input 傳回 server action

### 設計原則

避免拉長 Modal，高度固定，內部滾動。

---

## 7️⃣ 權限與未來 SSO

目前版本可接：

- 公司 SSO
- JWT
- Session-based 認證

### 預留擴充點

```
src/lib/auth.ts
```

---

## 8️⃣ 上線前建議強化

建議在 PostgreSQL 加入 exclusion constraint：

```sql
EXCLUDE USING gist (
  roomId WITH =,
  tsrange(startAt, endAt) WITH &&
)
WHERE (status = 'CONFIRMED');
```

可在資料庫層級防止撞期。

---

## 9️⃣ UI 設計理念

本專案不是傳統表單型系統，而是：

> 時間軸操作優先

### 設計重點

- 拖曳比選單快
- Modal 不應超出螢幕
- 與會者區塊獨立滾動
- 操作流程盡量在單頁完成

---

## 🔟 未來擴充方向

- 週視圖 / 多日視圖
- 會議室設備篩選
- 管理者封鎖時段
- QR 報到紀錄
- Email / Slack 提醒通知
- 統計報表

---

## 📌 專案定位

這是一套為公司內部設計的會議室管理系統，  
以「直覺操作」、「避免撞期」、「低學習成本」為核心目標。
