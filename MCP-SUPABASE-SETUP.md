# MCP Supabase Setup Guide

คู่มือการตั้งค่า Model Context Protocol (MCP) สำหรับ Supabase เพื่อให้ AI สามารถเชื่อมต่อและจัดการฐานข้อมูลได้โดยตรง

## 📋 ข้อกำหนดเบื้องต้น

- Node.js และ npm ติดตั้งแล้ว
- Supabase Project (ได้ URL และ API Keys แล้ว)
- Claude Desktop หรือ IDE ที่รองรับ MCP

## 🚀 ขั้นตอนการติดตั้ง

### 1. ตรวจสอบ Supabase Credentials

หาข้อมูลเหล่านี้จาก Supabase Dashboard → Settings → API:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 2. สร้างไฟล์ `.env.local`

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

⚠️ **คำเตือน:** อย่า commit ไฟล์นี้ลง git!

### 3. สร้างไฟล์ `.mcp.json`

สร้างไฟล์ในรากของโปรเจค:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "supabase-mcp"
      ],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key-here",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key-here",
        "MCP_API_KEY": "local-dev-key"
      }
    }
  }
}
```

**ตัวแปรที่ต้องแทนค่า:**
- `SUPABASE_URL` - URL ของ Supabase project
- `SUPABASE_ANON_KEY` - Anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (ใช้สำหรับ admin operations)
- `MCP_API_KEY` - API key สำหรับ MCP (ใช้ค่าอะไรก็ได้ สำหรับ local dev)

### 4. อัพเดท `.gitignore`

เพิ่มบรรทัดเหล่านี้เพื่อป้องกันการ commit ข้อมูลสำคัญ:

```gitignore
# MCP Configuration with credentials
.mcp.json

# Environment variables
.env.local
.env*.local
```

**หมายเหตุ:** สร้าง `.mcp.example.json` สำหรับเป็นตัวอย่างแทน:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "supabase-mcp"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "MCP_API_KEY": "local-dev-key"
      }
    }
  }
}
```

## 🧪 ทดสอบการเชื่อมต่อ

### วิธีที่ 1: รัน MCP Server แบบ Standalone

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_ANON_KEY="your-anon-key" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
MCP_API_KEY="local-dev-key" \
npx -y supabase-mcp
```

ถ้าสำเร็จจะเห็น:
```
Supabase MCP server listening at http://localhost:3000
MCP manifest available at http://localhost:3000/.well-known/mcp-manifest
Press Ctrl+C to stop
```

### วิธีที่ 2: ดู MCP Manifest

```bash
curl http://localhost:3000/.well-known/mcp-manifest | jq .
```

ควรได้ JSON ที่แสดง capabilities และ tools ต่างๆ

### วิธีที่ 3: ทดสอบการ Query ฐานข้อมูล

สร้างไฟล์ `test-mcp.js`:

```javascript
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testConnection() {
  console.log('🔍 Testing Supabase Connection via MCP\n')

  // Test: List all tables
  const { data, error } = await supabase.rpc('get_tables')

  if (error) {
    console.log('Using fallback method...\n')

    // Fallback: Try to access a known table
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (!testError) {
      console.log('✅ Connection successful!')
      console.log('Table "profiles" is accessible')
    } else {
      console.log('❌ Connection failed:', testError.message)
    }
  } else {
    console.log('✅ Connection successful!')
    console.log('Available tables:', data)
  }
}

testConnection()
```

รันทดสอบ:
```bash
npm install @supabase/supabase-js dotenv
node test-mcp.js
```

## 🎯 ใช้งานกับ Claude Desktop

### สำหรับ macOS

1. หาไฟล์ config ของ Claude Desktop:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

2. เพิ่ม MCP server configuration:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "supabase-mcp"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "MCP_API_KEY": "local-dev-key"
      }
    }
  }
}
```

3. Restart Claude Desktop

### สำหรับ Windows

