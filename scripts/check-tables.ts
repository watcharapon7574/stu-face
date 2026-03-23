import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTables() {
  console.log('🔍 Checking existing tables in database...\n')

  try {
    // Query to get all tables in the public schema
    const { data, error } = await supabase.rpc('get_tables', {})

    if (error) {
      // Fallback: Try alternative method
      const { data: tables, error: err2 } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')

      if (err2) {
        console.error('❌ Error fetching tables:', err2.message)
        console.log('\n⚠️  Trying alternative method...\n')

        // Manual query using raw SQL
        const result = await supabase.rpc('exec_sql', {
          query: `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
          `
        })

        if (result.error) {
          console.error('❌ Cannot fetch tables. You may need to run this in Supabase SQL Editor:')
          console.log(`
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
          `)
          process.exit(1)
        }
      } else {
        console.log('📊 Existing tables in database:')
        console.log('─'.repeat(50))
        tables?.forEach((table: any) => {
          console.log(`  • ${table.table_name}`)
        })
        console.log('─'.repeat(50))
        console.log(`\n✅ Total: ${tables?.length || 0} tables\n`)

        console.log('⚠️  IMPORTANT RULES:')
        console.log('  1. DO NOT modify or delete existing tables')
        console.log('  2. ALL new tables MUST start with: std_')
        console.log('  3. Example: std_students, std_attendance, std_teachers\n')
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

checkTables()
