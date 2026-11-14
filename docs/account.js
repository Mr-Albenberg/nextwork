// Public browser configuration. Never put a Supabase secret/service_role key here.
const NEXTWORK_SUPABASE_URL = "https://zkoqafidgromlbvczwzy.supabase.co";
const NEXTWORK_SUPABASE_KEY = "sb_publishable_PdLwKMARqX1Lxxp3XAuhbQ_F0T2-Kye";
// Workspace caches are separated by authenticated user; guest data is never silently adopted.
let workspaceOwner = null;
function scopedStorage(storage) {
  return {
    getItem(key) {
      return storage.getItem(
        workspaceOwner ? "nextwork:" + workspaceOwner + ":" + key : key,
      );
    },
    setItem(key, value) {
      const old = this.getItem(key);
      storage.setItem(
        workspaceOwner ? "nextwork:" + workspaceOwner + ":" + key : key,
        value,
      );
      if (old !== String(value) && typeof workspaceChanged === "function")
        workspaceChanged(key, String(value));
    },
    removeItem(key) {
      const old = this.getItem(key);
      storage.removeItem(
        workspaceOwner ? "nextwork:" + workspaceOwner + ":" + key : key,
      );
      if (old !== null && typeof workspaceChanged === "function")
        workspaceChanged(key, "");
    },
  };
}
const workspaceLocal = scopedStorage(localStorage),
  workspaceSession = scopedStorage(sessionStorage);
