// Optional browser integration check: serve dist on port 3000, then run with Playwright installed.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const rows = new Map(),
  requests = [];
let failStorage = false;
let failPhotoImport = false;
const photoImportCounts = new Map();
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
  await context.route('**/api/resume',route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{service:'prooflane-resume',aiConfigured:true}});
    const body=route.request().postDataJSON();
    if(body.action!=='profile-import')return route.fulfill({json:{error:'unexpected action'},status:400});
    return route.fulfill({json:{source:'ai',suggestions:[
      {field:'tagline',value:'Frontend developer building accessible tools for community teams',evidence:'I build accessible React applications for community teams'},
      {field:'education',value:'Example University',evidence:'Example University'},
      {field:'degree',value:'BS in Computer Science',evidence:'Bachelor of Science in Computer Science'},
      {field:'graduation',value:'2028',evidence:'Expected graduation: 2028'},
      {field:'skills',value:'React, JavaScript, SQL',evidence:'SKILLS: React, JavaScript, SQL'}
    ]}});
  });
  await context.route("**/functions/v1/profile-photo**", async (route) => {
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
      photoImportCounts.set(subject, (photoImportCounts.get(subject) || 0) + 1);
      if (failPhotoImport) return route.fulfill({contentType:"application/json",body:JSON.stringify({hasPhoto:false,needsConsent:false,photoError:"LinkedIn photo import failed. Please retry."})});
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
      if (url.pathname === "/functions/v1/profile-photo") return route.fallback();
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
      if (url.pathname === "/storage/v1/object/list/account-resumes") return reply([]);
      if (url.pathname.startsWith("/storage/v1/object/account-resumes/")) return reply({Key:url.pathname,Id:'resume-file'});
      if (url.pathname === "/storage/v1/object/account-resumes") return reply([]);
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
    await page.getByRole("heading", { name: "Where do you want to start?" }).waitFor();
    assert.equal(await page.locator("#landing").count(), 0);
    await page.goto(base + "/#home");
    await page.getByRole('button',{name:'Pause homepage animations',exact:true}).click();
    assert(await page.locator('.home-hero h1').isVisible());
    assert.equal(await page.locator('.home-redesign').getAttribute('data-motion'),'paused');
    await page.getByRole('button',{name:'Play homepage animations',exact:true}).click();
    await page
      .locator(".home-nav>div")
      .getByRole("link", { name: "Open workspace", exact: true })
      .waitFor();
    assert.equal(
      await page
        .locator(".home-nav>div")
        .getByRole("link", { name: "Log in", exact: true })
        .count(),
      0,
    );
    await page
      .locator(".home-nav>div")
      .getByRole("link", { name: "Open workspace", exact: true })
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
    const stableAvatars = await page.evaluate(async () => {
      const selector = '.workspace-header .avatar img,aside .account .avatar img';
      const images = [...document.querySelectorAll(selector)];
      if (images.length !== 2) return false;
      let removed = false;
      const observer = new MutationObserver(records => {
        if (records.some(record => [...record.removedNodes].some(node => images.includes(node)))) removed = true;
      });
      images.forEach(image => observer.observe(image.parentElement, {childList:true}));
      for (const route of ['overview','explore','home','profile']) {
        location.hash = route;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!images.every(image => image.isConnected && image.complete && image.naturalWidth > 0)) removed = true;
      }
      observer.disconnect();
      const profileImage = document.querySelector('[data-own-photo] img');
      return !removed && images.every((image,index) => document.querySelectorAll(selector)[index] === image) &&
        profileImage?.complete && profileImage.naturalWidth > 0;
    });
    assert(stableAvatars, 'Page changes must preserve loaded toolbar/sidebar images and render the cached profile photo');

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
    await page.goto(base + "/#profile");
    await page.getByRole('button',{name:'Upload resume',exact:true}).waitFor();
    await page.locator('#profile-resume-file').setInputFiles({name:'alice-resume.txt',mimeType:'text/plain',buffer:Buffer.from('Alice Updated\nFrontend Developer\nSUMMARY\nI build accessible React applications for community teams and improve user experiences.\nEXPERIENCE\nBuilt a volunteer dashboard using JavaScript.\nEDUCATION\nExample University\nBachelor of Science in Computer Science\nExpected graduation: 2028\nSKILLS: React, JavaScript, SQL')});
    await page.getByText('Saved resume: alice-resume.txt',{exact:true}).waitFor();
    assert(!rows.get(users['alice@example.com'].id).profile.tagline,'Upload must not change profile fields');
    assert.equal(await page.locator('#profile-import-consent').count(),0);
    await page.getByRole('button',{name:'Fill in profile details',exact:true}).click();
    await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Your profile details are ready'})}).waitFor();
    assert.equal(await page.locator('.profile-import-table').count(),0);
    assert.equal(await page.getByText('Review suggested changes',{exact:true}).count(),0);
    assert(!rows.get(users['alice@example.com'].id).profile.tagline,'Preparing suggestions must not save them');
    await page.getByRole('button',{name:'Fill empty fields',exact:true}).click();
    await page.waitForFunction(()=>!Backend.saving&&Backend.pending.size===0);
    assert.equal(rows.get(users['alice@example.com'].id).profile.degree,'BS in Computer Science');
    assert.equal(rows.get(users['alice@example.com'].id).profile.education,'Real University','Filling blanks preserves existing values');
    assert.equal(rows.get(users['alice@example.com'].id).profile.graduation,'2028');
    await page.getByRole('button',{name:'Fill in profile details',exact:true}).click();
    await page.getByRole('heading',{name:'Your profile details are ready'}).waitFor();
    await page.getByRole('button',{name:'Update everything',exact:true}).click();
    await page.waitForFunction(()=>!Backend.saving&&Backend.pending.size===0);
    assert.equal(rows.get(users['alice@example.com'].id).profile.education,'Example University');
    assert.equal(await page.getByRole('heading',{name:'Your profile details are ready'}).count(),0);
    assert(rows.get(users['alice@example.com'].id).extras['proof-resume-report']);
    await page.reload();
    await page.getByText('Saved resume: alice-resume.txt',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Graduation year').inputValue(),'2028');
    await page.getByRole('button',{name:'Clear resume',exact:true}).waitFor();
    const chooserPromise=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Upload a new resume',exact:true}).click();
    const chooser=await chooserPromise;
    await chooser.setFiles({name:'replacement.txt',mimeType:'text/plain',buffer:Buffer.from('Alice Updated\nFrontend Developer\nSUMMARY\nI build accessible React applications for community teams and improve user experiences.\nEXPERIENCE\nBuilt a replacement version with JavaScript.')});
    await page.getByText('Saved resume: replacement.txt',{exact:true}).waitFor();
    await page.goto(base + '/#skills');
    await page.waitForURL('**/#recommend');
    assert((await page.locator('#reco-resume').inputValue()).includes('accessible React applications'));
    await page.goto(base + '/#recommend');
    assert((await page.locator('#reco-resume').inputValue()).includes('accessible React applications'));
    assert.equal(await page.locator('input[type=file]').count(),0);
    await page.goto(base + '/#profile');
    await page.getByRole('button',{name:'Clear resume',exact:true}).click();
    await page.getByRole('button',{name:'Upload resume',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>marketplaceResume()),'');
    await page.goto(base + '/#skills');
    await page.waitForURL('**/#recommend');
    assert.equal(await page.locator('#reco-resume').inputValue(),'');
    await page.goto(base + '/#resume');
    assert.equal(await page.locator('#review-consent').count(),0);
    await page.getByRole('heading',{name:'Build a stronger application',exact:true}).waitFor();
    await page
      .getByLabel("Resume text")
      .fill(
        "Alice private resume: built React and JavaScript projects for a university team. Developed accessible interfaces, tested components, and wrote documentation.",
      );
    await page.waitForFunction(
      () => workspaceSession.getItem('proof-resume')?.includes('Alice private') && Backend.pending.size === 0 && !Backend.saving,
    );
    assert(
      rows.get(users["alice@example.com"].id).resume.includes("Alice private"),
    );
    // Full-page review results, grounded criteria charts, view preferences, and viewport-fit navigation.
    assert(await page.evaluate(async()=>{const input=document.querySelector('#review-resume'),method=document.querySelector('#review-method');method.value='ai';catalogLoadedAt=0;await loadPublicOrganizationJobs();const preserved=input.isConnected&&method.value==='ai'&&input.value.includes('Alice private');method.value='local';return preserved}),'Catalog updates must preserve the resume draft and review method');
    await page.getByRole('button',{name:'Review my resume',exact:false}).click();
    await page.waitForURL('**/#resume/results');
    await page.getByRole('tab',{name:'Summary',exact:true}).waitFor();
    assert.equal(await page.locator('#review-resume').count(),0,'Results must be a separate page, without the input form alongside them');
    await page.evaluate(()=>matchListing(2));
    await page.waitForURL('**/#resume');
    await page.setViewportSize({width:1366,height:768});
    assert(await page.locator('#run-review').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight),'The job review action should fit a laptop viewport');
    await page.getByRole('button',{name:'Review my resume',exact:true}).click();
    await page.waitForURL('**/#resume/results');
    await page.getByRole('tab',{name:'Job fit',exact:true}).waitFor();
    await page.getByRole('tab',{name:'Job fit',exact:true}).click();
    await page.locator('#report-panel-match .evidence-chart').waitFor();
    assert.equal(await page.locator('#report-panel-match [role="meter"]').count(),9,'The chart must include five listing requirements and four field foundations');
    assert(await page.getByRole('meter',{name:'Resume evidence for React',exact:true}).getAttribute('aria-valuenow')==='100');
    await page.screenshot({path:'test-artifacts/resume-job-fit.png',fullPage:true});
    await page.getByRole('tab',{name:'Job fit',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'Next steps',exact:true}).getAttribute('aria-selected'),'true');
    await page.locator('#resume-draft-text').waitFor();
    const beforeResumeEditing=await page.evaluate(()=>marketplaceResume());
    await page.locator('.editor-suggestion.pending').first().getByRole('button',{name:'Accept edit',exact:true}).click();
    await page.locator('#resume-editor-feedback').filter({hasText:'Fill in the bracketed prompts'}).waitFor();
    await page.locator('.editor-suggestion.pending textarea').first().fill('Alice\nalice@example.com');
    await page.locator('.editor-suggestion.pending').first().getByRole('button',{name:'Accept edit',exact:true}).click();
    assert.equal(await page.evaluate(()=>marketplaceResume()),beforeResumeEditing,'Accepting an edit changes only the private draft');
    await page.locator('.editor-suggestion.pending').first().getByRole('button',{name:'Reject',exact:true}).click();
    await page.getByRole('button',{name:'Compare',exact:true}).click();
    assert(await page.locator('.resume-diff-line.added').count()>0);
    await page.getByLabel('Version name',{exact:true}).fill('Frontend application');
    await page.getByRole('button',{name:'Save version',exact:true}).click();
    await page.getByRole('button',{name:'Saved versions',exact:true}).click();
    await page.getByRole('heading',{name:'Frontend application',exact:true}).waitFor();
    await page.waitForFunction(()=>Backend.pending.size===0&&!Backend.saving);
    await page.reload();
    await page.getByRole('tab',{name:'Next steps',exact:true}).click();
    await page.getByRole('heading',{name:'Frontend application',exact:true}).waitFor();
    await page.locator('.editor-export-menu>summary').click();
    const textExport=page.waitForEvent('download');
    await page.getByRole('button',{name:'Plain text (.txt)',exact:true}).click();
    const textFile=await textExport;await textFile.saveAs('test-artifacts/edited-resume.txt');
    assert(require('node:fs').readFileSync('test-artifacts/edited-resume.txt','utf8').includes('alice@example.com'));
    const wordExport=page.waitForEvent('download');
    await page.getByRole('button',{name:'Word document (.docx)',exact:true}).click();
    const wordFile=await wordExport;await wordFile.saveAs('test-artifacts/edited-resume.docx');
    assert.equal(require('node:fs').readFileSync('test-artifacts/edited-resume.docx').readUInt32LE(0),0x04034b50);
    await page.evaluate(()=>{window.__resumePrintCalled=false;const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.tagName==='IFRAME'){node.contentWindow.print=()=>{window.__resumePrintCalled=true};observer.disconnect()}});observer.observe(document.body,{childList:true})});
    await page.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();
    await page.waitForFunction(()=>window.__resumePrintCalled===true);
    assert((await page.locator('.resume-print-frame').evaluate(frame=>frame.contentDocument.body.textContent)).includes('alice@example.com'));
    await page.evaluate(()=>document.querySelector('.resume-print-frame').remove());

    await page.getByRole('button',{name:'Use as active resume',exact:false}).click();
    await page.waitForURL('**/#resume');
    assert((await page.locator('#review-resume').inputValue()).includes('alice@example.com'));
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    await page.screenshot({path:'test-artifacts/resume-dark-results.png',fullPage:true});
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await page.goto(base+'/#explore');
    await page.getByRole('button',{name:'Browse view',exact:true}).click();
    const browseChoice=page.locator('[data-preview-job]').nth(1);
    const chosenTitle=await browseChoice.locator('h3').textContent();
    await browseChoice.click();
    assert.equal(await page.locator('#opportunity-preview h2').textContent(),chosenTitle,'Selecting a result must update the detail panel');
    assert(await page.locator('#opportunity-preview').getByRole('link',{name:'View project & apply',exact:false}).isVisible());
    await page.screenshot({path:'test-artifacts/job-browse-view.png',fullPage:true});
    await page.getByRole('button',{name:'Grid view',exact:true}).click();
    assert(await page.locator('#jobs').evaluate(e=>e.classList.contains('jobs-view-grid')));
    await page.locator('#query').fill('React');
    await page.locator('#search button').click();
    await page.getByRole('button',{name:'List view',exact:true}).click();
    assert.equal(await page.locator('#query').inputValue(),'React','Changing layout must preserve the search');
    await page.screenshot({path:'test-artifacts/jobs-list-view.png',fullPage:true});
    for(const height of [420,600,768]){
      await page.setViewportSize({width:1366,height});
      assert(await page.locator('body>aside').evaluate(e=>e.scrollHeight<=e.clientHeight&&getComputedStyle(e).overflowY==='hidden'&&[...e.querySelectorAll('#nav a')].every(n=>n.getBoundingClientRect().bottom<=innerHeight)),'The entire sidebar must fit without scrolling at '+height);
    }
    await page.setViewportSize({width:1280,height:900});
    await page.goto(base + "/#settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/#login");
    failPhotoImport = true;
    await login(page, "bob@example.com");
    assert.equal(await page.getByLabel("Full name").inputValue(), "Bob");
    assert.equal(await page.evaluate(()=>workspaceLocal.getItem('proof-resume-editor')),null,'Resume drafts must not cross accounts');
    await page.locator('[data-photo-status]').filter({hasText:'LinkedIn photo import failed. Please retry.'}).waitFor();
    await page.evaluate(() => loadProfilePhoto());
    assert.match(await page.locator('[data-photo-status]').innerText(), /import failed/);
    await page.waitForFunction(() => !ProfileMedia.importing);
    const importsBeforeConfirmation = photoImportCounts.get(users["bob@example.com"].id);
    const controlsStable = await page.evaluate(async () => {
      const session = (await Account.client.auth.getSession()).data.session;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const input = document.querySelector('#profile-form [name="name"]');
      const controls = document.querySelector('.profile-photo-controls');
      const connected = document.querySelector('.profile-settings-shortcut');
      const status = document.querySelector('[data-photo-status]');
      const statusText = status.textContent;
      input.value = 'Unsent profile edit';
      let mutations = 0;
      const observer = new MutationObserver(records => mutations += records.length);
      observer.observe(controls, {childList:true,subtree:true,attributes:true,characterData:true});
      for (const event of ['INITIAL_SESSION','SIGNED_IN','SIGNED_IN','USER_UPDATED'])
        await Account.client.auth._notifyAllSubscribers(event, session);
      await new Promise(resolve => setTimeout(resolve, 50));
      updatePhotoStatus();paintProfilePhotos();updatePhotoStatus();
      await Promise.resolve();
      observer.disconnect();
      const stable = controls.isConnected && connected.isConnected && status.isConnected &&
        status.textContent === statusText && input.isConnected && input.value === 'Unsent profile edit' && mutations === 0;
      input.value = 'Bob';
      return stable;
    });
    assert(controlsStable, 'Session confirmations and unchanged status paints must preserve LinkedIn controls, errors and unsaved edits');
    assert.equal(photoImportCounts.get(users["bob@example.com"].id), importsBeforeConfirmation, 'Repeated session events must not restart a completed import');
    const changedProviderImport = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/functions/v1/profile-photo') && request.postDataJSON()?.action === 'import');
    await page.evaluate(async () => {
      const session = (await Account.client.auth.getSession()).data.session;
      const user = {...session.user,identities:session.user.identities.map(identity => identity.provider === 'linkedin_oidc' ?
        {...identity,identity_data:{...identity.identity_data,picture:identity.identity_data.picture+'?updated=1'}} : identity)};
      await Account.client.auth._notifyAllSubscribers('USER_UPDATED', {...session,user});
    });
    await changedProviderImport;
    await page.waitForFunction(() => !ProfileMedia.importing && Boolean(ProfileMedia.importError));
    assert.equal(photoImportCounts.get(users["bob@example.com"].id), importsBeforeConfirmation + 1, 'Fresh provider details must still trigger an import');

    failPhotoImport = false;
    await page.getByRole('button',{name:'Retry LinkedIn import',exact:true}).click();
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
    await page.goto(base + "/#settings");
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
    await page.goto(base + "/#settings");
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
    await page.goto(base+'/#recommend');
    await page.getByRole('heading',{name:'Turn your ambition into a project.',exact:true}).waitFor();
    assert.equal(await page.locator('#reco-run').count(),1);
    assert.equal(await page.locator('#nav a[href="#tools"]').count(),0);
    await page.screenshot({path:'test-artifacts/project-ideas-start.png',fullPage:true});
    const roleSearch=page.getByRole('combobox',{name:'Target role',exact:true});
    await roleSearch.fill('front end');
    await page.getByRole('option',{name:'Frontend Developer',exact:true}).waitFor();
    await page.screenshot({path:'test-artifacts/search-dropdown.png',fullPage:true});
    await roleSearch.press('ArrowUp');
    await roleSearch.press('Enter');
    assert.equal(await roleSearch.inputValue(),'Frontend Developer');
    assert.equal(await roleSearch.getAttribute('aria-expanded'),'false');
    await page.evaluate(()=>{recoState.busy=true;recoState.status='loading';location.hash='recommend/results';render()});
    await page.getByRole('progressbar').waitFor();
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),null,'Unknown request durations must not show fabricated percentages');
    await page.screenshot({path:'test-artifacts/project-loading.png',fullPage:true});
    await page.evaluate(()=>{recoState.busy=false;recoState.status='idle';location.hash='recommend';render()});
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:900});
      for(const route of ['overview','explore','profile','resume','recommend','settings','messages']){
        await page.goto(base+'/#'+route);
        await page.waitForFunction(()=>Account.ready&&Backend.ready);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow on '+route+' at '+width);
      }
    }
    await page.goto(base+'/#recommend');

    await page.evaluate(()=>{
      const projects=Array.from({length:3},(_,i)=>({title:['Accessible community dashboard','Product onboarding study','Customer insights notebook'][i],overview:'Build a focused project with clear outcomes and a useful handoff.',pitch:'A practical project.',why:'Practice relevant skills and explain your contribution.',difficulty:'beginner',hours:24,weeks:3,skills:['React','Accessibility'],covers:['Accessibility'],buildsOn:['React'],build:['Research','Build','Review'],plan:[{phase:'Define the problem',details:'Choose a user need and a small, testable scope.'},{phase:'Build a working version',details:'Create a usable solution and test key interactions.'},{phase:'Explain the result',details:'Write a short handoff and document what you learned.'}],tools:['React','Figma'],deliverables:['A working project','A short case study'],stretch:['Test another user scenario'],showcase:'Link to the project and describe your decisions.',demand:{}}));
      recoState={status:'done',busy:false,result:{role:'Frontend developer',profile:{source:'baseline',skills:[{skill:'React',tier:'common'},{skill:'Accessibility',tier:'common'}],family:{label:'Frontend developer'}},family:{label:'Frontend developer'},analysis:{have:[{skill:'React'}],gaps:[{skill:'Accessibility'}],coverage:50},projects,note:''}};
      workspaceLocal.setItem(RECO_LAST_KEY,JSON.stringify({...recoState.result,source:'local'}));
      location.hash='recommend/results';
    });
    await page.getByRole('heading',{name:'Your next project starts here.',exact:true}).waitFor();
    assert.equal(await page.locator('.idea-card').count(),3);
    assert.equal(await page.locator('.reco-skill,.idea-cards .progress').count(),0);
    assert.equal(await page.locator('.idea-source-details').getAttribute('open'),null);
    assert(await page.locator('.ideas-next-callout>div').evaluate(e=>e.getBoundingClientRect().width>200),'The callout text must keep readable width beside its button');
    assert(await page.locator('.idea-card .project-fit').first().isVisible(),'Ideas must explain resume skill coverage');
    await page.screenshot({path:'test-artifacts/project-ideas-results.png',fullPage:true});
    await page.getByRole('link',{name:'View project plan',exact:false}).first().click();
    await page.waitForURL('**/#recommend/idea/0');
    await page.locator('.idea-plan-steps>li').first().waitFor();
    assert.equal(await page.locator('.idea-plan-steps>li').count(),3);
    await page.getByRole('button',{name:'Save project',exact:true}).click();
    await page.getByRole('button',{name:'Saved ✓',exact:true}).waitFor();
    await page.waitForFunction(()=>Backend.pending.size===0&&!Backend.saving);
    await page.reload();
    await page.getByRole('heading',{name:'Accessible community dashboard',exact:true}).waitFor();
    await page.goto(base+'/#projects');
    await page.getByRole('tab',{name:/Project ideas/}).click();
    await page.getByRole('heading',{name:'Accessible community dashboard',exact:true}).waitFor();
    await page.getByRole('link',{name:'View project plan',exact:false}).first().click();
    await page.waitForURL('**/#recommend/saved/0');
    await page.getByRole('button',{name:'Start this project',exact:false}).click();
    await page.getByRole('checkbox').first().check();
    await page.waitForFunction(()=>Backend.pending.size===0&&!Backend.saving);
    await page.reload();
    await page.getByRole('checkbox').first().waitFor();
    assert(await page.getByRole('checkbox').first().isChecked(),'Milestone completion must survive reload');
    assert.equal(await page.getByRole('progressbar',{name:'Project completion',exact:true}).getAttribute('aria-valuenow'),'33');
    assert(await page.getByRole('button',{name:'Complete & add to profile',exact:false}).isDisabled(),'Incomplete projects cannot be added as completed');
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('checkbox').nth(2).check();
    await page.getByLabel('Your contribution and outcome (optional)').fill('Built and tested an accessible dashboard with keyboard navigation and clear project documentation.');
    await page.getByLabel('Work sample link (optional)').fill('https://example.com/alice-project');
    await page.getByRole('button',{name:'Complete & add to profile',exact:false}).click();
    await page.getByText('Added to your profile',{exact:true}).waitFor();
    await page.waitForFunction(()=>Backend.pending.size===0&&!Backend.saving);
    await page.goto(base+'/#profile');
    await page.getByRole('heading',{name:'Completed projects',exact:true}).waitFor();
    assert.equal(await page.locator('.profile-completed-projects article').count(),1);
    await page.reload();
    await page.getByRole('heading',{name:'Completed projects',exact:true}).waitFor();
    await page.goto(base+'/#recommend/saved/0');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('#nav .nav-link:visible').count(),5);
    await page.screenshot({path:'test-artifacts/project-plan-mobile.png',fullPage:true});
    for(const route of ['explore','projects','profile','premium']){
      await page.goto(base+'/#'+route);
      await page.waitForFunction(()=>Account.ready&&Backend.ready);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No mobile overflow on '+route);
    }
    await page.goto(base+'/#tools');
    await page.waitForURL('**/#resume');
    await page.setViewportSize({width:1280,height:900});
    await page.goto(base + '/#explore');
    // Every select has a text search control, including marketplace sort.
    assert.equal(await page.locator('select:not([hidden])').count(),0);
    const bookmark=page.locator('.job .bookmark').first();
    if(await bookmark.getAttribute('aria-pressed')!=='true')await bookmark.click();
    await page.waitForFunction(()=>document.querySelector('.job .bookmark')?.getAttribute('aria-pressed')==='true');
    assert.equal(await page.locator('.job .bookmark').first().locator('svg').getAttribute('fill'),'currentColor');
    // Auth callbacks can replace the page between a locator resolving and layout being measured.
    await page.waitForFunction(()=>Math.round(document.querySelector('.job .bookmark')?.getBoundingClientRect().width||0)===38);
    await page.locator('.job').first().screenshot({path:'test-artifacts/saved-listing.png'});
    await page.goto(base + '/#profile');
    await page.evaluate(()=>{profileStep=2;render()});
    await page.locator('#profile-skills-input').fill('pythn');
    await page.locator('#profile-skills-options').getByRole('option',{name:'Python',exact:true}).click();
    assert((await page.locator('#profile-skills-value').inputValue()).includes('Python'));
    await page.goto(base + '/#project/7');
    await page.getByRole('heading',{name:'What you’ll work on',exact:true}).waitFor();
    assert.equal(await page.locator('.listing-person-photo').count(),2);
    await page.getByRole('button',{name:'Message Casey',exact:true}).click();
    await page.locator('#sample-chat-text').fill('How would we review accessibility before handing over the booking flow?');
    await page.locator('#sample-chat-form button[type="submit"]').click();
    await page.locator('.sample-chat-bubble.outgoing').waitFor();
    await page.getByRole('button',{name:'Close',exact:true}).click();
    assert.equal(await page.locator('#nav a[href="#skills"],#nav a[href="#career"]').count(),0);
    assert.equal(await page.locator('#nav > a[href="#recommend"]').count(),1);
    assert.equal(await page.locator('#nav a[href="#tools"]').count(),0);
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
