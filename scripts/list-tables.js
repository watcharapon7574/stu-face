const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listTables() {
  console.log('🔍 Checking existing tables...\n')

  // Try to list some common tables to see what exists
  const tablesToCheck = [
    'students', 'attendance', 'teachers', 'service_points',
    'std_students', 'std_attendance', 'std_teachers', 'std_service_points'
  ]

  console.log('📊 Testing table access:\n')

  for (const table of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        console.log(`  ✅ ${table} - exists (${count || 0} records)`)
      }
    } catch (e) {
      // Table doesn't exist, skip
    }
  }

  console.log('\n⚠️  IMPORTANT:')
  console.log('  • DO NOT modify existing tables')
  console.log('  • New tables MUST use prefix: std_')
  console.log('  • Example: std_students, std_attendance\n')
}

listTables()
