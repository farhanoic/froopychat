// global-setup.js
export default async function globalSetup() {
  console.log('🔍 Checking if servers are running...');
  
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
    
  } catch (error) {
    console.error('❌ Server check failed:', error.message);
    console.error('Please ensure both servers are running:');
    console.error('  Backend: cd froopy-backend && npm run dev');
    console.error('  Frontend: cd froopy-frontend && npm run dev');
    throw error;
  }
}