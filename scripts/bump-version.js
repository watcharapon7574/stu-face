#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

// Bump patch version
const parts = pkg.version.split('.').map(Number)
parts[2]++
pkg.version = parts.join('.')

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// Update SW cache version
const swPath = path.join(__dirname, '..', 'public', 'sw.js')
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf-8')
  sw = sw.replace(
    /const CACHE_VERSION = '[^']*'/,
    `const CACHE_VERSION = '${pkg.version}'`
  )
  fs.writeFileSync(swPath, sw)
}

console.log(`Bumped version to ${pkg.version}`)
