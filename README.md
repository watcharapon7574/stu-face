# ระบบเช็คชื่อศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี

ระบบเช็คชื่อด้วย Face Recognition แบบ On-Device สำหรับศูนย์การศึกษาพิเศษ

## 🎯 คุณสมบัติหลัก

- ✅ **Face Recognition บน Browser** - ใช้ @vladmandic/human ประมวลผลบนอุปกรณ์ ไม่ต้องส่งข้อมูลไปยัง Cloud
- ✅ **Rolling Embedding Update** - ระบบเรียนรู้ใบหน้าที่เปลี่ยนไปตามเวลาอัตโนมัติ (เก็บ 20 embeddings ล่าสุด)
- ✅ **Real-time Dashboard** - ดูสถานะการเข้าเรียนแบบ real-time ด้วย Supabase Realtime
- ✅ **PWA Support** - ติดตั้งเป็นแอพบนมือถือได้
- ✅ **3-tier Confidence System**:
  - **อัตโนมัติ** (confidence ≥ 85%) - บันทึกทันที
  - **แนะนำ** (60% - 85%) - แสดง 3 ตัวเลือก ให้ครูเลือก
  - **เลือกเอง** (< 60%) - ให้ครูเลือกจากรายชื่อ

## 🏗️ Tech Stack

```
Frontend:    Next.js 15 (App Router) + React 19 + TypeScript
UI:          shadcn/ui + Tailwind CSS
Face AI:     @vladmandic/human (on-device, browser-based)
Backend:     Next.js API Routes
Database:    Supabase (Postgres + Realtime + Storage)
PWA:         next-pwa
Deploy:      Vercel
```

## 📋 ข้อกำหนดเบื้องต้น

- Node.js 18+
- บัญชี Supabase (ฟรี)
- บัญชี Vercel (ฟรี) - สำหรับ deploy

## 🚀 การติดตั้ง

### 1. Clone และติดตั้ง Dependencies

```bash
# ติดตั้ง dependencies
npm install
```

### 2. ตั้งค่า Supabase

#### 2.1 สร้าง Project บน Supabase
1. ไปที่ [supabase.com](https://supabase.com)
2. สร้าง Project ใหม่
3. คัดลอก URL และ Keys

#### 2.2 สร้าง Database Schema
1. เข้า SQL Editor ใน Supabase Dashboard
2. Copy โค้ดจากไฟล์ `supabase/schema.sql`
3. Run SQL เพื่อสร้าง tables และ functions

#### 2.3 สร้าง Storage Bucket (ถ้าต้องการเก็บรูปภาพ)
1. ไปที่ Storage ใน Supabase Dashboard
2. สร้าง bucket ชื่อ `student-photos`
3. ตั้งค่าเป็น Public

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local`:

```bash
cp .env.example .env.local
```

แก้ไขไฟล์ `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. รันโปรเจกต์

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

## 📱 การใช้งาน

### 1. ลงทะเบียนนักเรียน (Setup)

1. คลิก "ลงทะเบียน" บนหน้าแรก
2. กรอกชื่อ-นามสกุล และชื่อเล่น
3. ถ่ายรูปใบหน้า **5 รูป** (มุมต่างๆ)
4. ระบบจะบันทึก embeddings อัตโนมัติ

### 2. เช็คชื่อ (Attendance)

1. คลิก "เช็คชื่อ" บนหน้าแรก
2. เลือก "เช็คชื่อเข้า" หรือ "เช็คชื่อออก"
3. กดปุ่ม "สแกนใบหน้า"
4. ให้นักเรียนอยู่ในกรอบ
5. ระบบจะจดจำอัตโนมัติหรือให้เลือก

**กรณีต่างๆ:**
- **Confidence ≥ 85%**: บันทึกทันที ✅
- **60-85%**: แสดง 3 ตัวเลือก ให้ครูเลือก
- **< 60%**: ให้ครูเลือกจากรายชื่อทั้งหมด

### 3. ดู Dashboard

1. คลิก "Dashboard" บนหน้าแรก
2. เลือกวันที่ที่ต้องการดู
3. ดูสถิติและรายการเช็คชื่อแบบ real-time

## 🔄 Rolling Embedding Update

ทุกครั้งที่เช็คชื่อสำเร็จด้วย confidence ≥ 85%:
1. ระบบจะเพิ่ม embedding วันนั้นเข้า pool
2. เก็บแค่ 20 embeddings ล่าสุด
3. ทิ้ง embedding เก่าสุดออกอัตโนมัติ
4. ใบหน้าที่เปลี่ยนไปตามเวลา (โต, ผมยาว ฯลฯ) จะถูกเรียนรู้อัตโนมัติ

## 🗃️ Database Schema

```sql
service_points
  - id, name, location, is_main_center

teachers
  - id, name, email, phone, service_point_id

students
  - id, name, nickname, date_of_birth
  - service_point_id
  - embeddings (JSONB, max 20)
  - photo_url, is_active

attendance
  - id, student_id, teacher_id, date
  - check_in, check_out
  - confidence_in, confidence_out
  - method_in, method_out (auto/manual/suggestion)
  - notes
```

## 🚀 Deploy ไปยัง Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# ตั้งค่า Environment Variables ใน Vercel Dashboard
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

หรือใช้ GitHub Integration:
1. Push โปรเจกต์ไปยัง GitHub
2. Import ใน Vercel Dashboard
3. ตั้งค่า Environment Variables
4. Deploy!

## 📱 ติดตั้งเป็น PWA

### บนมือถือ (iOS/Android)
1. เปิดเว็บใน Browser
2. กด "Add to Home Screen" หรือ "ติดตั้ง"
3. เปิดใช้งานเหมือนแอพทั่วไป

### บน Desktop (Chrome/Edge)
1. คลิกไอคอน "+" ที่ Address Bar
2. คลิก "Install"

## 🔧 Troubleshooting

### กล้องไม่ทำงาน
- ตรวจสอบ permission ของ browser
- ต้องใช้ HTTPS (localhost ใช้ได้)

### Face detection ช้า
- ครั้งแรกจะโหลด models (~10-20 MB)
- ครั้งต่อไปจะเร็วขึ้น (cache)

### Real-time ไม่ update
- ตรวจสอบ Supabase Realtime ว่าเปิดใช้งาน
- ตรวจสอบ connection ใน browser console

## 📄 License

MIT

## 👨‍💻 Developer

สร้างด้วย Next.js, Supabase และ @vladmandic/human
สำหรับศูนย์การศึกษาพิเศษ เขต 6 ลพบุรี
