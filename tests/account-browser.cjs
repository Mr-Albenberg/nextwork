// Optional browser integration check: serve dist on port 3000, then run with Playwright installed.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const rows = new Map(),
  requests = [];
let failStorage = false;
const users = {};
for (const [email, id, name] of [
  ["alice@example.com", "00000000-0000-0000-0000-000000000001", "Alice"],
  ["bob@example.com", "00000000-0000-0000-0000-000000000002", "Bob"],
])
  users[email] = {
    id,
    email,
    role: "authenticated",
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: name },
    identities: [
      { id, provider: "email", user_id: id, identity_data: { email } },
    ],
  };
function token(user) {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
}
async function setup(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route(
    "https://zkoqafidgromlbvczwzy.supabase.co/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        method = request.method();
      requests.push({ path: url.pathname, method });
      const body = request.postDataJSON();
      const reply = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (url.pathname.endsWith("/token")) {
        const user = users[body.email];
        if (!user || body.password !== "valid-password")
          return reply(
            { msg: "Invalid login credentials", code: "invalid_credentials" },
            400,
          );
        return reply({
          access_token: token(user),
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "test-refresh-" + user.id,
          user,
        });
      }
      if (url.pathname.endsWith("/signup"))
        return reply({
          user: { ...users["alice@example.com"], email: body.email },
          session: null,
        });
      if (url.pathname.endsWith("/recover") || url.pathname.endsWith("/logout"))
        return reply({});
      const bearer = request.headers().authorization || "",
        subject = bearer.startsWith("Bearer ")
          ? JSON.parse(
              Buffer.from(bearer.split(".")[1], "base64url").toString(),
            ).sub
          : null;
      const user = Object.values(users).find((u) => u.id === subject);
      if (url.pathname.endsWith("/user/identities/authorize"))
        return reply({
          url: "https://www.linkedin.com/oauth/v2/authorization?test-link=true",
        });
      if (url.pathname.endsWith("/rpc/delete_my_account")) {
        assert(user);
        assert(!body?.user_id);
        rows.delete(user.id);
        return reply(null);
      }
      if (url.pathname.endsWith("/user"))
        return reply(user || {}, user ? 200 : 401);
      if (url.pathname.endsWith("/account_workspaces")) {
        assert(user, "Database request must have authenticated bearer");
        if (failStorage) return reply({ code: "offline" }, 503);
        if (method === "GET") {
          const row = rows.get(user.id);
          return request.headers().accept?.includes("vnd.pgrst.object")
            ? reply(row || { code: "PGRST116" }, row ? 200 : 406)
            : reply(row ? [row] : []);
        }
        if (body.user_id) assert.equal(body.user_id, user.id);
        const old = rows.get(user.id);
        if (
          method === "PATCH" &&
          url.searchParams.get("version") !== "eq." + old.version
        )
          return reply({ code: "PGRST116", message: "0 rows" }, 406);
        const row = {
          saved_projects: [],
          application_drafts: [],
          resume: "",
          ...old,
          ...body,
          user_id: user.id,
          version: (old?.version || 0) + 1,
        };
        rows.set(user.id, row);
        return reply(
          url.searchParams.get("select") === "*"
            ? row
            : { version: row.version },
          method === "POST" ? 201 : 200,
        );
      }
      return reply({});
    },
  );
  return { context, page, errors };
}
async function login(page, email) {
  await page.goto(base + "/#login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("valid-password");
  await page
    .getByRole("button", { name: "Log in with email", exact: true })
    .click();
  await page.getByRole("heading", { name: "Account & connections" }).waitFor();
  await page.waitForFunction(() => Account.ready && Backend.ready);
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  try {
    let { context, page, errors } = await setup(browser);
    await page.goto(base + "/#resume");
    await page.waitForURL("**/#login");
    assert(
      await page
        .getByText("Sign in to analyze your resume and skills.")
        .isVisible(),
    );
    // No fictional identity is created, and all workspace URLs require authentication.
    assert.equal(
      await page.evaluate(() => localStorage.getItem("proof-profile")),
      null,
    );
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("proof-resume")),
      null,
    );
    assert.equal(await page.locator("body > aside").isVisible(), false);
    assert(!(await page.locator("body").innerText()).includes("Jordan Rivera"));
    for (const path of [
      "explore",
      "project/7",
      "projects",
      "messages",
      "profile",
      "settings",
      "premium",
      "tools",
      "career",
      "skills",
      "unknown",
    ]) {
      await page.goto(base + "/#" + path);
      await page.waitForURL("**/#login");
      await page
        .getByRole("button", { name: "Log in with email", exact: true })
        .waitFor();
    }
    for (const path of ["home", "pricing"]) {
      await page.goto(base + "/#" + path);
      assert.equal(new URL(page.url()).hash, "#" + path);
      assert.equal(await page.locator("body > aside").isVisible(), false);
    }
    await page.goto(base + "/#signup");
    await page.getByLabel("Full name").fill("New User");
    await page.getByLabel("Email", { exact: true }).fill("new@example.com");
    await page.getByLabel("Password", { exact: true }).fill("valid-password");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByText("Check your email to confirm your account, then sign in.", {
        exact: true,
      })
      .waitFor();
    await page.goto(base + "/#forgot");
    await page.getByLabel("Email", { exact: true }).fill("alice@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page
      .getByText(
        "If an account exists for that email, a password reset link is on its way.",
      )
      .waitFor();
    await login(page, "alice@example.com");
    assert.equal(await page.getByLabel("Full name").inputValue(), "Alice");
    assert(!(await page.locator("main").innerText()).includes("Jordan Rivera"));
    await page.getByLabel("Full name").fill("Alice Updated");
    await page.getByLabel("College or university").fill("Real University");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await page.waitForFunction(
      () => Backend.pending.size === 0 && !Backend.saving,
    );
    assert.equal(
      rows.get(users["alice@example.com"].id).profile.name,
      "Alice Updated",
    );
    await page.goto(base + "/#resume");
    await page
      .getByLabel("Resume text")
      .fill(
        "Alice private resume: built React and JavaScript projects for a university team. Developed accessible interfaces, tested components, and wrote documentation.",
      );
    await page.waitForFunction(
      () => Backend.pending.size === 0 && !Backend.saving,
    );
    assert(
      rows.get(users["alice@example.com"].id).resume.includes("Alice private"),
    );
    await page.goto(base + "/#profile");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/#login");
    await login(page, "bob@example.com");
    assert.equal(await page.getByLabel("Full name").inputValue(), "Bob");
    await page.goto(base + "/#resume");
    assert.equal(await page.getByLabel("Resume text").inputValue(), "");
    assert(!rows.get(users["bob@example.com"].id).resume);
    assert.deepEqual(errors, []);
    await context.close();
    ({ context, page, errors } = await setup(browser));
    await login(page, "alice@example.com");
    assert.equal(
      await page.getByLabel("Full name").inputValue(),
      "Alice Updated",
    );
    await page.goto(base + "/#resume");
    assert(
      (await page.getByLabel("Resume text").inputValue()).includes(
        "Alice private",
      ),
    );
    // A failed save locks the workspace; no offline profile or resume is retained.
    await page.goto(base + "/#profile");
    failStorage = true;
    await page.getByLabel("Full name").fill("Unsaved name");
    await page.evaluate(() => saveProfileDraft());
    await page
      .getByRole("heading", { name: "We couldn’t open your workspace." })
      .waitFor();
    assert.equal(await page.getByLabel("Full name").count(), 0);
    assert.equal(
      await page.evaluate(() => workspaceLocal.getItem("proof-profile")),
      null,
    );
    assert.equal(
      rows.get(users["alice@example.com"].id).profile.name,
      "Alice Updated",
    );
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await page.waitForURL("**/#login");
    failStorage = false;
    await login(page, "alice@example.com");
    assert.equal(
      await page.getByLabel("Full name").inputValue(),
      "Alice Updated",
    );
    // Another session's unrelated columns are preserved by a field-scoped save.
    const cloud = rows.get(users["alice@example.com"].id);
    rows.set(cloud.user_id, {
      ...cloud,
      version: cloud.version + 1,
      saved_projects: [7],
    });
    await page.getByLabel("Full name").fill("Alice Current");
    await page.evaluate(() => saveProfileDraft());
    await page.waitForFunction(
      () => Backend.pending.size === 0 && !Backend.saving,
    );
    assert.deepEqual(rows.get(cloud.user_id).saved_projects, [7]);
    assert.equal(rows.get(cloud.user_id).profile.name, "Alice Current");
    assert.equal(
      await page.getByRole("button", { name: "Sync now", exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Use account copy", exact: true })
        .count(),
      0,
    );
    await page.goto(base + "/#password");
    await page.getByLabel("New password", { exact: true }).fill("new-password");
    await page.getByLabel("Confirm new password").fill("different-password");
    await page.getByRole("button", { name: "Save password" }).click();
    await page
      .getByText("The passwords do not match.", { exact: true })
      .waitFor();
    await page.goto(base + "/#profile");
    await context.route("https://www.linkedin.com/**", (route) =>
      route.fulfill({ body: "LinkedIn authorization test" }),
    );
    await page.getByRole("button", { name: "Connect LinkedIn" }).click();
    await page.waitForURL("https://www.linkedin.com/**");
    assert(requests.some((r) => r.path.endsWith("/user/identities/authorize")));
    assert.deepEqual(errors, []);
    await context.close();
    ({ context, page, errors } = await setup(browser));
    await login(page, "bob@example.com");
    await page
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page
      .getByRole("button", { name: "Permanently delete account", exact: true })
      .click();
    await page.waitForURL("**/#login");
    assert(!rows.has(users["bob@example.com"].id));
    assert(rows.has(users["alice@example.com"].id));
    assert.equal(
      await page.evaluate(() => workspaceLocal.getItem("proof-profile")),
      null,
    );
    await page
      .getByText("Your account has been deleted.", { exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "Browser: no demo identity, every private workspace route gated, public marketing access, signup confirmation, reset request, email login, cloud profile/resume restore, two-user isolation, server-only storage, failed-save lockout, concurrent column updates, password validation and signed-in LinkedIn linking passed (mocked Supabase).",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
