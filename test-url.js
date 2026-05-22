// Test script to diagnose URL issue
// Import URL polyfill manually
try {
  require('react-native-url-polyfill/auto');
  console.log('Polyfill loaded');
  
  try {
  const url1 = new URL('http://localhost:8081');
  console.log('URL 1 is working:', url1.toString());
  
  const url2 = new URL('https://example.com');
  console.log('URL 2 is working:', url2.toString());
  
  // Test with hostUri format that might be used by Expo
  const hostUri = process.env.EXPO_PUBLIC_HOSTNAME || 'localhost:8081';
  const url3 = new URL(`http://${hostUri}`);
  console.log('URL 3 is working:', url3.toString());
  
  console.log('All URL tests passed!');
  } catch (error) {
    console.error('Inner URL test failed:', error);
  }
} catch (error) {
  console.error('Polyfill loading failed:', error);
}