# 會議室租借 (Next.js + Prisma + Postgres) — v2

這是一個「可先跑起來」的第一版原型，對齊我們定案的架構：
- 小樹屋式：先選 **日期/時段/人數** → 回傳「可借會議室清單」
- 隱私：非預約人/管理員只看到忙/閒（v1 先以 mock auth 示範）
- 取消：預約人/管理者都可取消（不限制是否已開始）
- 掃碼：Phase 1 報到紀錄（Room QR）

> ⚠️ v1 使用 **Mock Auth**（用環境變數代表登入者），之後可替換成公司 SSO。

---

## 1) 安裝與啟動

```bash
npm i
cp .env.example .env
# 修改 DATABASE_URL
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

打開： http://localhost:3000

---

## 2) 功能頁面

- `/search`：搜尋可借會議室（主入口）
- `/rooms/[id]`：單一會議室時間軸（當日）
- `/reservations/new?roomId=...&start=...&end=...`：建立預約
- `/me/reservations`：我的預約（可取消）
- `/scan/room/[id]`：掃碼報到（寫入 AccessLog）

---

## 3) 重要設計（v1）

### 時間欄位
- DB 使用 `startAt` / `endAt`（timestamp）
- UI 以「單日 + start/end」操作

### 不撞期
- v1 先用 API transaction + overlap 查詢防呆（可跑、易懂）
- 上線建議改用 Postgres exclusion constraint（README 內有建議 SQL）

---

## 4) 未來要接 SSO
把 `src/lib/auth.ts` 換成你們的 SSO session 取得方式即可。

---

## 5) 建議的 Postgres 強化（上線前）
用 `tsrange` + `EXCLUDE USING gist` 防止同 roomId 的時間重疊（只針對 CONFIRMED）：

請參考 `prisma/migrations/README_exclusion_constraint.md`
