// Test Supabase HTTP-based MCP
const https = require('https')

const PROJECT_REF = 'ikfioqvjrhquiyeylmsv'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDgzNDcxNywiZXhwIjoyMDY2NDEwNzE3fQ.iaOMfUDY_FUfnRsjlGSkRNxi4mJj3hYbwvFUmXYfyMI'

async function testMCP() {
  console.log('🧪 Testing Supabase HTTP MCP\n')
  console.log('URL:', `https://mcp.supabase.com/mcp?project_ref=${PROJECT_REF}`)
  console.log('═'.repeat(80), '\n')

  // Test 1: List tables
  console.log('1️⃣  Testing list_tables...')

  try {
    const response = await fetch(`https://mcp.supabase.com/mcp?project_ref=${PROJECT_REF}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'list_tables',
          arguments: {}
        }
      })
    })

    const result = await response.json()

    if (result.error) {
      console.log('❌ Error:', result.error)
    } else {
      console.log('✅ Success!')
      console.log('Tables:', result.result?.content?.[0]?.text || result)
    }

  } catch (error) {
    console.log('❌ Error:', error.message)
  }

  console.log('\n' + '─'.repeat(80) + '\n')

  // Test 2: Execute SQL (migration)
  console.log('2️⃣  Testing execute_sql (migration)...')

  const migrationSQL = `
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

  try {
    const response = await fetch(`https://mcp.supabase.com/mcp?project_ref=${PROJECT_REF}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'execute_sql',
          arguments: {
            query: migrationSQL
          }
        }
      })
    })

    const result = await response.json()

    if (result.error) {
      console.log('❌ Error:', result.error)
    } else {
      console.log('✅ Success! Tables created')
      console.log('Result:', result.result?.content?.[0]?.text || 'Tables created successfully')
    }

  } catch (error) {
    console.log('❌ Error:', error.message)
  }

  console.log('\n' + '═'.repeat(80))
  console.log('✅ MCP Test Complete!')
}

testMCP()
