const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

async function runMigration() {
  console.log('🚀 Running Migration via Direct Postgres Connection\n')

  // Supabase connection string
  // Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
  const projectRef = 'ikfioqvjrhquiyeylmsv'

  // Extract password from service role key (it's the JWT itself for connection)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Supabase Postgres connection via pooler (IPv4)
  const connectionString = `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('📡 Connecting to Supabase Postgres...')
    await client.connect()
    console.log('✅ Connected!\n')

    // Read migration SQL
    const sqlPath = path.join(__dirname, '../supabase/migration.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('📄 Executing migration...')
    console.log('─'.repeat(80))

    // Execute the SQL
    const result = await client.query(sql)

    console.log('✅ Migration executed successfully!')
    console.log('\nResult:', result)

    // Verify tables were created
    console.log('\n📊 Verifying tables...')
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'std_%'
      ORDER BY table_name
    `)

    console.log('\n✅ Tables created:')
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`)
    })

    // Check sample data
    console.log('\n📝 Checking sample data...')
    const studentsResult = await client.query('SELECT * FROM std_students LIMIT 5')

    if (studentsResult.rows.length > 0) {
      console.log(`\n✅ Found ${studentsResult.rows.length} students:`)
      studentsResult.rows.forEach(student => {
        console.log(`  • ${student.name} (${student.nickname || 'no nickname'})`)
      })
    } else {
      console.log('\n⚠️  No students found (sample data might not have been inserted)')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)

    if (error.message.includes('password authentication failed')) {
      console.log('\n⚠️  Connection failed - need database password')
      console.log('The service_role key is not the database password')
      console.log('\nPlease run migration via Supabase Dashboard instead:')
      console.log('https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/editor')
    }
  } finally {
    await client.end()
    console.log('\n🔌 Disconnected')
  }
}

runMigration()
