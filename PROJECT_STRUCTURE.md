# โครงสร้างโปรเจกต์

## 📁 ภาพรวม

```
stu-face/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── attendance/           # API เช็คชื่อ
│   │   │   └── route.ts         # GET/POST attendance
│   │   ├── students/             # API นักเรียน
│   │   │   ├── [id]/
│   │   │   │   └── embeddings/
│   │   │   │       └── route.ts # POST/PUT embeddings
│   │   │   └── route.ts         # GET/POST students
│   │   └── setup/
│   │       └── upload/
│   │           └── route.ts     # POST upload photo
│   ├── attendance/               # หน้าเช็คชื่อ
│   │   └── page.tsx
│   ├── dashboard/                # หน้า Dashboard
│   │   └── page.tsx
│   ├── setup/                    # หน้าลงทะเบียน
│   │   └── page.tsx
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Homepage
│
├── components/                   # React Components
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   └── card.tsx
│   ├── attendance/               # Components สำหรับเช็คชื่อ
│   │   └── face-recognition.tsx
│   ├── dashboard/                # Components สำหรับ Dashboard
│   │   └── real-time-attendance.tsx
│   └── setup/                    # Components สำหรับ Setup
│       └── camera-capture.tsx
│
├── lib/                          # Utility functions
│   ├── supabase/
│   │   ├── client.ts            # Supabase client (browser)
│   │   └── server.ts            # Supabase server client
│   ├── face-detection.ts        # Face recognition logic
│   └── utils.ts                 # Utility functions (cn)
│
├── types/                        # TypeScript types
│   └── database.ts              # Database types
│
├── supabase/                     # Supabase configuration
│   └── schema.sql               # Database schema
│
├── public/                       # Static files
│   └── manifest.json            # PWA manifest
│
├── .env.example                  # Environment variables template
├── .gitignore
├── next.config.ts               # Next.js + PWA config
├── package.json
├── tailwind.config.ts           # Tailwind CSS config
├── tsconfig.json                # TypeScript config
├── README.md                    # เอกสารหลัก
├── SETUP_GUIDE.md               # คู่มือการติดตั้ง
└── PROJECT_STRUCTURE.md         # ไฟล์นี้
```

---

## 📄 รายละเอียดไฟล์สำคัญ

### App Router (`app/`)

#### API Routes (`app/api/`)

##### `/api/students`
```typescript
GET    /api/students
       ?service_point_id=xxx
       &is_active=true
```
- ดึงรายชื่อนักเรียน
- Filter ตาม service point และสถานะ

```typescript
POST   /api/students
Body:  { name, nickname, date_of_birth, service_point_id, photo_url }
```
- สร้างนักเรียนใหม่
- embeddings เริ่มต้นเป็น array ว่าง

##### `/api/students/[id]/embeddings`
```typescript
POST   /api/students/[id]/embeddings
Body:  { embedding: number[] }
```
- เพิ่ม embedding ใหม่ (rolling update)
- ใช้ function `add_student_embedding` จาก database

```typescript
PUT    /api/students/[id]/embeddings
Body:  { embeddings: number[][] }
```
- Replace embeddings ทั้งหมด (สำหรับ setup)
- ใช้ตอนลงทะเบียนครั้งแรก

##### `/api/attendance`
```typescript
GET    /api/attendance
       ?date=2024-01-01
       &student_id=xxx
       &service_point_id=xxx
```
- ดึงข้อมูลการเข้าเรียน
- Filter ตามวันที่, นักเรียน, หรือจุดให้บริการ

```typescript
POST   /api/attendance
Body:  {
  student_id: string,
  teacher_id?: string,
  date: string,
  type: 'check_in' | 'check_out',
  confidence?: number,
  method: 'auto' | 'manual' | 'suggestion'
}
```
- บันทึกการเช็คชื่อ
- Upsert (update ถ้ามี, insert ถ้าไม่มี)

##### `/api/setup/upload`
```typescript
POST   /api/setup/upload
Body:  FormData { file: File, student_id: string }
```
- อัพโหลดรูปนักเรียนไป Supabase Storage
- Return public URL

---

### Components

#### `face-recognition.tsx`
```typescript
<FaceRecognition
  students={Student[]}
  type="check_in" | "check_out"
  onRecognized={(studentId, confidence, method) => void}
  onManualSelect={() => void}
/>
```

**Flow:**
1. เปิดกล้อง
2. Initialize Human library
3. Scan face → detect embedding
4. Compare กับ students array
5. ตัดสินใจตาม confidence:
   - ≥ 85% → auto
   - 60-85% → suggestion
   - < 60% → manual

