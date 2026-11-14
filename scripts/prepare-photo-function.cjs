// Bundle the pinned decoder locally: Edge workers never download executable code at runtime.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../supabase/functions/profile-photo/vendor');
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm'), path.join(target, 'magick.wasm'));
const size = fs.statSync(path.join(target, 'magick.wasm')).size;
if (size > 17 * 1024 * 1024) throw Error('Decoder exceeds the Edge Function bundle budget.');
const decoderJS = path.join(path.dirname(require.resolve('@imagemagick/magick-wasm')), 'index.js');
const sourceDir = path.join(__dirname, '../supabase/functions/_shared');
const sourceSize = fs.readdirSync(sourceDir).reduce((total, name) => total + fs.statSync(path.join(sourceDir, name)).size, 0);
const preparedSize = size + fs.statSync(decoderJS).size + sourceSize;
// Reserve 2 MiB of the 20 MiB local-bundle limit for the entrypoint and bundler overhead.
if (preparedSize > 18 * 1024 * 1024) throw Error('Photo sources exceed the local Edge Function bundle budget.');
console.log(`Pinned photo decoder and shared sources prepared: ${(preparedSize / 1024 / 1024).toFixed(2)} MiB. Deploy with --use-docker (20 MB limit), not --use-api (5 MB limit).`);
