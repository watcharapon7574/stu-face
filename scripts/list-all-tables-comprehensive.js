const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listAllTables() {
  console.log('🔍 Scanning Database for ALL Tables\n')
  console.log('Database:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('═'.repeat(80))
  console.log()

  // Comprehensive list of possible table names
  const possibleTables = [
    // Production tables we know exist
    'profiles', 'departments', 'notifications',

    // Student system tables (non-std)
    'students', 'attendance', 'teachers', 'service_points',

    // Student system tables (std_ prefix)
    'std_students', 'std_attendance', 'std_teachers', 'std_service_points',

    // Common system tables
    'users', 'roles', 'permissions', 'settings', 'configs',
    'classes', 'courses', 'grades', 'subjects', 'schedules', 'rooms',
    'enrollments', 'registrations', 'assignments', 'exams', 'scores',
    'parents', 'guardians', 'staff', 'employees',
    'logs', 'audit', 'history', 'events', 'activities',
    'announcements', 'news', 'clubs', 'organizations',
    'semesters', 'years', 'periods', 'faculties',

    // Task/Project related
    'tasks', 'projects', 'task_assignments', 'task_reports',
    'task_categories', 'task_statuses', 'task_comments',

    // Auth related
    'auth_users', 'auth_sessions', 'auth_tokens',

    // Files/Media
    'files', 'uploads', 'documents', 'images', 'media',

    // Communication
    'messages', 'chats', 'emails', 'sms',

    // Other possible names
    'categories', 'tags', 'comments', 'likes', 'follows',
    'reports', 'analytics', 'statistics'
  ]

  const foundTables = []
  const notFoundTables = []

  console.log('🔎 Checking for tables...\n')

  for (const tableName of possibleTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        foundTables.push({ name: tableName, count: count || 0 })
      } else if (error.code === 'PGRST116') {
        // Table exists but has no columns
        foundTables.push({ name: tableName, count: 0, noColumns: true })
      } else {
        notFoundTables.push(tableName)
      }
    } catch (e) {
      notFoundTables.push(tableName)
    }
  }

  // Separate tables by category
  const stdTables = foundTables.filter(t => t.name.startsWith('std_'))
  const productionTables = foundTables.filter(t => !t.name.startsWith('std_'))

  console.log('📊 FOUND TABLES:\n')

  if (productionTables.length > 0) {
    console.log('🚫 PRODUCTION TABLES (DO NOT MODIFY):')
    console.log('═'.repeat(80))
    productionTables
      .sort((a, b) => b.count - a.count)
      .forEach(table => {
        const status = table.noColumns ? '⚠️  (no columns)' : `${table.count} records`
        console.log(`  ❌ ${table.name.padEnd(35)} ${status}`)
      })
    console.log('═'.repeat(80))
    console.log(`   Total: ${productionTables.length} production tables\n`)
  }

  if (stdTables.length > 0) {
    console.log('✅ STUDENT ATTENDANCE TABLES (std_ prefix - Safe to modify):')
    console.log('─'.repeat(80))
    stdTables.forEach(table => {
      const status = table.noColumns ? '⚠️  (no columns)' : `${table.count} records`
      console.log(`  ✓ ${table.name.padEnd(35)} ${status}`)
    })
    console.log('─'.repeat(80))
    console.log(`   Total: ${stdTables.length} std_ tables\n`)
  }

  if (foundTables.length === 0) {
    console.log('❌ No tables found!\n')
  }

  console.log('\n📝 SUMMARY:')
  console.log('─'.repeat(80))
  console.log(`  Total Tables Found: ${foundTables.length}`)
  console.log(`  Production Tables:  ${productionTables.length}`)
  console.log(`  std_ Tables:        ${stdTables.length}`)
  console.log('─'.repeat(80))
  console.log('\n⚠️  RULES:')
  console.log('  • DO NOT modify tables without std_ prefix')
  console.log('  • Only create/modify tables starting with: std_\n')
}

listAllTables()
