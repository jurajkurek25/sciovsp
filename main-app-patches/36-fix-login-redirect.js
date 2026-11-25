const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `async function loginWithGoogle(){
  await _supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://vsp.jurajkurek.com/app'}});
}`;
const NEW = `async function loginWithGoogle(){
  await _supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/app'}});
}`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som loginWithGoogle kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-fix-login-redirect-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
