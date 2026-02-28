#!/usr/bin/env node
/**
 * Security Check Script for FleetFlow
 * Scans for common security issues
 */

const fs = require('fs')
const path = require('path')

const issues = []

// Patterns to check for
const PATTERNS = {
  // Hardcoded secrets
  hardcodedSecrets: [
    /password\s*[=:]\s*["'][^"']+["']/gi,
    /api[_-]?key\s*[=:]\s*["'][^"']+["']/gi,
    /secret\s*[=:]\s*["'][^"']+["']/gi,
    /token\s*[=:]\s*["'][^"']+["']/gi,
  ],
  // Dangerous functions
  dangerousFunctions: [
    /eval\s*\(/g,
    /new\s+Function\s*\(/g,
    /document\.write/g,
    /innerHTML\s*=/g,
  ],
  // Console logs (potential info leak)
  consoleLogs: /console\.(log|warn|error|info)\s*\(/g,
  // SQL injection risks (raw queries)
  sqlInjection: /query\s*\(\s*[`"'].*\$\{/g,
}

// Files to scan
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const EXCLUDE_DIRS = ['node_modules', '.next', 'dist', 'build']

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    // Check for hardcoded secrets (excluding env examples)
    if (!filePath.includes('.env.example')) {
      PATTERNS.hardcodedSecrets.forEach(pattern => {
        if (pattern.test(line)) {
          issues.push({
            type: 'WARNING',
            file: filePath,
            line: index + 1,
            message: 'Potential hardcoded secret or sensitive value',
            code: line.trim().substring(0, 80)
          })
        }
      })
    }

    // Check for dangerous functions
    PATTERNS.dangerousFunctions.forEach(pattern => {
      if (pattern.test(line)) {
        issues.push({
          type: 'DANGER',
          file: filePath,
          line: index + 1,
          message: 'Potentially dangerous function usage',
          code: line.trim().substring(0, 80)
        })
      }
    })

    // Check for console logs in production code
    if (PATTERNS.consoleLogs.test(line) && !filePath.includes('.test.')) {
      issues.push({
        type: 'INFO',
        file: filePath,
        line: index + 1,
        message: 'Console statement (remove for production)',
        code: line.trim().substring(0, 80)
      })
    }
  })
}

function scanDirectory(dir) {
  const items = fs.readdirSync(dir)
  
  items.forEach(item => {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(item)) {
        scanDirectory(fullPath)
      }
    } else if (EXTENSIONS.includes(path.extname(item))) {
      scanFile(fullPath)
    }
  })
}

// Run scan
console.log('🔒 FleetFlow Security Scan\n')
console.log('Scanning for security issues...\n')

scanDirectory('.')

// Report results
const dangers = issues.filter(i => i.type === 'DANGER')
const warnings = issues.filter(i => i.type === 'WARNING')
const infos = issues.filter(i => i.type === 'INFO')

console.log(`\n📊 Results:`)
console.log(`  🔴 Dangers: ${dangers.length}`)
console.log(`  🟠 Warnings: ${warnings.length}`)
console.log(`  🔵 Info: ${infos.length}`)

if (dangers.length > 0) {
  console.log('\n🔴 DANGER (Fix immediately):')
  dangers.forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`)
    console.log(`    ${issue.message}`)
    console.log(`    ${issue.code}\n`)
  })
}

if (warnings.length > 0) {
  console.log('\n🟠 WARNINGS (Review recommended):')
  warnings.slice(0, 10).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`)
    console.log(`    ${issue.message}`)
    console.log(`    ${issue.code}\n`)
  })
  if (warnings.length > 10) {
    console.log(`  ... and ${warnings.length - 10} more\n`)
  }
}

// Security recommendations
console.log('\n📋 Security Recommendations:')
console.log('  1. ✓ Use environment variables for secrets')
console.log('  2. ✓ Implement rate limiting on auth endpoints')
console.log('  3. ✓ Add input validation on all API routes')
console.log('  4. ✓ Enable CSP headers')
console.log('  5. ✓ Add security headers (HSTS, X-Frame-Options)')
console.log('  6. ✓ Implement audit logging for sensitive actions')
console.log('  7. ✓ Set secure cookie flags')
console.log('  8. ✓ Regular dependency updates')

process.exit(dangers.length > 0 ? 1 : 0)
