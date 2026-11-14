// Bundle the pinned decoder locally: Edge workers never download executable code at runtime.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../supabase/functions/profile-photo/vendor');
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm'), path.join(target, 'magick.wasm'));
const size = fs.statSync(path.join(target, 'magick.wasm')).size;
if (size > 17 * 1024 * 1024) throw Error('Decoder exceeds the Edge Function bundle budget.');
console.log('Pinned photo decoder prepared for Supabase.');