const Account = {
  client: null,
  user: null,
  ready: false,
  mode: "signin",
  message: "",
  error: "",
  busy: false,
  recovery: false,
};
function authCallback(recovery = false) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  if (recovery) url.searchParams.set("auth", "recovery");
  return url.href;
}
function linkedinIcon() {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z"/></svg>';
}
function linkedinButton(label, action) {
  return `<button type="button" class="linkedin-button" data-auth-action="${action}">${linkedinIcon()}<span>${label}</span></button>`;
}
function accountPanel() {
  if (!Account.ready)
    return '<section class="panel account-panel" role="status">Loading your account…</section>';
  if (!Account.user)
    return `<section class="account-panel account-guest"><div><span class="account-eyebrow">YOUR NEXTWORK ACCOUNT</span><h2>Your next chapter, all in one place.</h2><p>Save your profile, keep your resume in sync, and make your next connection.</p></div><div class="account-guest-actions">${linkedinButton("Log in with LinkedIn", "oauth")}<a class="account-button" href="#login">Log in with email</a><p>New here? <a href="#signup">Create an account</a></p></div>${accountFeedback()}</section>`;
  const linked = Account.user.identities?.some(
    (i) => i.provider === "linkedin_oidc",
  );
  const email = Account.user.email || "LinkedIn member";
  return `<section class="account-panel"><div class="account-heading"><div><span class="account-eyebrow">YOUR ACCOUNT</span><h2>Account & connections</h2><p>Manage how you log in to Nextwork.</p></div><span class="account-private">${icon("check", 14)} Private account</span></div><div class="account-identity"><span class="account-monogram">${profileInitials(graduateProfile().name || email)}</span><div><strong>${esc(graduateProfile().name || "Your Nextwork account")}</strong><span>${esc(email)}</span></div></div><div class="account-setting"><div class="account-provider-icon">${linkedinIcon()}</div><div class="account-setting-copy"><h3>LinkedIn</h3><p>${linked ? "Your LinkedIn account is connected." : "Connect your professional profile to this account."}</p></div>${linked ? `<span class="account-connected">${icon("check", 15)} Connected</span>` : linkedinButton("Connect LinkedIn", "link")}</div><div class="account-setting"><div class="account-setting-icon">${icon("settings", 21)}</div><div class="account-setting-copy"><h3>Password</h3><p>Keep your account secure with a unique password.</p></div><a class="account-button" href="#password">Change password</a></div>${accountFeedback()}${typeof backendPanel === "function" ? backendPanel() : ""}${guestProfileAvailable() ? '<div class="account-import"><p>A profile is saved in the guest workspace on this device.</p><button class="account-text-button" data-auth-action="import">Import guest profile into empty fields</button></div>' : ""}<div class="account-footer"><span>You’re in control of your connections.</span><button class="account-signout" data-auth-action="signout">Sign out ${icon("arrow", 15)}</button></div></section>`;
}
function accountFeedback() {
  return `<p id="auth-feedback" role="status" class="${Account.error ? "review-error" : "resume-hint"}">${esc(Account.error || Account.message)}</p>`;
}
function authPage() {
  const route = location.hash.slice(1);
  Account.mode =
    { signup: "signup", forgot: "forgot", password: "password" }[route] ||
    "signin";
  const password = Account.mode === "password",
    signup = Account.mode === "signup",
    forgot = Account.mode === "forgot";
  if (Account.user && !password) return accountPanel();
  const heading = password
    ? "Choose a new password"
    : signup
      ? "Your next chapter starts here."
      : forgot
        ? "Forgot your password?"
        : "Welcome back.";
  const description = password
    ? "Use a unique password with at least 8 characters."
    : signup
      ? "Make connections. Find projects. Build what’s next."
      : forgot
        ? "We’ll send you a link to get back into your account."
        : "Log in to find your next connection and opportunity.";
  if (password && !Account.user)
    return `<div class="auth-layout"><section class="auth-card"><h1>Reset your password</h1><p>Open the link in your reset email, or request a new one.</p><a class="auth-submit" href="#forgot">Request reset link</a>${accountFeedback()}</section></div>`;
  return `<div class="auth-layout"><section class="auth-card" aria-labelledby="auth-heading"><a class="auth-brand" href="#home" aria-label="Nextwork home"><img src="nextwork-icon.png" alt=""><span>nextwork</span></a><div class="auth-card-heading"><h1 id="auth-heading">${heading}</h1><p>${description}</p></div>${!password && !forgot ? `<nav class="auth-tabs" aria-label="Account access"><a href="#login" ${!signup ? 'aria-current="page"' : ""}>Log in</a><a href="#signup" ${signup ? 'aria-current="page"' : ""}>Create account</a></nav>${linkedinButton(signup ? "Sign up with LinkedIn" : "Log in with LinkedIn", "oauth")}<div class="auth-divider"><span>${signup ? "or sign up with email" : "or log in with email"}</span></div>` : ""}<form id="auth-form">${signup ? '<div class="auth-field"><label for="auth-name">Full name</label><input id="auth-name" name="name" required maxlength="120" autocomplete="name" placeholder="Your full name"></div>' : ""}${!password ? '<div class="auth-field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"></div>' : ""}${!forgot ? `<div class="auth-field"><div class="auth-field-heading"><label for="auth-password">${password ? "New password" : "Password"}</label>${!signup && !password ? '<a href="#forgot">Forgot password?</a>' : ""}</div><input id="auth-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="${signup || password ? "new-password" : "current-password"}" placeholder="${signup || password ? "At least 8 characters" : "Enter your password"}"></div>` : ""}${password ? '<div class="auth-field"><label for="auth-confirm">Confirm new password</label><input id="auth-confirm" name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="Re-enter your new password"></div>' : ""}<button class="auth-submit" type="submit">${password ? "Save password" : signup ? "Create account" : forgot ? "Send reset link" : "Log in with email"} ${icon("arrow", 17)}</button></form>${accountFeedback()}<div class="auth-bottom">${signup ? 'Already a member? <a href="#login">Log in</a>' : forgot || password ? '<a href="#login">Back to log in</a>' : 'New to Nextwork? <a href="#signup">Create an account</a>'}</div></section><a class="auth-browse" href="#home">Back to homepage ${icon("arrow", 15)}</a></div>`;
}
function authFeedback(error = "", message = "") {
  Account.error = error;
  Account.message = message;
  const node = document.querySelector("#auth-feedback");
  if (node) {
    node.textContent = error || message;
    node.className = error ? "review-error" : "resume-hint";
  }
}
function authError(error) {
  const code = error?.code || "";
  if (code === "identity_already_exists" || code === "identity_already_linked")
    return "That LinkedIn account is already connected to another Nextwork account. Sign in to that account to manage it.";
  if (code === "manual_linking_disabled")
    return "LinkedIn linking is unavailable. Enable Allow manual linking in Supabase Sign In / Providers.";
  if (code === "email_not_confirmed")
    return "Check your inbox and confirm your email before signing in.";
  return (
    error?.message || "We couldn’t complete that request. Please try again."
  );
}
async function runAuth(action) {
  if (Account.busy) return;
  Account.busy = true;
  authFeedback();
  document
    .querySelectorAll("[data-auth-action],#auth-form button")
    .forEach((b) => (b.disabled = true));
  try {
    if (!Account.client)
      throw Error(
        "Account service is unavailable. Reload the page and try again.",
      );
    await action();
  } catch (error) {
    if (typeof Backend !== "undefined") Backend.paused = false;
    authFeedback(authError(error));
  } finally {
    Account.busy = false;
    document
      .querySelectorAll("[data-auth-action],#auth-form button")
      .forEach((b) => (b.disabled = false));
  }
}
function checkAuthResult(result) {
  if (result.error) throw result.error;
  return result.data;
}
function bindAccount() {
  document.querySelectorAll("[data-auth-action]").forEach(
    (button) =>
      (button.onclick = () =>
        runAuth(async () => {
          const action = button.dataset.authAction;
          if (action === "oauth") {
            checkAuthResult(
              await Account.client.auth.signInWithOAuth({
                provider: "linkedin_oidc",
                options: {
                  redirectTo: authCallback(),
                  scopes: "openid profile email",
                },
              }),
            );
          }
          if (action === "link") {
            if (!Account.user)
              throw Error("Sign in before connecting LinkedIn.");
            checkAuthResult(
              await Account.client.auth.linkIdentity({
                provider: "linkedin_oidc",
                options: {
                  redirectTo: authCallback(),
                  scopes: "openid profile email",
                },
              }),
            );
          }
          if (action === "sync" || action === "cloud" || action === "device") {
            await syncWorkspace(false, action === "sync" ? null : action);
            render();
          }
          if (action === "signout") {
            if (backendDirty()) {
              await syncWorkspace();
              if (backendDirty())
                Account.message =
                  "Signed out. Unsynced changes remain on this device for your next sign-in.";
            }
            Backend.paused = true;
            checkAuthResult(
              await Account.client.auth.signOut({ scope: "local" }),
            );
            Account.recovery = false;
            location.hash = "login";
          }
          if (action === "import") {
            importGuestProfile();
            render();
          }
        })),
  );
  const form = document.querySelector("#auth-form");
  if (form)
    form.onsubmit = (event) => {
      event.preventDefault();
      const fields = new FormData(form),
        mode = Account.mode;
      return runAuth(async () => {
        const email = String(fields.get("email") || "").trim(),
          password = String(fields.get("password") || "");
        if (mode === "signup") {
          const data = checkAuthResult(
            await Account.client.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: authCallback(),
                data: { full_name: String(fields.get("name") || "").trim() },
              },
            }),
          );
          form.reset();
          authFeedback(
            "",
            data.session
              ? "Account created."
              : "Check your email to confirm your account, then sign in.",
          );
          if (data.session) location.hash = "profile";
        } else if (mode === "forgot") {
          checkAuthResult(
            await Account.client.auth.resetPasswordForEmail(email, {
              redirectTo: authCallback(true),
            }),
          );
          authFeedback(
            "",
            "If an account exists for that email, a password reset link is on its way.",
          );
        } else if (mode === "password") {
          if (password !== fields.get("confirm"))
            throw Error("The passwords do not match.");
          checkAuthResult(await Account.client.auth.updateUser({ password }));
          Account.recovery = false;
          Account.message = "Password saved.";
          location.hash = "profile";
        } else {
          checkAuthResult(
            await Account.client.auth.signInWithPassword({ email, password }),
          );
          location.hash = "profile";
        }
      });
    };
}
function guestProfileAvailable() {
  try {
    const p = JSON.parse(localStorage.getItem("proof-profile") || "{}");
    return (
      Account.user &&
      p.name &&
      p.email !== "jordan.rivera@example.com" &&
      !String(p.education || "").includes("(fictional)")
    );
  } catch {
    return false;
  }
}
function importGuestProfile() {
  if (!guestProfileAvailable()) return;
  const guest = JSON.parse(localStorage.getItem("proof-profile") || "{}"),
    current = graduateProfile();
  for (const key of [
    "name",
    "education",
    "degree",
    "graduation",
    "location",
    "field",
    "role",
    "skills",
    "availability",
    "engagement",
    "workstyle",
    "portfolio",
    "bio",
  ])
    if (!current[key] && guest[key]) current[key] = guest[key];
  workspaceLocal.setItem("proof-profile", JSON.stringify(current));
  Account.message = "Guest profile imported into empty fields.";
}
function activateWorkspace(user) {
  const owner = user?.id || null,
    changed = workspaceOwner !== owner;
  Account.user = user;
  workspaceOwner = owner;
  if (changed) {
    closeModal();
    saved = JSON.parse(workspaceLocal.getItem("lp-saved") || "[]");
    applications = JSON.parse(workspaceLocal.getItem("lp-apps") || "[]");
    resumeReport = null;
    profileStep = 0;
    activePerson = "creator-1";
    inboxFilter = "inbox";
    inboxQuery = "";
    query = "";
    category = "All projects";
    sort = "match";
    resumeMode = workspaceSession.getItem("proof-selected-listing")
      ? "job"
      : "general";
  }
  if (user) {
    const p = graduateProfile();
    let modified = false;
    const metadata = user.user_metadata || {};
    for (const [key, value] of [
      ["name", metadata.full_name || metadata.name],
      ["email", user.email],
    ])
      if (!p[key] && value) {
        p[key] = value;
        modified = true;
      }
    if (modified)
      localStorage.setItem(
        "nextwork:" + workspaceOwner + ":proof-profile",
        JSON.stringify(p),
      );
  } else {
    saved = JSON.parse(workspaceLocal.getItem("lp-saved") || "[]");
    applications = JSON.parse(workspaceLocal.getItem("lp-apps") || "[]");
  }
}
async function initializeAccount() {
  const entryURL = new URL(location.href);
  try {
    if (!window.supabase?.createClient)
      throw Error("Account service could not load. Reload to try again.");
    Account.client = window.supabase.createClient(
      NEXTWORK_SUPABASE_URL,
      NEXTWORK_SUPABASE_KEY,
      {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
    Account.client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") Account.recovery = true;
      setTimeout(async () => {
        if (!Account.ready) return;
        if (event === "TOKEN_REFRESHED") {
          Account.user = session?.user || null;
          return;
        }
        const changed = workspaceOwner !== (session?.user?.id || null);
        if (changed) {
          Account.ready = false;
          activateWorkspace(session?.user || null);
          await connectWorkspace(session?.user || null);
          Account.ready = true;
        } else Account.user = session?.user || null;
        if (Account.recovery) location.hash = "password";
        render();
      }, 0);
    });
    const data = checkAuthResult(await Account.client.auth.getSession());
    activateWorkspace(data.session?.user || null);
    await connectWorkspace(data.session?.user || null);
    const url = new URL(location.href);
    if (url.searchParams.get("auth") === "recovery" && Account.user)
      Account.recovery = true;
    const params = new URLSearchParams(url.hash.slice(1));
    const error =
      url.searchParams.get("error_description") ||
      params.get("error_description");
    if (error) Account.error = "Sign-in could not be completed: " + error;
    if (entryURL.searchParams.has("code") && !Account.user)
      Account.error =
        "This sign-in link has expired or is invalid. Please try again.";
    if (
      entryURL.searchParams.has("code") ||
      url.searchParams.has("auth") ||
      url.searchParams.has("error")
    ) {
      url.search = "";
      url.hash = Account.recovery
        ? "password"
        : Account.user
          ? "profile"
          : "login";
      history.replaceState(null, "", url);
    } else if (params.has("error")) {
      history.replaceState(null, "", url.pathname + "#login");
    }
    if (Account.recovery) location.hash = "password";
  } catch (error) {
    Account.error = authError(error);
    activateWorkspace(null);
  } finally {
    Account.ready = true;
    render();
  }
}

function publicPage(page) {
  return ["home", "pricing", "login", "signup", "forgot", "password"].includes(
    page,
  );
}
function requireAccount(message = "Log in to access your Nextwork workspace.") {
  if (typeof Account === "undefined" || Account.user) return true;
  Account.message = message;
  const area = document.querySelector('#app');
  if (area) area.textContent = '';
  document.body.classList.remove('messages-page');
  closeModal();
  location.hash = "login";
  return false;
}
function updateAccountChrome(page) {
  document.body.dataset.auth = Account.user ? "member" : "guest";
  document.body.dataset.page = page;
  const crumb = document.querySelector(".header-breadcrumb");
  if (crumb)
    crumb.innerHTML = Account.user
      ? "Workspace <span>/</span> Your next chapter"
      : '<a class="guest-brand" href="#home"><img src="nextwork-icon.png" alt=""><span>nextwork</span></a>';
}
