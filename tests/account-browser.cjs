// Optional browser integration check: serve dist on port 3000, then run with Playwright installed.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const rows = new Map(),
  requests = [];
let failStorage = false;
let failLogout = false;
const deletedUsers = new Set();
const photos = new Map(),
  removedPhotos = new Set();
let photoBytes;
const users = {};
for (const [email, id, name] of [
  ["alice@example.com", "00000000-0000-0000-0000-000000000001", "Alice"],
  ["bob@example.com", "00000000-0000-0000-0000-000000000002", "Bob"],
  ["hiring@example.com", "00000000-0000-0000-0000-000000000003", "Hiring lead"],
])
  users[email] = {
    id,
    email,
    role: "authenticated",
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"], nextwork_account_type: email === "hiring@example.com" ? "organization" : "personal" },
    user_metadata: { full_name: name },
    identities: [
      { id, provider: "email", user_id: id, identity_data: { email } },
    ],
  };
users["bob@example.com"].identities.push({
  provider: "linkedin_oidc",
  identity_data: {
    sub: "bob-linkedin",
    name: "Bob from LinkedIn",
    picture: "https://media.licdn.com/dms/image/bob/profile.jpg",
  },
});
function mockPhoto(id, source = "upload") {
  return {
    hasPhoto: true,
    url:
      "https://zkoqafidgromlbvczwzy.supabase.co/storage/v1/object/sign/profile-photos/" +
      id +
      "/photo.jpg?token=test",
    expiresAt: Date.now() + 300000,
    source,
    width: 400,
    height: 400,
  };
}
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
  await context.route("**/api/profile-photo**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const jwt = (request.headers().authorization || "").replace("Bearer ", "");
    const subject = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    ).sub;
    const user = Object.values(users).find((u) => u.id === subject);
    assert(user);
    const body = request.postDataJSON();
    let data;
    if (request.method() === "GET")
      data = photos.get(url.searchParams.get("userId") || subject) || {
        hasPhoto: false,
      };
    if (request.method() === "POST" && body.action === "upload") {
      assert(/^[a-f0-9]{64}$/.test(body.sha256));
      photos.set(subject, mockPhoto(subject));
      removedPhotos.delete(subject);
      data = photos.get(subject);
    }
    if (request.method() === "POST" && body.action === "import") {
      if (
        user.identities.some((i) => i.provider === "linkedin_oidc") &&
        body.consent &&
        !photos.has(subject) &&
        !removedPhotos.has(subject)
      )
        photos.set(subject, mockPhoto(subject, "linkedin"));
      data = {
        ...(photos.get(subject) || { hasPhoto: false }),
        profile: rows.get(subject)?.profile,
        version: rows.get(subject)?.version,
      };
    }
    if (request.method() === "DELETE") {
      photos.delete(subject);
      removedPhotos.add(subject);
      data = { hasPhoto: false };
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data || {}),
    });
  });
  await context.route(
    "https://zkoqafidgromlbvczwzy.supabase.co/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        method = request.method();
      requests.push({ path: url.pathname, method });
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      if (url.pathname.startsWith("/storage/v1/object/sign/profile-photos/"))
        return route.fulfill({ contentType: "image/jpeg", body: photoBytes });

      const reply = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (url.pathname.startsWith("/storage/v1/object/profile-photo-staging/"))
        return reply({ Key: url.pathname, Id: "staged-photo" });
      if (url.pathname === "/storage/v1/object/profile-photo-staging")
        return reply([]);
      if (url.pathname.endsWith("/token")) {
        const user = users[body.email];
        if (
          !user ||
          deletedUsers.has(user.id) ||
          body.password !== "valid-password"
        )
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
      if (url.pathname.endsWith("/logout") && failLogout)
        return reply({ msg: "Logout temporarily unavailable" }, 400);
      if (url.pathname.endsWith("/recover") || url.pathname.endsWith("/logout"))
        return reply({});
      if (["/organization_listings","/organizations","/organization_applications"].some(path=>url.pathname.endsWith(path))) return reply([]);
      const bearer = request.headers().authorization || "",
        subject =
          bearer.startsWith("Bearer ") && bearer.split(".").length >= 3
            ? JSON.parse(
                Buffer.from(bearer.split(".")[1], "base64url").toString(),
              ).sub
            : null;
      const user = Object.values(users).find((u) => u.id === subject);
      if (url.pathname.endsWith("/user/identities/authorize")) {
        assert.equal(url.searchParams.get("enable_extended_login"), "true");
        return reply({
          url: "https://www.linkedin.com/oauth/v2/authorization?test-link=true",
        });
      }
      if (url.pathname.endsWith("/rpc/delete_my_account")) {
        assert(user);
        assert(!body?.user_id);
        if (photos.has(user.id))
          return reply({ message: "PHOTO_CLEANUP_REQUIRED" }, 400);
        rows.delete(user.id);
        deletedUsers.add(user.id);
        return reply(null);
      }
      if (url.pathname.endsWith("/user"))
        return reply(
          user && !deletedUsers.has(user.id)
            ? user
            : { msg: "User not found", code: "user_not_found" },
          user && !deletedUsers.has(user.id) ? 200 : 404,
        );
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
      if (url.pathname.endsWith('/chat_attachments')) { assert(user); return reply([]); }
      if (url.pathname.endsWith('/rpc/chat_setup_version')) return reply(0);
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
  await page.waitForURL("**/#overview");
  await page.waitForFunction(() => Account.ready && Backend.ready);
  await page.goto(base + "/#profile");
  await page.getByRole("heading", { name: "Account & connections" }).waitFor();
  await page.waitForFunction(() => Account.ready && Backend.ready);
}
(async () => {
  photoBytes = await require("sharp")({
    create: { width: 400, height: 400, channels: 3, background: "#3a6ab8" },
  })
    .jpeg()
    .toBuffer();
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
      "overview",
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
    await page.goto(base + '/#organization');
    await page.getByRole('heading',{name:/Find the people/}).waitFor();
    await page.goto(base + '/#organization-signup');
    await page.getByRole('heading',{name:'Start with the essentials.'}).waitFor();
    assert.equal(await page.locator('.employer-auth-tabs').count(),0);
    assert.equal(await page.locator('#organization-auth-form input:visible').count(),3);
    assert.equal(await page.locator('#organization-auth-form input[required]').count(),3);
    require('node:fs').mkdirSync('test-artifacts',{recursive:true});
    await page.screenshot({path:'test-artifacts/organization-signup.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'test-artifacts/organization-signup-mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:900});
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
    await page.goto(base + "/#overview");
    await page.getByRole("heading", { name: "Your next steps" }).waitFor();
    assert.equal(await page.locator("#landing").count(), 0);
    await page.goto(base + "/#home");
    await page
      .locator(".landing-nav-actions")
      .getByRole("link", { name: "Open app", exact: true })
      .waitFor();
    assert.equal(
      await page
        .locator(".landing-nav-actions")
        .getByRole("link", { name: "Log in", exact: true })
        .count(),
      0,
    );
    await page
      .locator(".landing-nav-actions")
      .getByRole("link", { name: "Open app", exact: true })
      .click();
    await page.waitForURL("**/#overview");
    await page.goto(base + "/#profile");

    assert.equal(await page.getByLabel("Full name").inputValue(), "Alice");
    assert(!(await page.locator("main").innerText()).includes("Jordan Rivera"));
    // Manual uploads are previewed, processed, and used in every account avatar.
    await page
      .getByRole("button", { name: "Change photo", exact: true })
      .click();
    await page
      .locator("#photo-file")
      .setInputFiles({
        name: "avatar.jpg",
        mimeType: "image/jpeg",
        buffer: photoBytes,
      });
    await page.waitForFunction(
      () => !document.querySelector("#photo-save").disabled,
    );
    await page.getByRole("button", { name: "Save photo", exact: true }).click();
    await page.locator("[data-own-photo] img").waitFor();
    assert(photos.has(users["alice@example.com"].id));
    await page
      .getByRole("button", { name: "Change photo", exact: true })
      .click();
    await page
      .locator("#photo-file")
      .setInputFiles({
        name: "not-an-image.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg onload="alert(1)"/>'),
      });
    await page
      .getByText("Choose a PNG or JPEG file.", { exact: true })
      .waitFor();
    assert(
      await page
        .getByRole("button", { name: "Save photo", exact: true })
        .isDisabled(),
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
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
    await page.waitForFunction(() => ownPhoto().hasPhoto);
    assert.equal(photos.get(users["bob@example.com"].id).source, "linkedin");
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
    await page.goto(base + "/#profile");
    await page.locator("[data-own-photo] img").waitFor();
    await page
      .getByRole("button", { name: "Remove photo", exact: true })
      .click();
    await page.waitForFunction(() => !ownPhoto().hasPhoto);
    assert(!photos.has(users["alice@example.com"].id));
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
    failLogout = true;
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
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("sb-zkoqafidgromlbvczwzy-auth-token"),
      ),
      null,
    );
    await page.reload();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.equal(await page.evaluate(() => Account.user), null);
    assert.deepEqual(errors, []);
    await context.close();
    // Deleted users must never return through a cached, unexpired Supabase JWT.
    ({ context, page, errors } = await setup(browser));
    await context.addInitScript(
      ({ user, accessToken }) =>
        localStorage.setItem(
          "sb-zkoqafidgromlbvczwzy-auth-token",
          JSON.stringify({
            user,
            access_token: accessToken,
            refresh_token: "stale-refresh",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
          }),
        ),
      {
        user: users["bob@example.com"],
        accessToken: token(users["bob@example.com"]),
      },
    );
    await page.goto(base + "/#profile");
    await page.waitForURL("**/#login");
    assert.equal(await page.evaluate(() => Account.user), null);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("sb-zkoqafidgromlbvczwzy-auth-token"),
      ),
      null,
    );
    await page.reload();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.equal(await page.evaluate(() => Account.user), null);
    assert.deepEqual(errors, []);
    await context.close();
    // Separate hiring login and role-specific navigation, with no candidate workspace created.
    ({ context, page, errors } = await setup(browser));
    await login(page, "alice@example.com");
    await page.goto(base + '/#explore');
    // Every select has a text search control, including marketplace sort.
    assert.equal(await page.locator('select:not([hidden])').count(),0);
    const bookmark=page.locator('.job .bookmark').first();
    if(await bookmark.getAttribute('aria-pressed')!=='true')await bookmark.click();
    await page.waitForFunction(()=>document.querySelector('.job .bookmark')?.getAttribute('aria-pressed')==='true');
    assert.equal(await page.locator('.job .bookmark').first().locator('svg').getAttribute('fill'),'currentColor');
    assert.equal(await page.locator('.job .bookmark').first().evaluate(el=>Math.round(el.getBoundingClientRect().width)),38);
    await page.locator('.job').first().screenshot({path:'test-artifacts/saved-listing.png'});
    await page.goto(base + '/#profile');
    await page.evaluate(()=>{profileStep=2;render()});
    await page.locator('#profile-skills-input').fill('pythn');
    await page.locator('#profile-skills-options').getByRole('option',{name:'Python',exact:true}).click();
    assert((await page.locator('#profile-skills-value').inputValue()).includes('Python'));
    await page.goto(base + "/#checkout");
    await page.getByRole('heading',{name:'Your test checkout',exact:true}).waitFor();
    await page.getByRole('button',{name:'Fill test details',exact:true}).click();
    await page.locator('#paper-consent').check();
    await page.getByRole('button',{name:'Pay $9.00 in test money →',exact:true}).click();
    await page.getByRole('heading',{name:'Test Premium is active',exact:true}).waitFor();
    assert.equal(await page.locator('.paper-balance b').textContent(),'$491.00');
    const paidRow=rows.get(users['alice@example.com'].id);
    assert(!JSON.stringify(paidRow).includes('4242424242424242'));
    assert(!JSON.stringify(paidRow).includes('12/'));
    await page.reload();
    await page.getByRole('heading',{name:'Test Premium is active',exact:true}).waitFor();
    await page.getByRole('button',{name:'Cancel test plan',exact:true}).click();
    await page.getByRole('heading',{name:'Your test checkout',exact:true}).waitFor();
    await page.getByRole('button',{name:'Yearly · $72',exact:true}).click();
    await page.getByRole('button',{name:'Fill test details',exact:true}).click();
    await page.locator('#paper-card').fill('4000 0000 0000 0002');
    await page.locator('#paper-consent').check();
    await page.getByRole('button',{name:'Pay $72.00 in test money →',exact:true}).click();
    await page.locator('#paper-checkout-error').filter({hasText:'Test payment declined'}).waitFor();
    assert.equal(await page.locator('.paper-balance b').textContent(),'$491.00');
    assert.equal(await page.locator('#paper-card').inputValue(),'');
    assert.equal(await page.locator('#paper-cvc').inputValue(),'');
    await page.getByRole('button',{name:'Fill test details',exact:true}).click();
    await page.getByRole('button',{name:'Pay $72.00 in test money →',exact:true}).click();
    await page.getByRole('heading',{name:'Test Premium is active',exact:true}).waitFor();
    assert.equal(await page.locator('.paper-balance b').textContent(),'$419.00');
    await page.getByRole('button',{name:'Reset paper account to $500',exact:true}).click();
    await page.getByRole('heading',{name:'Your test checkout',exact:true}).waitFor();
    assert.equal(await page.locator('.paper-balance b').textContent(),'$500.00');
    await page.goto(base + "/#organization");
    await page.getByRole('heading', {name:'A separate organization account is required.'}).waitFor();
    assert.equal(await page.locator('#organization-profile').count(), 0);
    await page.getByRole('button', {name:'Sign out for organization access'}).click();
    await page.waitForURL('**/#organization-signup');
    await page.goto(base + '/#organization-login');
    await page.getByLabel('Work email', {exact:true}).fill('alice@example.com');
    await page.getByLabel('Password', {exact:true}).fill('valid-password');
    await page.getByRole('button', {name:'Log in to hiring portal →', exact:true}).click();
    await page.getByText('This is a personal account. Use Graduate login, or create a separate organization account with a different email.', {exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>Account.user), null);
    await page.getByLabel('Work email', {exact:true}).fill('hiring@example.com');
    await page.getByLabel('Password', {exact:true}).fill('valid-password');
    const beforeHiring = requests.length;
    await page.getByRole('button', {name:'Log in to hiring portal →', exact:true}).click();
    await page.waitForURL('**/#organization');
    await page.locator('#organization-profile').waitFor();
    assert.equal(await page.locator('#organization-profile select[required]').count(),0);
    assert.equal(await page.locator('#organization-profile textarea[required]').count(),0);
    const industry=page.getByRole('combobox',{name:'Industry',exact:true});
    await industry.fill('sofware technolgy');
    await page.getByRole('option',{name:'Software & technology',exact:true}).click();
    assert.equal(await page.locator('select[name="industry"]').inputValue(),'Software & technology');
    assert.equal(await industry.inputValue(),'Software & technology');
    const type=page.getByRole('combobox',{name:'Default hiring type',exact:true});
    await type.fill('full time');await type.press('Enter');
    assert.equal(await page.locator('select[name="hiring_kind"]').inputValue(),'Full-time job');
    await industry.focus();await industry.fill('nonsensezzzz');await industry.press('Escape');
    assert.equal(await industry.inputValue(),'Software & technology');
    await page.screenshot({path:'test-artifacts/organization-profile.png',fullPage:true});
    assert.equal(await page.locator('#nav a[href="#resume"]').count(),0);
    assert.equal(await page.locator('#nav a[href="#explore"]').count(),0);
    assert(!requests.slice(beforeHiring).some(r=>r.path.endsWith('/account_workspaces')));
    await page.goto(base + '/#profile');
    await page.waitForURL('**/#organization');
    await page.goto(base + '/#settings');
    await page.getByRole('heading',{name:'Organization account settings',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    await context.close();
    console.log(
      "Browser: no demo identity, every private workspace route gated, public marketing access, signup confirmation, reset request, email login, server profile/resume loading, two-user isolation, server-only storage, failed-save lockout, concurrent column updates, password validation, signed-in LinkedIn linking photo upload/removal, existing linked-member migration and photo-aware account deletion passed (mocked Supabase).",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
