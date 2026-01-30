# Postgres exclusion constraint（上線前建議）

Prisma 目前對 `EXCLUDE USING gist` 的支援需要手動加 migration SQL。

概念（只示意）：

1) 確認已安裝 extension：
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

2) 增加 generated tsrange 欄位或直接用 expression：
```sql
ALTER TABLE "Reservation"
  ADD COLUMN "timeRange" tsrange
  GENERATED ALWAYS AS (tsrange("startAt", "endAt", '[)')) STORED;
```

3) 加上排除約束（只限制 CONFIRMED/BLOCKED）：
```sql
ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    "roomId" WITH =,
    "timeRange" WITH &&
  )
  WHERE ("status" IN ('CONFIRMED', 'BLOCKED'));
```

這樣可確保任何併發下都不會出現時間重疊。
