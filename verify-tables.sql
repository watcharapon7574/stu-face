-- SQL Script เพื่อตรวจสอบตารางทั้งหมดในฐานข้อมูล Supabase
-- รันใน Supabase SQL Editor แล้วส่งผลลัพธ์กลับมาให้ผมดูครับ

-- 1. แสดงตารางทั้งหมดใน schema public
SELECT
    table_name,
    table_type
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY
    table_name;

-- 2. นับจำนวน records ในแต่ละตาราง (ถ้าอยากรู้)
-- หมายเหตุ: comment บรรทัดนี้ออกถ้าต้องการดูจำนวน records
/*
SELECT
    schemaname,
    tablename,
    n_live_tup as row_count
FROM
    pg_stat_user_tables
WHERE
    schemaname = 'public'
ORDER BY
    n_live_tup DESC;
*/

-- 3. แสดงเฉพาะตารางที่ขึ้นต้นด้วย std_
SELECT
    table_name
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name LIKE 'std_%'
ORDER BY
    table_name;
