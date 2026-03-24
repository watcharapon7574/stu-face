const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listTablesViaMCP() {
  console.log('📊 Listing all tables via Supabase Client')
  console.log('=' .repeat(80))

  // Query information_schema to get all tables
  const { data, error } = await supabase.rpc('list_tables')

  if (error) {
    console.log('ℹ️  RPC function not available, using direct query...\n')

    // Fallback: use the script we already have
    const possibleTables = [
      'profiles', 'departments', 'notifications',
      'students', 'attendance', 'teachers', 'service_points',
      'std_students', 'std_attendance', 'std_teachers', 'std_service_points',
      'users', 'roles', 'permissions', 'settings', 'configs',
      'classes', 'courses', 'grades', 'subjects', 'schedules', 'rooms',
      'task_assignments', 'tasks', 'projects'
    ]

    const foundTables = []

    for (const tableName of possibleTables) {
      try {
        const { error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (!error) {
          foundTables.push({ name: tableName, count: count || 0 })
        }
      } catch (e) {
        // Skip tables that don't exist
      }
    }

    console.log('✅ Found Tables:\n')
    foundTables
      .sort((a, b) => b.count - a.count)
      .forEach(table => {
        console.log(`  • ${table.name.padEnd(30)} - ${table.count} records`)
      })

    console.log('\n' + '─'.repeat(80))
    console.log(`Total: ${foundTables.length} tables found`)

  } else {
    console.log('Tables:', data)
  }
}

listTablesViaMCP()
