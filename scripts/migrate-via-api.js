const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function migrate() {
  console.log('🚀 Running Migration via Supabase Management API\n')

  const sql = fs.readFileSync('./supabase/migration.sql', 'utf8')

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements\n`)

  // Try using Supabase Management API
  const projectRef = 'ikfioqvjrhquiyeylmsv'
  const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

  // This requires a Supabase Access Token, not just service role key
  console.log('⚠️  Management API requires Personal Access Token')
  console.log('Cannot use Service Role Key for DDL operations\n')

  // Alternative: Execute statements individually using edge functions or pg client
  console.log('Trying individual table creation...\n')

  // Statement 1: Create std_students
  const createStudents = `
    CREATE TABLE IF NOT EXISTS std_students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      nickname TEXT,
      service_point TEXT,
      face_embeddings JSONB DEFAULT '[]'::jsonb,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `

  const createAttendance = `
    CREATE TABLE IF NOT EXISTS std_attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES std_students(id) ON DELETE CASCADE,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      teacher_name TEXT,
      check_in TIMESTAMPTZ,
      confidence_in FLOAT,
      method_in TEXT,
      check_out TIMESTAMPTZ,
      confidence_out FLOAT,
      method_out TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(student_id, date)
    );
  `

  // Try with fetch API to Supabase REST API
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: createStudents })
    })

    const result = await response.json()
    console.log('Response:', result)

  } catch (error) {
    console.log('❌ Error:', error.message)
  }

  console.log('\n' + '═'.repeat(80))
  console.log('⚠️  Supabase does not allow DDL via REST API')
  console.log('═'.repeat(80))
  console.log('\n✅ Best solution: Copy and paste into Supabase SQL Editor')
  console.log('\n📋 Steps:')
  console.log('1. Open: https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/editor')
  console.log('2. Click "SQL Editor" → "New query"')
  console.log('3. Copy from: supabase/migration.sql')
  console.log('4. Paste and Run\n')
}

migrate().catch(console.error)
