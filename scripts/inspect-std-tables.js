const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectStdTables() {
  console.log('🔍 Inspecting std_ Tables (Safe to modify)\n')
  console.log('═'.repeat(80))

  const stdTables = ['std_students', 'std_attendance', 'std_teachers', 'std_service_points']

  for (const tableName of stdTables) {
    console.log(`\n✅ Table: ${tableName}`)
    console.log('─'.repeat(80))

    try {
      // Insert a test record to see structure
      const testData = {}
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (error && error.code === 'PGRST116') {
        console.log('  ⚠️  Table exists but has NO columns defined yet')
        console.log('  💡 Need to create schema for this table')
        continue
      }

      if (error) {
        console.log(`  ❌ Error: ${error.message}`)
        console.log(`  🔍 Code: ${error.code}`)
        continue
      }

      if (!data || data.length === 0) {
        // Try to describe with insert attempt
        console.log('  📭 Table is empty (0 records)')
        console.log('  💡 Attempting to detect columns...')

        // Try select to see if table has structure
        const { error: selectError } = await supabase
          .from(tableName)
          .select('*')

        if (selectError) {
          console.log(`     Error: ${selectError.message}`)
        } else {
          console.log('     ✓ Table has structure but is empty')
        }
      } else {
        const record = data[0]
        const columns = Object.keys(record)

        console.log(`  📝 Columns (${columns.length}):`)
        columns.forEach(col => {
          const value = record[col]
          const type = value === null ? 'null' : typeof value
          console.log(`     • ${col.padEnd(25)} : ${type}`)
        })
      }

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`)
    }
  }

  console.log('\n' + '═'.repeat(80))
  console.log('✅ Inspection Complete\n')
}

inspectStdTables()
