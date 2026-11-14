const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
function storage() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: (k) => values.delete(k),
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
  };
}
const local = storage(),
  session = storage();
const ctx = {
  localStorage: local,
  sessionStorage: session,
  URL,
  URLSearchParams,
  setTimeout() {},
  clearTimeout() {},
  window: { addEventListener() {} },
  location: { href: "https://nextwork-jobs.vercel.app/#login", hash: "#login" },
  document: {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("dist/account.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("dist/backend.js", "utf8"), ctx);
vm.runInContext(
  "workspaceLocal.setItem('proof-profile','private profile');workspaceSession.setItem('proof-resume','private resume')",
  ctx,
);
assert.equal(local.getItem("proof-profile"), null);
assert.equal(session.getItem("proof-resume"), null);
assert.equal(
  vm.runInContext("workspaceLocal.getItem('proof-profile')", ctx),
  "private profile",
);
vm.runInContext("clearWorkspaceMemory()", ctx);
assert.equal(
  vm.runInContext("workspaceLocal.getItem('proof-profile')", ctx),
  null,
);
assert.equal(
  vm.runInContext("workspaceSession.getItem('proof-resume')", ctx),
  null,
);
local.setItem("sb-project-auth-token", "session");
local.setItem("nextwork:old:proof-profile", "retired cache");
local.setItem("proof-profile", "old demo");
session.setItem("proof-resume", "old resume");
vm.runInContext("clearLegacyWorkspaceStorage()", ctx);
assert.equal(local.getItem("sb-project-auth-token"), "session");
assert.equal(local.getItem("nextwork:old:proof-profile"), null);
assert.equal(local.getItem("proof-profile"), null);
assert.equal(session.getItem("proof-resume"), null);
assert.equal(
  vm.runInContext("authCallback(true)", ctx),
  "https://nextwork-jobs.vercel.app/?auth=recovery",
);
assert.equal(
  vm.runInContext("authCallback()", ctx),
  "https://nextwork-jobs.vercel.app/",
);
for (const route of [
  "home",
  "pricing",
  "login",
  "signup",
  "forgot",
  "password",
  "organization",
  "organization-login",
  "organization-signup",
])
  assert(vm.runInContext(`publicPage('${route}')`, ctx));
for (const route of [
  "explore",
  "project/7",
  "projects",
  "messages",
  "profile",
  "settings",
  "premium",
  "tools",
  "resume",
  "skills",
  "career",
  "unknown",
])
  assert.equal(vm.runInContext(`publicPage('${route}')`, ctx), false);
console.log(
  "Account content is memory-only, retired device copies are removed, auth sessions remain intact, and private routes require login.",
);

session.setItem('nextwork-auth-intent','project/7');
assert.equal(vm.runInContext('postLoginRoute()',ctx),'project/7');
assert.equal(session.getItem('nextwork-auth-intent'),null);
session.setItem('nextwork-auth-intent','https://example.com/');
assert.equal(vm.runInContext('postLoginRoute()',ctx),'overview');
session.setItem('nextwork-auth-intent','organization');
assert.equal(vm.runInContext('postLoginRoute()',ctx),'organization');
console.log('Shared listing login destinations are preserved with internal route validation.');
