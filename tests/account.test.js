const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
function storage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}
const local = storage(),
  session = storage();
const ctx = {
  localStorage: local,
  sessionStorage: session,
  console,
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
  "workspaceLocal.setItem('proof-profile','guest'); workspaceOwner='alice'; workspaceLocal.setItem('proof-profile','alice'); workspaceSession.setItem('proof-resume','alice resume');workspaceOwner='bob'",
  ctx,
);
assert.equal(
  vm.runInContext("workspaceLocal.getItem('proof-profile')", ctx),
  null,
);
assert.equal(
  vm.runInContext("workspaceSession.getItem('proof-resume')", ctx),
  null,
);
vm.runInContext("workspaceOwner='alice'", ctx);
assert.equal(
  vm.runInContext("workspaceLocal.getItem('proof-cloud-resume')", ctx),
  "alice resume",
);
assert.equal(local.getItem("nextwork:alice:sync-dirty"), "true");
vm.runInContext("workspaceOwner=null", ctx);
assert.equal(
  vm.runInContext("workspaceLocal.getItem('proof-profile')", ctx),
  "guest",
);
assert.equal(
  vm.runInContext("authCallback(true)", ctx),
  "https://nextwork-jobs.vercel.app/?auth=recovery",
);
assert.equal(
  vm.runInContext("authCallback()", ctx),
  "https://nextwork-jobs.vercel.app/",
);
assert(
  vm
    .runInContext("authError({code:'identity_already_exists'})", ctx)
    .includes("another Nextwork account"),
);
console.log(
  "Per-account workspace isolation, guest preservation, resume cache, sync tracking and callback URLs passed.",
);

for (const route of [
  "home",
  "pricing",
  "login",
  "signup",
  "forgot",
  "password",
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
console.log("Public route allowlist excludes every private workspace route.");
