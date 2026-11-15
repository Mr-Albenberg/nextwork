const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('.github/scripts/deploy-profile-api.cjs', 'utf8');
async function check(homepageValid) {
  const calls = [], errors = [];
  const process = { env: { VERCEL_TOKEN: 'test-token', VERCEL_PROJECT_ID: 'project-test', VERCEL_ORG_ID: 'team-test', GITHUB_REPOSITORY_ID: '123', GITHUB_SHA: 'tested-sha' }, exitCode: 0 };
  const fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    const values = {
      '/v9/projects/project-test': { id: 'project-test', name: 'nextwork-jobs' },
      '/v9/projects/project-test/domains': { domains: [{ name: 'nextwork-jobs.vercel.app' }] },
      '/v13/deployments': { id: 'deployment-test' },
      '/v13/deployments/deployment-test': { readyState: 'READY' },
      '/api/resume': { profileImportAvailable: false },
    };
    assert(path === '/' || Object.hasOwn(values, path), 'Unexpected endpoint: ' + path);
    return { ok: true, json: async () => values[path], text: async () => homepageValid ? '<main id="app"></main><script src="app.js"></script>' : '<h1>Wrong frontend</h1>' };
  };
  await vm.runInNewContext(source, { process, fetch, URL, AbortSignal, console: { log() {}, error: message => errors.push(message) }, setTimeout });
  const deploy = calls.find(call => call.method === 'POST');
  assert.equal(deploy.path, '/v13/deployments');
  assert.equal(deploy.body.project, 'project-test');
  assert.equal(deploy.body.target, 'production');
  assert.equal(deploy.body.gitSource.ref, 'tested-sha');
  assert.equal(deploy.body.gitSource.repoId, 123);
  assert.equal(calls.filter(call => call.method !== 'GET').length, 1, 'Deployment must preserve project runtime configuration');
  assert.equal(process.exitCode, homepageValid ? 0 : 1);
  if (!homepageValid) assert(errors.includes('Production frontend verification failed'));
}
(async () => { await check(true); await check(false); console.log('Vercel deploy: existing project, exact revision, preserved configuration, and frontend/API verification passed.'); })().catch(error => { console.error(error); process.exitCode = 1; });