#### `camera-capture.tsx`
```typescript
<CameraCapture
  targetPhotos={5}
  onComplete={(embeddings: FaceEmbedding[]) => void}
  studentName={string}
/>
```

**Flow:**
1. เปิดกล้อง
2. Initialize Human
3. วนลูปถ่ายรูป 5 ครั้ง
4. แต่ละครั้ง → extract embedding
5. เมื่อครบ → callback พร้อม embeddings array

#### `real-time-attendance.tsx`
```typescript
<RealTimeAttendance
  date={string}
  servicePointId?={string}
/>
```

**Features:**
1. Fetch ข้อมูล attendance จาก API
2. Subscribe Supabase Realtime channel
3. Listen postgres_changes บน table `attendance`
4. Auto-update UI เมื่อมีการเปลี่ยนแปลง

---

### Lib

#### `face-detection.ts`

##### Functions

**`initializeHuman()`**
```typescript
async function initializeHuman(): Promise<Human>
```
- สร้าง instance ของ Human library (singleton)
- Load models จาก CDN
- Warmup สำหรับความเร็ว

**`detectFaces()`**
```typescript
async function detectFaces(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<{
  embeddings: FaceEmbedding[]
  faces: FaceResult[]
}>
```
- Detect หน้าจากภาพ
- Extract embeddings
- Return ทั้ง embeddings และข้อมูล face

**`calculateSimilarity()`**
```typescript
function calculateSimilarity(
  embedding1: FaceEmbedding,
  embedding2: FaceEmbedding
): number
```
- Cosine similarity
- Return 0-1 (1 = เหมือนที่สุด)

**`compareEmbeddings()`**
```typescript
function compareEmbeddings(
  faceEmbedding: FaceEmbedding,
  storedEmbeddings: FaceEmbedding[]
): number
```
- เปรียบเทียบกับ array ของ embeddings
- Return ค่าสูงสุด

**`findBestMatches()`**
```typescript
function findBestMatches<T extends { id: string; embeddings: FaceEmbedding[] }>(
  faceEmbedding: FaceEmbedding,
  students: T[],
  topN: number = 3
): Array<{ student: T; confidence: number }>
```
- หา top N matches
- Sort ตาม confidence
- ใช้ในการแสดงตัวเลือก

---

### Database Schema (`supabase/schema.sql`)

#### Tables

**service_points**
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
location          TEXT
is_main_center    BOOLEAN DEFAULT FALSE
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

**teachers**
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
email             TEXT UNIQUE
phone             TEXT
service_point_id  UUID → service_points(id)
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

**students**
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
nickname          TEXT
date_of_birth     DATE
service_point_id  UUID → service_points(id)
embeddings        JSONB DEFAULT '[]'  -- max 20
photo_url         TEXT
is_active         BOOLEAN DEFAULT TRUE
created_at        TIMESTAMP
updated_at        TIMESTAMP

CONSTRAINT embeddings_max_length CHECK (jsonb_array_length(embeddings) <= 20)
```

**attendance**
```sql
id                UUID PRIMARY KEY
student_id        UUID → students(id) CASCADE
teacher_id        UUID → teachers(id) SET NULL
date              DATE NOT NULL
check_in          TIMESTAMP
check_out         TIMESTAMP
confidence_in     FLOAT
confidence_out    FLOAT
method_in         TEXT CHECK IN ('auto', 'manual', 'suggestion')
method_out        TEXT CHECK IN ('auto', 'manual', 'suggestion')
notes             TEXT
created_at        TIMESTAMP
updated_at        TIMESTAMP

UNIQUE(student_id, date)
```

#### Functions

**`add_student_embedding(student_uuid, new_embedding)`**
```sql
1. GET current embeddings
2. APPEND new_embedding
3. IF length > 20 THEN remove oldest (index 0)
4. UPDATE student record
```

---

## 🔄 Data Flow

### Setup Flow (ลงทะเบียนนักเรียน)

```
User Input (name, nickname)
    ↓
CameraCapture Component
    ↓
ถ่ายรูป 5 รูป → detect faces → extract 5 embeddings
    ↓
POST /api/students → สร้าง student record
    ↓
PUT /api/students/[id]/embeddings → บันทึก embeddings
    ↓
Success!
```

### Attendance Flow (เช็คชื่อ)

```
เลือก check_in/check_out
    ↓
FaceRecognition Component
    ↓
