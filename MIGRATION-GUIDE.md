# 🚀 Database Migration Guide

## วิธีรัน Migration สำหรับ std_students และ std_attendance

### ขั้นตอนการรัน:

1. **เปิด Supabase SQL Editor**
   ```
   https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/editor
   ```

2. **คลิกที่ "SQL Editor"** ในเมนูด้านซ้าย

3. **กด "+ New query"** เพื่อสร้าง query ใหม่

4. **Copy SQL ทั้งหมด** จากไฟล์ `supabase/migration.sql`

5. **Paste ลงใน SQL Editor**

6. **กดปุ่ม "Run"** (หรือกด Ctrl+Enter / Cmd+Enter)

7. **ตรวจสอบผลลัพธ์:**
   - ✅ ควรเห็น Success message
   - ✅ ควรเห็น NOTICE: Migration Complete!

---

## ตรวจสอบว่า Migration สำเร็จ:

รัน SQL นี้เพื่อตรวจสอบว่าตารางถูกสร้างแล้ว:

```sql
-- ดูตารางทั้งหมดที่ขึ้นต้นด้วย std_
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'std_%'
ORDER BY table_name;
```

**ควรได้:**
- std_attendance
- std_students

---

## ทดสอบ Functions:

```sql
-- ทดสอบว่ามี sample data
SELECT * FROM std_students;

-- ควรเห็น: "ทดสอบ นักเรียน"
```

---

## ถ้ามีปัญหา:

### Problem: ตารางมีอยู่แล้ว
```
ERROR: relation "std_students" already exists
```

**วิธีแก้:** SQL ใช้ `CREATE TABLE IF NOT EXISTS` อยู่แล้ว ไม่มีปัญหา

### Problem: Extension ไม่มี
```
ERROR: extension "uuid-ossp" does not exist
```

**วิธีแก้:** รัน SQL นี้ก่อน:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Problem: RLS Policy มีอยู่แล้ว
```
ERROR: policy "Allow all on std_students" already exists
```

**วิธีแก้:** SQL มี `DROP POLICY IF EXISTS` อยู่แล้ว หรือรันนี้ก่อน:
```sql
DROP POLICY IF EXISTS "Allow all on std_students" ON std_students;
DROP POLICY IF EXISTS "Allow all on std_attendance" ON std_attendance;
```

---

## หลังจากรัน Migration เสร็จ:

ให้รัน script นี้เพื่อตรวจสอบว่าตารางพร้อมใช้งาน:

```bash
node test-mcp.js
```

หรือ

```bash
node scripts/list-all-tables-comprehensive.js
```

ควรเห็น:
- ✅ std_students - 1 record (นักเรียนทดสอบ)
- ✅ std_attendance - 0 records

---

## 📌 สำคัญ:

- **ตาราง std_* เท่านั้น** ที่ปลอดภัยในการแก้ไข
- **ห้ามแก้ไข** ตารางอื่นๆ เช่น profiles, departments, notifications
- Migration นี้ใช้ `IF NOT EXISTS` ทุกที่ รันซ้ำได้ไม่มีปัญหา

---

**ไฟล์ที่เกี่ยวข้อง:**
- SQL Migration: `supabase/migration.sql`
- ตรวจสอบตาราง: `verify-tables.sql`
- Test script: `test-mcp.js`
