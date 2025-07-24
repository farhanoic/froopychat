/* eslint-env node */
/* global process */
import { execSync } from 'child_process';

console.log('🧪 Running Froopy Chat Phase 1 Validation...\n');

// Function to check if servers are running
async function checkServers() {
  try {
    // Check backend
    const backendResponse = await fetch('http://localhost:3000/health');
    if (!backendResponse.ok) {
      throw new Error('Backend not responding');
    }
    const data = await backendResponse.json();
    if (data.status !== 'vibing') {
      throw new Error('Backend not in expected state');
    }
    console.log('✅ Backend server is running on port 3000');
    
    // Check frontend
    const frontendResponse = await fetch('http://localhost:5173');
    if (!frontendResponse.ok) {
      throw new Error('Frontend not responding');
    }
    console.log('✅ Frontend server is running on port 5173');
    
    return true;
  } catch (error) {
    console.error('❌ Server check failed:', error.message);
    console.error('Please ensure both servers are running:');
    console.error('  Backend:  cd froopy-backend && npm run dev');
    console.error('  Frontend: cd froopy-frontend && npm run dev');
    return false;
  }
}

// Function to run ESLint
function runESLint() {
  console.log('📝 Running ESLint...');
  try {
    execSync('npx eslint src --ext .js,.jsx', { stdio: 'inherit' });
    console.log('✅ ESLint passed!\n');
    return true;
  } catch {
    console.log('⚠️  ESLint found issues. You can fix them with: npx eslint src --fix\n');
    return false;
  }
}

// Function to run Playwright tests
function runPlaywrightTests() {
  console.log('🎭 Running Playwright tests...');
  try {
    execSync('npx playwright test --reporter=list', { stdio: 'inherit' });
    console.log('✅ All Playwright tests passed!\n');
    return true;
  } catch {
    console.log('❌ Some Playwright tests failed. Check the report with: npx playwright show-report\n');
    return false;
  }
}

// Function to generate test report
function generateReport(serverCheck, eslintResult, playwrightResult) {
  console.log('📊 Phase 1 Validation Summary:');
  console.log('================================');
  console.log(`Server Connectivity: ${serverCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`ESLint Code Quality: ${eslintResult ? '✅ PASS' : '⚠️  WARN'}`);
  console.log(`Playwright E2E Tests: ${playwrightResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log('================================');
  
  if (serverCheck && playwrightResult) {
    console.log('🎉 Phase 1 validation completed successfully!');
    console.log('✅ All critical tests passed - Froopy Chat is ready for Phase 2');
  } else {
    console.log('⚠️  Some issues were found. Please address them before proceeding to Phase 2.');
    if (!serverCheck) {
      console.log('- Fix: Start both backend and frontend servers');
    }
    if (!playwrightResult) {
      console.log('- Fix: Check Playwright test failures and resolve issues');
    }
  }
}

// Main execution
async function main() {
  const serverCheck = await checkServers();
  if (!serverCheck) {
    process.exit(1);
  }
  
  const eslintResult = runESLint();
  const playwrightResult = runPlaywrightTests();
  
  generateReport(serverCheck, eslintResult, playwrightResult);
  
  // Exit with error code if critical tests failed
  if (!playwrightResult) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});