import { handlerFor } from './profile-photo-handler.mjs';
import { authenticate } from './photo-auth.mjs';
import { createPhotoStore } from './profile-photo-store.mjs';
import { PhotoError } from './profile-image.mjs';
const origins = new Set(['https://mr-albenberg.github.io', 'https://nextwork-jobs.vercel.app']);
export function edgeHandler({ auth = authenticate, storeFactory = createPhotoStore, fetcher = fetch } = {}) {
  return async request => {
    const origin = request.headers.get('Origin');
    const local = globalThis.Deno?.env.get('PHOTO_ALLOW_LOCALHOST') === 'true' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' });
    if (origins.has(origin) || local) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      headers.set('Access-Control-Max-Age', '86400');
    } else if (origin) return new Response(JSON.stringify({error: 'This website is not allowed.'}), {status: 403, headers});
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) return new Response(JSON.stringify({error: 'Method not allowed.'}), {status: 405, headers});
    const req = { method: request.method, headers: { authorization: request.headers.get('authorization') || '' }, query: Object.fromEntries(new URL(request.url).searchParams), body: null };
    let status = 200, body;
    const res = { setHeader(key, value) { headers.set(key,value); }, status(value) {status = value; return this;}, json(value) {body = value; return this;} };
    try {
      // Supabase Auth verifies signature, expiry, anonymous status and current account existence.
      const identity = await auth(req);
      if (identity.status) return new Response(JSON.stringify({error: identity.status === 401 ? 'Log in to manage profile photos.' : 'Your session could not be verified.'}), {status: identity.status, headers});
      if (request.method === 'POST') {
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new PhotoError('Send a JSON photo request.',415);
        if (Number(request.headers.get('content-length') || 0) > 4096) throw new PhotoError('Photo request is too large.',413);
        const reader = request.body?.getReader();
        if (!reader) throw new PhotoError('Invalid photo request.');
        const parts = []; let size = 0;
        try { while (true) { const {done,value} = await reader.read(); if(done)break; size += value.byteLength; if (size > 4096) {await reader.cancel();throw new PhotoError('Photo request is too large.',413);}parts.push(value); } } finally {reader.releaseLock();}
        const bytes = new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
        try {req.body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {throw new PhotoError('Invalid photo request.');}
      }
      const store = storeFactory();
      // Account deletion must still work after the member exhausts viewing/upload quotas.
      if (request.method !== 'DELETE' || req.query.account !== 'true')
        await store.consume(identity.authorization, 'request');
      await handlerFor({ auth: async () => identity, storeFactory: () => store, fetcher })(req,res);
    } catch(error) {
      status = error instanceof PhotoError ? error.status : 503;
      body = {error: error instanceof PhotoError ? error.message : 'The profile photo service is temporarily unavailable.'};
    }
    return new Response(JSON.stringify(body), {status,headers});
  };
}
