// Test domain validation function
const validateDomain = (domain) => {
  const trimmedDomain = domain.trim();
  
  if (!trimmedDomain) {
    return { isValid: false, error: "Empty domain" };
  }

  // Remove protocol if present
  const cleanDomain = trimmedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  
  // Basic domain validation regex
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
  
  if (!domainRegex.test(cleanDomain)) {
    return { isValid: false, error: "Invalid domain format" };
  }

  // Check for invalid characters
  if (cleanDomain.includes('..') || cleanDomain.startsWith('-') || cleanDomain.endsWith('-')) {
    return { isValid: false, error: "Invalid domain format" };
  }

  // Check minimum length
  if (cleanDomain.length < 4) {
    return { isValid: false, error: "Domain too short" };
  }

  // Check maximum length (253 chars for full domain)
  if (cleanDomain.length > 253) {
    return { isValid: false, error: "Domain too long" };
  }

  return { isValid: true };
};

// Test cases
const testDomains = [
  'example.com',
  'www.example.com',
  'https://example.com',
  'subdomain.example.com',
  'invalid..domain.com',
  'example',
  '.com',
  'example.',
  '-example.com',
  'example-.com',
  'ex.co',
  '',
  ' ',
  'very-long-domain-name-that-exceeds-normal-limits.example.com'
];

console.log('Domain Validation Test Results:');
console.log('================================');

testDomains.forEach(domain => {
  const result = validateDomain(domain);
  console.log(`"${domain}" -> ${result.isValid ? 'VALID' : 'INVALID'} ${result.error ? `(${result.error})` : ''}`);
});
