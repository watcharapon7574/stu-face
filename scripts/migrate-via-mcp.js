const fs = require('fs')

async function runMigrationViaMCP() {
  console.log('🚀 Running Migration via MCP Server\n')

  const sql = fs.readFileSync('./supabase/migration.sql', 'utf8')

  // MCP server is running at localhost:3000
  const mcpUrl = 'http://localhost:3000/api/mcp'
  const apiKey = 'local-dev-key'

  try {
    // Execute SQL via MCP
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        tool: 'executeSQL',
        parameters: {
          query: sql
        }
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Migration executed successfully!')
      console.log('\nResult:', JSON.stringify(result, null, 2))
    } else {
      console.log('❌ Error:', result)

      // Try alternative approach - execute statements one by one
      console.log('\n📝 Trying to execute statements individually...\n')
      await executeStatementsOneByOne(sql)
    }

  } catch (error) {
    console.log('❌ Error:', error.message)
    console.log('\n🔧 MCP Server might not support executeSQL')
    console.log('Trying alternative methods...\n')

    await tryAlternativeMethods(sql)
  }
}

async function executeStatementsOneByOne(sql) {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} statements\n`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]

    // Skip DO blocks and comments
    if (stmt.startsWith('DO $$') || stmt.startsWith('--')) {
      continue
    }

    console.log(`Executing statement ${i + 1}/${statements.length}...`)

    try {
      const response = await fetch('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'local-dev-key'
        },
        body: JSON.stringify({
          tool: 'executeSQL',
          parameters: {
            query: stmt + ';'
          }
        })
      })

      if (response.ok) {
        console.log(`  ✅ Success`)
      } else {
        const error = await response.json()
        console.log(`  ❌ Error: ${error.message || 'Unknown error'}`)
      }

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
    }
  }
}

async function tryAlternativeMethods(sql) {
  console.log('Available MCP tools from manifest...\n')

  try {
    const manifestResponse = await fetch('http://localhost:3000/.well-known/mcp-manifest')
    const manifest = await manifestResponse.json()

    console.log('Capabilities:', JSON.stringify(manifest.capabilities, null, 2))

    // Check what tools are available
    const tools = manifest.capabilities[0]?.tools || []
    console.log('\nAvailable tools:')
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`)
    })

  } catch (error) {
    console.log('Could not fetch manifest:', error.message)
  }

  console.log('\n' + '═'.repeat(80))
  console.log('⚠️  MCP Server does not support direct SQL execution')
  console.log('═'.repeat(80))
  console.log('\nThe supabase-mcp server only supports CRUD operations, not DDL.')
  console.log('\n✅ Final solution: Run in Supabase SQL Editor')
  console.log('https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/editor\n')
}

runMigrationViaMCP()