1. หาไฟล์ config:
```
%APPDATA%\Claude\claude_desktop_config.json
```

2. เพิ่ม configuration แบบเดียวกับ macOS
3. Restart Claude Desktop

## 📚 MCP Tools ที่ใช้ได้

เมื่อ setup เสร็จแล้ว MCP จะมี tools เหล่านี้:

### 1. `listTables`
ดูรายชื่อตารางทั้งหมดในฐานข้อมูล

```javascript
{
  "tool": "listTables",
  "parameters": {}
}
```

### 2. `queryDatabase`
Query ข้อมูลจากตาราง

```javascript
{
  "tool": "queryDatabase",
  "parameters": {
    "table": "profiles",
    "select": "id,email,name",
    "query": {
      "email": "user@example.com"
    }
  }
}
```

### 3. `insertData`
เพิ่มข้อมูลลงตาราง

```javascript
{
  "tool": "insertData",
  "parameters": {
    "table": "profiles",
    "data": {
      "email": "newuser@example.com",
      "name": "New User"
    }
  }
}
```

### 4. `updateData`
แก้ไขข้อมูลในตาราง

```javascript
{
  "tool": "updateData",
  "parameters": {
    "table": "profiles",
    "data": {
      "name": "Updated Name"
    },
    "query": {
      "id": "123"
    }
  }
}
```

### 5. `deleteData`
ลบข้อมูลจากตาราง

```javascript
{
  "tool": "deleteData",
  "parameters": {
    "table": "profiles",
    "query": {
      "id": "123"
    }
  }
}
```

## ⚠️ ข้อควรระวัง

### Security Best Practices

1. **อย่า commit credentials ลง git**
   - ใช้ `.gitignore` ป้องกันไฟล์ `.mcp.json` และ `.env.local`
   - สร้าง `.mcp.example.json` สำหรับ template

2. **Service Role Key มีสิทธิ์เต็ม**
   - ระวังการใช้ Service Role Key - มันข้ามทุก Row Level Security (RLS)
   - ใช้เฉพาะใน development environment
   - สำหรับ production ควรใช้ Anon Key + RLS policies

3. **จำกัด Access**
   - ตั้งค่า RLS policies ให้เหมาะสม
   - อย่าเปิดให้ MCP access production database โดยตรง
   - พิจารณาใช้ database แยก สำหรับ development

4. **MCP_API_KEY**
   - สำหรับ local dev ใช้ค่าอะไรก็ได้
   - สำหรับ production ต้องใช้ key ที่แข็งแรงและเก็บไว้ปลอดภัย

## 🐛 Troubleshooting

### ปัญหา: MCP Server ไม่ start

```bash
# ตรวจสอบว่าติดตั้ง package ได้
npm view supabase-mcp

# ลองรันด้วย verbose mode
DEBUG=* npx -y supabase-mcp
```

### ปัญหา: Connection Error

1. ตรวจสอบ credentials ใน `.mcp.json`
2. ตรวจสอบว่า Supabase project ยัง active อยู่
3. ทดสอบ connection ด้วย Supabase client โดยตรง

### ปัญหา: Cannot access tables

1. ตรวจสอบ RLS policies ในตารางนั้นๆ
2. ทดสอบด้วย Service Role Key (ข้าม RLS)
3. ดูตารางที่มีจริงด้วย SQL:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

## 📖 อ้างอิง

- [MCP Official Docs](https://modelcontextprotocol.io/)
- [Supabase MCP Server](https://github.com/Cappahccino/SB-MCP)
- [Supabase Docs - MCP](https://supabase.com/docs/guides/getting-started/mcp)
- [supabase-mcp on npm](https://www.npmjs.com/package/supabase-mcp)

## 📝 Version History

- **v1.0** - Initial setup guide (2026-03-11)
- Package: `supabase-mcp@1.5.0`

---

**Created for:** stu-face project
**Date:** 2026-03-11
**Package:** supabase-mcp v1.5.0
