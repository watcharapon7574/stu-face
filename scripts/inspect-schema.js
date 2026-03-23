const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectSchema() {
  console.log('🔍 Inspecting Production Database Schema\n')
  console.log('Database:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('═'.repeat(80))
  console.log()

  // Tables with actual data
  const tablesToInspect = [
    { name: 'profiles', hasData: true },
    { name: 'departments', hasData: true },
    { name: 'notifications', hasData: true },
    { name: 'students', hasData: false },
    { name: 'attendance', hasData: false },
    { name: 'teachers', hasData: false },
    { name: 'service_points', hasData: false }
  ]

  for (const table of tablesToInspect) {
    console.log(`\n📊 Table: ${table.name}`)
    console.log('─'.repeat(80))

    try {
      // Get table structure by fetching first row
      const { data, error } = await supabase
        .from(table.name)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`  ❌ Error: ${error.message}`)
        continue
      }

      if (!data || data.length === 0) {
        console.log('  ⚠️  No data to inspect structure')

        // Try to get count
        const { count } = await supabase
          .from(table.name)
          .select('*', { count: 'exact', head: true })

        console.log(`  📝 Records: ${count || 0}`)
      } else {
        // Show structure from first record
        const record = data[0]
        const columns = Object.keys(record)

        console.log(`  📝 Columns (${columns.length}):`)
        columns.forEach(col => {
          const value = record[col]
          const type = value === null ? 'null' : typeof value
          const sample = value !== null ?
            (type === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : JSON.stringify(value)) :
            'null'
          console.log(`     • ${col.padEnd(25)} : ${type.padEnd(10)} (${sample})`)
        })

        // Get total count
        const { count } = await supabase
          .from(table.name)
          .select('*', { count: 'exact', head: true })

        console.log(`\n  📈 Total Records: ${count || 0}`)
      }

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`)
    }
  }

  console.log('\n\n' + '═'.repeat(80))
  console.log('✅ Schema Inspection Complete')
  console.log('═'.repeat(80))
  console.log('\n⚠️  REMEMBER: DO NOT modify tables without std_ prefix!\n')
}

inspectSchema()
