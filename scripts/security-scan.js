#!/usr/bin/env node
/**
 * FleetFlow Security Scanner
 * 
 * Scans codebase for common security issues:
 * - Hardcoded secrets
 * - SQL injection risks
 * - XSS vulnerabilities
 * - Insecure configurations
 */

const fs = require('fs');
const path = require('path');

// Patterns to detect security issues
const DANGEROUS_PATTERNS = [
  { pattern: /password\s*=\s*['"][^'"]+['"]/i, message: 'Hardcoded password detected', severity: 'critical' },
  { pattern: /api[_-]?key\s*=\s*['"][^'"]{10,}['"]/i, message: 'Hardcoded API key detected', severity: 'critical' },
  { pattern: /secret[_-]?key\s*=\s*['"][^'"]{10,}['"]/i, message: 'Hardcoded secret key detected', severity: 'critical' },
  { pattern: /private[_-]?key\s*=\s*['"][^'"]{10,}['"]/i, message: 'Hardcoded private key detected', severity: 'critical' },
  { pattern: /token\s*=\s*['"][^'"]{10,}['"]/i, message: 'Hardcoded token detected', severity: 'high' },
  { pattern: /dangerouslySetInnerHTML/, message: 'XSS risk: dangerouslySetInnerHTML usage', severity: 'high' },
  { pattern: /eval\s*\(/, message: 'Code injection risk: eval() usage', severity: 'critical' },
  { pattern: /innerHTML\s*=/, message: 'XSS risk: innerHTML assignment', severity: 'high' },
  { pattern: /console\.(log|warn|error|info)\s*\([^)]*(password|token|secret|key)/i, message: 'Potential secret logging', severity: 'medium' },
];

const SQL_INJECTION_PATTERNS = [
  { pattern: /query\s*\(\s*[`"'].*\$\{.*\}/, message: 'Possible SQL injection: template literal in query', severity: 'critical' },
  { pattern: /query\s*\([^)]*\+/, message: 'Possible SQL injection: string concatenation in query', severity: 'critical' },
  { pattern: /exec\s*\(\s*[`"'].*\$\{/, message: 'Possible command injection', severity: 'critical' },
];

const INSECURE_PATTERNS = [
  { pattern: /http:\/\//i, message: 'Insecure HTTP URL detected', severity: 'medium', exclude: /localhost/ },
  { pattern: /disable.*security/i, message: 'Security feature disabled', severity: 'high' },
  { pattern: /TODO.*security/i, message: 'Security TODO found', severity: 'low' },
];

const EXCLUDED_DIRS = ['node_modules', '.next', 'dist', 'build', '.git', 'coverage', 'scripts'];
const EXCLUDED_FILES = ['.env', '.env.local', '.env.production', '.env.development', 'package-lock.json', 'security-scan.js'];

const findings = [];

function scanFile(filePath, content) {
  const lines = content.split('\n');
  
  [...DANGEROUS_PATTERNS, ...SQL_INJECTION_PATTERNS, ...INSECURE_PATTERNS].forEach(({ pattern, message, severity, exclude }) => {
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        if (exclude && exclude.test(line)) return;
        
        findings.push({
          file: filePath,
          line: index + 1,
          severity,
          message,
          code: line.trim().substring(0, 100)
        });
      }
    });
  });
}

function walkDir(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(item)) {
        walkDir(fullPath);
      }
    } else if (stat.isFile()) {
      if (!EXCLUDED_FILES.includes(item) && 
          (item.endsWith('.js') || item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.jsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          scanFile(fullPath.replace(process.cwd() + '/', ''), content);
        } catch (err) {
          console.error(`Error reading ${fullPath}:`, err.message);
        }
      }
    }
  }
}

function printResults() {
  console.log('\n🔒 FleetFlow Security Scan Results\n');
  console.log('=' .repeat(60));
  
  if (findings.length === 0) {
    console.log('\n✅ No security issues found!\n');
    return;
  }
  
  // Group by severity
  const bySeverity = findings.reduce((acc, f) => {
    acc[f.severity] = acc[f.severity] || [];
    acc[f.severity].push(f);
    return acc;
  }, {});
  
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  
  severityOrder.forEach(severity => {
    if (bySeverity[severity]) {
      const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🔵';
      console.log(`\n${icon} ${severity.toUpperCase()} (${bySeverity[severity].length})`);
      console.log('-'.repeat(40));
      
      bySeverity[severity].forEach(finding => {
        console.log(`\n  File: ${finding.file}:${finding.line}`);
        console.log(`  Issue: ${finding.message}`);
        console.log(`  Code:  ${finding.code}`);
      });
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`\nTotal findings: ${findings.length}`);
  console.log('  Critical:', bySeverity.critical?.length || 0);
  console.log('  High:', bySeverity.high?.length || 0);
  console.log('  Medium:', bySeverity.medium?.length || 0);
  console.log('  Low:', bySeverity.low?.length || 0);
  console.log('');
}

// Run scan
console.log('\n🔍 Scanning FleetFlow codebase for security issues...\n');
walkDir(process.cwd());
printResults();

// Exit with error code if critical or high findings exist
const criticalCount = findings.filter(f => f.severity === 'critical').length;
const highCount = findings.filter(f => f.severity === 'high').length;

if (criticalCount > 0 || highCount > 0) {
  process.exit(1);
}
