const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function executeMigration() {
  console.log('🚀 Executing Migration via Supabase...\n')
  console.log('Database:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('═'.repeat(80), '\n')

  // Step 1: Enable UUID extension
  console.log('1️⃣  Enabling UUID extension...')
  const { error: ext_error } = await supabase.rpc('exec', {})
  // This won't work, need to use REST API directly

  // Alternative: Create tables directly using Supabase client
  console.log('2️⃣  Creating std_students table...\n')

  // We'll use Supabase REST API to execute raw SQL
  const { data: tables, error } = await supabase
    .from('std_students')
    .select('*', { count: 'exact', head: true })

  if (error && error.code === '42P01') {
    console.log('❌ Table std_students does not exist yet')
    console.log('\n⚠️  Supabase JS Client cannot execute DDL statements')
    console.log('\n📋 Using Postgres direct connection instead...\n')

    // Try using postgres:// connection
    const { Client } = require('pg')

    // Get connection string from Supabase
    const connectionString = `postgresql://postgres.ikfioqvjrhquiyeylmsv:${process.env.SUPABASE_DB_PASSWORD}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

    console.log('⚠️  Need database password to connect directly')
    console.log('\nAlternative: Let me create a helper function in Supabase...\n')

    // Create exec_sql function if it doesn't exist
    await createExecSqlFunction()

  } else if (!error) {
    console.log('✅ Table std_students already exists!')
  }
}

async function createExecSqlFunction() {
  console.log('Creating helper function to execute SQL...')

  // This also won't work without direct DB access
  console.log('\n' + '═'.repeat(80))
  console.log('❌ Cannot create tables via Supabase JS client')
  console.log('═'.repeat(80))
  console.log('\n✅ Solution: Use Supabase SQL Editor\n')
  console.log('Please run this in Supabase SQL Editor:')
  console.log('https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/editor\n')

  const sql = fs.readFileSync('./supabase/migration.sql', 'utf8')
  console.log('📄 SQL to run:')
  console.log('─'.repeat(80))
  console.log(sql)
  console.log('─'.repeat(80))
}

executeMigration().catch(console.error)
