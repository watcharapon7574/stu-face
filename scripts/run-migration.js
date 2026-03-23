const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  console.log('🚀 Running Migration...\n')

  // Read SQL file
  const sqlPath = path.join(__dirname, '../supabase/migration.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('📄 SQL File:', sqlPath)
  console.log('📊 Database:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('─'.repeat(80))

  try {
    // Execute SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Fallback: Try direct SQL execution (Supabase doesn't have exec_sql by default)
      console.log('ℹ️  Using direct Postgres query...\n')

      // Split SQL into statements and execute one by one
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      console.log(`📝 Found ${statements.length} SQL statements\n`)

      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i] + ';'

        // Skip comments and DO blocks for now
        if (stmt.startsWith('--') || stmt.includes('DO $$')) {
          continue
        }

        try {
          const result = await supabase.rpc('exec', { query: stmt })
          if (!result.error) {
            successCount++
          } else {
            console.log(`❌ Error in statement ${i + 1}:`, result.error.message)
            errorCount++
          }
        } catch (e) {
          // This approach won't work - we need to use Supabase SQL Editor
          break
        }
      }

      console.log('\n⚠️  Cannot execute SQL directly via Supabase JS client')
      console.log('📋 Please run the migration manually:\n')
      console.log('1. Go to: https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/editor')
      console.log('2. Click "SQL Editor"')
      console.log('3. Copy content from: supabase/migration.sql')
      console.log('4. Paste and click "Run"\n')
      console.log('─'.repeat(80))

      return
    }

    console.log('✅ Migration executed successfully!')
    console.log('Data:', data)

  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

runMigration()
