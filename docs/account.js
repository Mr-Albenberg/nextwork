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
function accountPanel() {
  if (!Account.ready)
    return '<section class="panel account-panel" role="status">Loading your account…</section>';
  if (Account.user) {
    const linked = Account.user.identities?.some(
      (i) => i.provider === "linkedin_oidc",
    );
    return `<section class="panel wide-panel account-panel"><div class="eyebrow">YOUR NEXTWORK ACCOUNT</div><h2>Account & connections</h2><p>Signed in as <b>${esc(Account.user.email || "LinkedIn member")}</b></p><p>${linked ? "LinkedIn connected." : "Connect LinkedIn to this account whenever you’re ready."} LinkedIn sign-in supplies basic profile details; it does not import your full career history.</p><div class="dialog-actions">${linked ? '<span class="tag">LinkedIn connected ✓</span>' : '<button class="outline" data-auth-action="link">Connect LinkedIn</button>'}<a class="outline" href="#password">Change password</a><button class="outline" data-auth-action="signout">Sign out</button></div>${accountFeedback()}${typeof backendPanel === "function" ? backendPanel() : ""}${guestProfileAvailable() ? '<p>You have a personal profile saved in the guest workspace on this device.</p><button class="outline" data-auth-action="import">Import guest profile into empty fields</button>' : ""}<p class="resume-hint">Your account is online. Profiles, saved projects, application drafts, and resume text sync to your account when storage is available. Messages and Premium resume versions stay on this device.</p></section>`;
  }
  return `<section class="panel wide-panel account-panel"><div class="eyebrow">YOUR NEXTWORK ACCOUNT</div><h2>Keep your next steps together.</h2><p>Create an account with email and password, or continue with LinkedIn. You can connect LinkedIn later.</p><div class="dialog-actions"><a class="primary" href="#signup">Create account</a><a class="outline" href="#login">Sign in</a></div>${accountFeedback()}</section>`;
}
function accountFeedback() {
  return `<p id="auth-feedback" role="status" class="${Account.error ? "review-error" : "resume-hint"}">${esc(Account.error || Account.message)}</p>`;
}
function authPage() {
  const route = location.hash.slice(1);
  Account.mode =
    { signup: "signup", forgot: "forgot", password: "password" }[route] ||
    "signin";
  const mode = Account.mode,
    password = mode === "password",
    signup = mode === "signup",
    forgot = mode === "forgot";
  if (password && !Account.user)
    return (
      title(
        "Reset your password",
        "Open the link in your password reset email, or request a new one.",
      ) +
      '<a class="primary" href="#forgot">Request reset link</a>' +
      accountFeedback()
    );
  if (Account.user && !password)
    return (
      title("Your account", "Manage your account and LinkedIn connection.") +
      accountPanel()
    );
  return (
    title(
      password
        ? "Choose a new password"
        : signup
          ? "Your next chapter starts here."
          : forgot
            ? "Reset your password"
            : "Welcome back.",
      password
        ? "Use a unique password with at least 8 characters."
        : forgot
          ? "We’ll send a link to your email address."
          : "Sign in to your Nextwork account.",
    ) +
    `<section class="panel wide-panel auth-card">${!password && !forgot ? '<button class="outline linkedin-button" data-auth-action="oauth">Continue with LinkedIn</button><p class="auth-divider">or use your email</p>' : ""}<form id="auth-form">${signup ? '<label class="field">Full name<input name="name" required maxlength="120" autocomplete="name"></label>' : ""}${!password ? '<label class="field">Email<input name="email" type="email" required maxlength="254" autocomplete="email"></label>' : ""}${!forgot ? `<label class="field">${password ? "New password" : "Password"}<input name="password" type="password" required minlength="8" maxlength="128" autocomplete="${signup || password ? "new-password" : "current-password"}"></label>` : ""}${password ? '<label class="field">Confirm new password<input name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label>' : ""}<button class="primary" type="submit">${password ? "Save password" : signup ? "Create account" : forgot ? "Send reset link" : "Sign in"}</button></form>${accountFeedback()}<div class="auth-links">${signup ? '<a href="#login">Already have an account? Sign in</a>' : forgot || password ? '<a href="#login">Back to sign in</a>' : '<a href="#signup">Create an account</a><a href="#forgot">Forgot password?</a>'}<a href="#explore">Browse projects</a></div></section>`
  );
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
    initializeDemoProfile();
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
