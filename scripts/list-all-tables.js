const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getAllTables() {
  console.log('🔍 Scanning ALL tables in production database...\n')
  console.log('⚠️  WARNING: This is a PRODUCTION database!')
  console.log('⚠️  DO NOT modify tables without std_ prefix!\n')

  // Get list of common table name patterns
  const commonPrefixes = [
    '', // no prefix
    'std_',
    'tbl_',
    'app_',
    'sys_',
    'user_',
    'admin_',
    'public_',
    'auth_',
    'meta_'
  ]

  const commonTableNames = [
    'students', 'attendance', 'teachers', 'service_points', 'users', 'profiles',
    'std_students', 'std_attendance', 'std_teachers', 'std_service_points',
    'classes', 'courses', 'grades', 'subjects', 'schedules', 'rooms',
    'departments', 'faculties', 'semesters', 'years', 'periods',
    'enrollments', 'registrations', 'assignments', 'exams', 'scores',
    'parents', 'guardians', 'staff', 'employees', 'roles', 'permissions',
    'settings', 'configs', 'logs', 'audit', 'history', 'notifications',
    'announcements', 'news', 'events', 'activities', 'clubs', 'organizations'
  ]

  const foundTables = []

  console.log('📊 Checking for tables...\n')

  for (const tableName of commonTableNames) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        foundTables.push({ name: tableName, count: count || 0 })
      }
    } catch (e) {
      // Skip
    }
  }

  if (foundTables.length === 0) {
    console.log('❌ No tables found or insufficient permissions\n')
    return
  }

  // Separate std_ tables from others
  const stdTables = foundTables.filter(t => t.name.startsWith('std_'))
  const otherTables = foundTables.filter(t => !t.name.startsWith('std_'))

  if (otherTables.length > 0) {
    console.log('🚫 PRODUCTION TABLES (DO NOT MODIFY):')
    console.log('═'.repeat(60))
    otherTables.forEach(table => {
      console.log(`  ❌ ${table.name.padEnd(30)} - ${table.count} records`)
    })
    console.log('═'.repeat(60))
    console.log(`   Total: ${otherTables.length} production tables\n`)
  }

  if (stdTables.length > 0) {
    console.log('✅ STUDENT ATTENDANCE TABLES (std_ prefix - Safe to modify):')
    console.log('─'.repeat(60))
    stdTables.forEach(table => {
      console.log(`  ✓ ${table.name.padEnd(30)} - ${table.count} records`)
    })
    console.log('─'.repeat(60))
    console.log(`   Total: ${stdTables.length} std_ tables\n`)
  }

  console.log('📝 RULES:')
  console.log('  1. DO NOT touch tables without std_ prefix')
  console.log('  2. Only create/modify tables starting with: std_')
  console.log('  3. Example: std_students, std_attendance, std_embeddings\n')
}

getAllTables()