เปิดกล้อง → สแกนใบหน้า
    ↓
detectFaces() → embedding
    ↓
findBestMatches(embedding, students)
    ↓
if confidence ≥ 85%:
    → onRecognized('auto') → POST /api/attendance
elif 60% ≤ confidence < 85%:
    → แสดง 3 ตัวเลือก
    → ครูเลือก → onRecognized('suggestion') → POST /api/attendance
else:
    → onManualSelect() → ครูเลือกจากรายชื่อ
    → onRecognized('manual') → POST /api/attendance
    ↓
Success + Rolling Update
```

### Dashboard Flow (Real-time)

```
RealTimeAttendance Component
    ↓
1. Fetch: GET /api/attendance?date=xxx
    ↓
2. Subscribe: Supabase Realtime
    ↓
3. Listen: postgres_changes on 'attendance' table
    ↓
4. On change:
   - INSERT → fetch full record → add to list
   - UPDATE → fetch full record → update in list
   - DELETE → remove from list
    ↓
5. Auto re-render (React state)
```

---

## 🔐 Security

### Row Level Security (RLS)

ปัจจุบันตั้งค่าเป็น "Allow all" สำหรับทุก table:
```sql
CREATE POLICY "Allow all on students" ON students
  FOR ALL USING (true) WITH CHECK (true);
```

**สำหรับ Production ควรเปลี่ยนเป็น:**
```sql
-- ตัวอย่าง: ครูเห็นได้แค่นักเรียนในจุดให้บริการของตัวเอง
CREATE POLICY "Teachers see own service point students" ON students
  FOR SELECT
  USING (
    service_point_id IN (
      SELECT service_point_id FROM teachers
      WHERE id = auth.uid()
    )
  );
```

### Environment Variables

**Public (ส่งไป browser ได้):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Secret (server-side only):**
- `SUPABASE_SERVICE_ROLE_KEY` - มี permission เต็ม, ห้ามส่งไป browser!

---

## 🚀 Performance Optimization

### Face Detection

1. **Model Loading**
   - Models download ครั้งแรก ~10-20 MB
   - Cache ใน browser
   - Warmup เพื่อความเร็ว

2. **On-Device Processing**
   - ไม่ต้องส่งภาพไป server
   - ประมวลผลบน GPU (WebGL backend)
   - รวดเร็ว 1-2 วินาที

### Database

1. **Indexes**
   ```sql
   idx_students_service_point
   idx_students_active
   idx_attendance_student_date
   ```

2. **JSONB for Embeddings**
   - Efficient storage
   - ค้นหาได้ด้วย operators

### PWA

1. **Service Worker**
   - Cache static assets
   - Offline-first strategy (partial)

2. **Code Splitting**
   - Next.js automatic code splitting
   - Load เฉพาะหน้าที่ใช้

---

## 📊 Monitoring & Debugging

### Browser Console

**Human library:**
```javascript
// ดู Human instance
window.humanInstance

// ดู config
console.log(humanInstance.config)
```

**Supabase:**
```javascript
// ดู connection
console.log(supabase)

// Test query
const { data, error } = await supabase
  .from('students')
  .select('*')
  .limit(5)
console.log(data, error)
```

### Supabase Dashboard

1. **Table Editor** - ดูข้อมูลใน tables
2. **SQL Editor** - Run queries
3. **Logs** - ดู API requests
4. **Realtime** - Monitor connections

---

## 🔧 Customization

### เปลี่ยน Confidence Thresholds

Edit `types/database.ts`:
```typescript
export const CONFIDENCE_THRESHOLD = {
  AUTO: 0.90,        // เคร่งครัดขึ้น (เดิม 0.85)
  SUGGESTION: 0.70,  // เคร่งครัดขึ้น (เดิม 0.60)
  MANUAL: 0.70,
}
```

### เพิ่ม Max Embeddings

Edit `supabase/schema.sql`:
```sql
-- เปลี่ยนจาก 20 เป็น 30
CONSTRAINT embeddings_max_length CHECK (jsonb_array_length(embeddings) <= 30)
```

และ `lib/face-detection.ts`:
```typescript
// Comment อธิบาย max embeddings
/**
 * Rolling update - เก็บ 30 embeddings ล่าสุด
 */
```

### เพิ่ม Authentication

1. เปิดใช้ Supabase Auth
2. เพิ่ม Middleware ใน Next.js
3. Update RLS policies
4. เพิ่มหน้า Login/Logout

---

**สร้างด้วย Next.js 15 + Supabase + @vladmandic/human**
