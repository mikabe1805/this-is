#!/usr/bin/env node

/**
 * Validate benchmark setup before running
 * Checks environment configuration and connectivity
 */

import { existsSync, readFileSync } from 'fs';
import { request } from 'undici';
import 'dotenv/config';

const checks = [];
let hasErrors = false;

/**
 * Add check result
 */
function addCheck(name, passed, message) {
  checks.push({ name, passed, message });
  if (!passed) hasErrors = true;
}

/**
 * Check if .env file exists
 */
function checkEnvFile() {
  const exists = existsSync('.env');
  addCheck(
    '.env file',
    exists,
    exists
      ? '✓ .env file found'
      : '✗ .env file not found. Run: cp .env.example .env'
  );
  return exists;
}

/**
 * Check required environment variables
 */
function checkEnvVars() {
  const BASE_URL = process.env.BASE_URL;
  const hasBaseUrl = !!BASE_URL;
  
  addCheck(
    'BASE_URL',
    hasBaseUrl,
    hasBaseUrl
      ? `✓ BASE_URL set: ${BASE_URL}`
      : '✗ BASE_URL not set in .env'
  );
  
  const USERS = parseInt(process.env.USERS || '300', 10);
  const validUsers = USERS > 0 && USERS <= 10000;
  addCheck(
    'USERS',
    validUsers,
    validUsers
      ? `✓ USERS: ${USERS}`
      : `✗ USERS invalid: ${USERS} (should be 1-10000)`
  );
  
  const DURATION_SEC = parseInt(process.env.DURATION_SEC || '300', 10);
  const validDuration = DURATION_SEC > 0 && DURATION_SEC <= 3600;
  addCheck(
    'DURATION_SEC',
    validDuration,
    validDuration
      ? `✓ DURATION_SEC: ${DURATION_SEC}s`
      : `✗ DURATION_SEC invalid: ${DURATION_SEC} (should be 1-3600)`
  );
  
  return hasBaseUrl && validUsers && validDuration;
}

/**
 * Test connectivity to search endpoint
 */
async function checkConnectivity() {
  const BASE_URL = process.env.BASE_URL;
  if (!BASE_URL) {
    addCheck('Connectivity', false, '✗ Cannot test - BASE_URL not set');
    return false;
  }
  
  try {
    const testUrl = `${BASE_URL}/api/search?q=test`;
    console.log(`  Testing connection to ${testUrl}...`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await request(testUrl, {
      signal: controller.signal,
      headersTimeout: 5000,
      bodyTimeout: 5000,
    });
    
    clearTimeout(timeout);
    await response.body.text();
    
    const success = response.statusCode >= 200 && response.statusCode < 500;
    addCheck(
      'Connectivity',
      success,
      success
        ? `✓ Endpoint reachable (HTTP ${response.statusCode})`
        : `✗ Endpoint returned HTTP ${response.statusCode}`
    );
    
    return success;
  } catch (error) {
    addCheck(
      'Connectivity',
      false,
      `✗ Cannot reach endpoint: ${error.message}`
    );
    return false;
  }
}

/**
 * Check dependencies are installed
 */
function checkDependencies() {
  const hasPackageJson = existsSync('package.json');
  addCheck(
    'package.json',
    hasPackageJson,
    hasPackageJson
      ? '✓ package.json found'
      : '✗ package.json not found'
  );
  
  if (hasPackageJson) {
    const hasNodeModules = existsSync('node_modules');
    addCheck(
      'Dependencies',
      hasNodeModules,
      hasNodeModules
        ? '✓ node_modules found'
        : '✗ node_modules not found. Run: npm install'
    );
    return hasNodeModules;
  }
  
  return false;
}

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  const valid = major >= 18;
  
  addCheck(
    'Node.js version',
    valid,
    valid
      ? `✓ Node.js ${version}`
      : `✗ Node.js ${version} (requires 18+)`
  );
  
  return valid;
}

/**
 * Print results
 */
function printResults() {
  console.log('\n📋 Setup Validation Results\n');
  console.log('═'.repeat(60));
  
  for (const check of checks) {
    const icon = check.passed ? '✓' : '✗';
    const color = check.passed ? '' : '';
    console.log(`${icon} ${check.name.padEnd(20)} ${check.message}`);
  }
  
  console.log('═'.repeat(60));
  
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;
  
  console.log(`\n${passedCount}/${totalCount} checks passed`);
  
  if (hasErrors) {
    console.log('\n⚠️  Setup incomplete. Please fix the errors above.');
    console.log('\nQuick fixes:');
    if (!existsSync('.env')) {
      console.log('  1. cp .env.example .env');
    }
    if (!process.env.BASE_URL) {
      console.log('  2. Edit .env and set BASE_URL=https://your-api.com');
    }
    if (!existsSync('node_modules')) {
      console.log('  3. npm install');
    }
    console.log('\nThen run: node validate-setup.mjs');
  } else {
    console.log('\n✅ All checks passed! Ready to run benchmark.');
    console.log('\nRun benchmark:');
    console.log('  npm run bench');
    console.log('\nWith custom cost model:');
    console.log('  npm run bench -- --reads 5 --writes 1');
  }
}

/**
 * Main validation
 */
async function validate() {
  console.log('🔍 Validating benchmark setup...\n');
  
  checkNodeVersion();
  checkDependencies();
  checkEnvFile();
  checkEnvVars();
  await checkConnectivity();
  
  printResults();
  
  process.exit(hasErrors ? 1 : 0);
}

// Run validation
validate().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});

