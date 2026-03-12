#!/usr/bin/env node

/**
 * Patch login.html to fix alignment issues
 * This script modifies the compiled HTML file in the production container
 */

const fs = require('fs');
const path = require('path');

// Read the login.html file
const htmlPath = process.argv[2] || './login.html';
let html = fs.readFileSync(htmlPath, 'utf8');

console.log('Patching login.html for better alignment...');

// 1. Fix form spacing - increase space between form elements
// The form has class="space-y-5" which is 1.25rem gap
// Let's change it to space-y-6 for better spacing
html = html.replace(/class="space-y-5"/g, 'class="space-y-6"');

// 2. Improve error message container - make it more prominent and better aligned
// Find the error div pattern and improve it
const errorDivPattern = /(<div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-fade-in">\s*<AlertCircle class="h-5 w-5 text-red-600 mt-0\.5 shrink-0" \/>\s*<p class="text-sm text-red-800">)/;
if (errorDivPattern.test(html)) {
  html = html.replace(
    errorDivPattern,
    '<div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 animate-fade-in">\n  <div class="flex items-start">\n    <div class="flex-shrink-0">\n      <svg class="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.342 16.5c-.77.833.192 2.5 1.732 2.5z" />\n      </svg>\n    </div>\n    <div class="ml-3">\n      <p class="text-sm font-medium text-red-800">'
  );
  
  // Also update the closing tags
  html = html.replace(/<\/p>\s*<\/div>/g, '</p>\n    </div>\n  </div>\n</div>');
}

// 3. Improve input field alignment - ensure consistent spacing
// The input containers have mb-1.5 for labels, let's check if they need adjustment
// Actually the current structure looks fine

// 4. Improve button alignment - make it more centered and balanced
// The button already has w-full (full width) which is good

// 5. Add better spacing for the "Or continue with" separator
html = html.replace(
  /<div class="relative">\s*<div class="absolute inset-0 flex items-center">\s*<div class="w-full border-t border-slate-200"><\/div>\s*<\/div>\s*<div class="relative flex justify-center text-sm">\s*<span class="px-2 bg-white text-slate-500">Or continue with<\/span>\s*<\/div>\s*<\/div>/g,
  '<div class="relative mt-8 mb-6">\n        <div class="absolute inset-0 flex items-center">\n          <div class="w-full border-t border-slate-300"></div>\n        </div>\n        <div class="relative flex justify-center">\n          <span class="px-4 bg-white text-sm font-medium text-slate-500">Or continue with</span>\n        </div>\n      </div>'
);

// 6. Improve social buttons alignment
html = html.replace(
  /<div class="mt-6 grid grid-cols-2 gap-3">/g,
  '<div class="mt-6 grid grid-cols-2 gap-4">'
);

// 7. Improve "Don't have an account?" section spacing
html = html.replace(
  /<div class="mt-8">\s*<div class="relative">\s*<div class="absolute inset-0 flex items-center">\s*<div class="w-full border-t border-slate-200"><\/div>\s*<\/div>\s*<div class="relative flex justify-center text-sm">\s*<span class="px-2 bg-white text-slate-500">Don't have an account\?<\/span>\s*<\/div>\s*<\/div>\s*<div class="mt-6">/g,
  '<div class="mt-10 pt-8 border-t border-slate-200">\n        <div class="text-center mb-6">\n          <p class="text-base text-slate-600 font-medium">Don\'t have an account?</p>\n          <p class="text-sm text-slate-500 mt-1">Create an account to get started</p>\n        </div>\n        <div class="mt-4">'
);

// Write the patched HTML
fs.writeFileSync(htmlPath, html);
console.log('✅ login.html patched successfully!');

// Also create a simple CSS patch if needed
const cssPatch = `
/* Login form alignment fixes */
.form-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.login-form {
  width: 100%;
  max-width: 400px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #dc2626;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: #1e3a8a;
  color: white;
  border-radius: 0.5rem;
  font-weight: 600;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #1e40af;
}
`;

console.log('\nCSS patch for additional alignment fixes:');
console.log(cssPatch);