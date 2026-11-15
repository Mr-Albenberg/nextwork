// Public browser configuration. Never put a Supabase secret/service_role key here.
const NEXTWORK_SUPABASE_URL = "https://zkoqafidgromlbvczwzy.supabase.co";
const NEXTWORK_SUPABASE_KEY = "sb_publishable_PdLwKMARqX1Lxxp3XAuhbQ_F0T2-Kye";
// Supabase persists the login session. Account content is fetched from the database, never from disk.
let workspaceOwner = null;
function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      const text = String(value),
        old = this.getItem(key);
      values.set(key, text);
      if (old !== text && typeof workspaceChanged === "function")
        workspaceChanged(key);
    },
    removeItem(key) {
      const existed = values.delete(key);
      if (existed && typeof workspaceChanged === "function")
        workspaceChanged(key);
    },
    clear() {
      values.clear();
    },
  };
}
const workspaceLocal = memoryStorage(),
  workspaceSession = memoryStorage();
function clearWorkspaceMemory() {
  if (typeof ResumeDocuments !== "undefined") ResumeDocuments.reset();
  if (typeof NextworkMatch !== "undefined") NextworkMatch.reset();
  if (typeof resetMessaging === "function") resetMessaging();
  workspaceLocal.clear();
  workspaceSession.clear();
}
function clearLegacyWorkspaceStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (
        key &&
        (key.startsWith("nextwork:") ||
          key.startsWith("proof-") ||
          key.startsWith("lp-") ||
          key === "nextwork-growth")
      )
        storage.removeItem(key);
    }
  }
}

const Account = {
  client: null,
  user: null,
  ready: false,
  mode: "signin",
  message: "",
  error: "",
  busy: false,
  recovery: false,
  sessionEpoch: 0,
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
    return loadingView('Opening your account','Loading your account settings.',true);
  if (!Account.user)
    return `<section class="account-panel account-guest"><div><span class="account-eyebrow">YOUR NEXTWORK ACCOUNT</span><h2>Your next chapter, all in one place.</h2><p>Save your profile, save your resume, and make your next connection.</p></div><div class="account-guest-actions">${linkedinButton("Log in with LinkedIn", "oauth")}<a class="account-button" href="#login">Log in with email</a><p>New here? <a href="#signup">Create an account</a></p></div>${accountFeedback()}</section>`;
  const linked = Account.user.identities?.some(
    (i) => i.provider === "linkedin_oidc",
  );
  const email = Account.user.email || "LinkedIn member";
  return `<section class="account-panel"><div class="account-heading"><div><span class="account-eyebrow">MY ACCOUNT</span><h2>Account & connections</h2><p>${isOrganizationAccount() ? "Organization account · Hiring workspace" : "Personal account · Candidate workspace"}. Account type cannot be changed.</p><p>Manage how you log in as ${esc(email)}.</p></div><span class="account-private">${icon("check", 14)} Private account</span></div><div class="account-setting"><div class="account-provider-icon">${linkedinIcon()}</div><div class="account-setting-copy"><h3>LinkedIn</h3><p>${linked ? "Your LinkedIn account is connected." : "Connect your professional profile to this account."}</p></div>${linked ? `<span class="account-connected">${icon("check", 15)} Connected</span>` : linkedinButton("Connect LinkedIn", "link")}</div><div class="account-setting"><div class="account-setting-icon">${icon("settings", 21)}</div><div class="account-setting-copy"><h3>Password</h3><p>Keep your account secure with a unique password.</p></div><a class="account-button" href="#password">Change password</a></div>${accountFeedback()}${!isOrganizationAccount() && typeof backendPanel === "function" ? backendPanel() : ""}<div class="account-danger"><div><h3>Delete account</h3><p>Permanently delete your account and all saved profile, resume, project, and application data.</p></div><button class="account-delete-button" data-auth-action="delete-dialog">Delete account</button></div><div class="account-footer"><span>You’re in control of your connections.</span><button class="account-signout" data-auth-action="signout">Sign out ${icon("arrow", 15)}</button></div></section>`;
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
  return `<div class="auth-layout"><section class="auth-card" aria-labelledby="auth-heading"><a class="auth-brand" href="#home" aria-label="Nextwork home"><img src="assets/brand/nextwork-icon.png" alt=""><span>nextwork</span></a><div class="auth-card-heading"><h1 id="auth-heading">${heading}</h1><p>${description}</p></div>${!password && !forgot ? `${linkedinButton(signup ? "Sign up with LinkedIn" : "Log in with LinkedIn", "oauth")}<div class="auth-divider"><span>${signup ? "or sign up with email" : "or log in with email"}</span></div>` : ""}<form id="auth-form">${signup ? '<div class="auth-field"><label for="auth-name">Full name</label><input id="auth-name" name="name" required maxlength="120" autocomplete="name" placeholder="Your full name"></div>' : ""}${!password ? '<div class="auth-field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"></div>' : ""}${!forgot ? `<div class="auth-field"><div class="auth-field-heading"><label for="auth-password">${password ? "New password" : "Password"}</label>${!signup && !password ? '<a href="#forgot">Forgot password?</a>' : ""}</div><input id="auth-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="${signup || password ? "new-password" : "current-password"}" placeholder="${signup || password ? "At least 8 characters" : "Enter your password"}"></div>` : ""}${password ? '<div class="auth-field"><label for="auth-confirm">Confirm new password</label><input id="auth-confirm" name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="Re-enter your new password"></div>' : ""}<button class="auth-submit" type="submit">${password ? "Save password" : signup ? "Create account" : forgot ? "Send reset link" : "Log in with email"} ${icon("arrow", 17)}</button></form>${Account.message === "Log in to access your Nextwork workspace." && signup ? '<p id="auth-feedback" class="resume-hint" role="status"></p>' : accountFeedback()}<div class="auth-bottom">${signup ? 'Already a member? <a href="#login">Log in</a>' : forgot || password ? '<a href="#login">Back to log in</a>' : 'New to Nextwork? <a href="#signup">Create an account</a>'}</div></section><a class="auth-browse" href="#home">Back to homepage ${icon("arrow", 15)}</a></div>`;
}
function authFeedback(error = "", message = "") {
  Account.error = error;
  if (/^#project\/\d+$/.test(location.hash)) sessionStorage.setItem('nextwork-auth-intent', location.hash.slice(1));
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
  const busyFeedback=document.querySelector('#auth-feedback');
  if(busyFeedback)busyFeedback.innerHTML=inlineLoading('Connecting securely…');
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
    authFeedback(authError(error));
  } finally {
    Account.busy = false;
    const busyFeedback=document.querySelector('#auth-feedback');
    if(busyFeedback?.querySelector('.inline-loading'))busyFeedback.textContent=Account.error||Account.message||'';
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
  if (typeof bindProfileMedia === "function") bindProfileMedia();
  document.querySelectorAll("[data-auth-action]").forEach(
    (button) =>
      (button.onclick = () =>
        runAuth(async () => {
          const action = button.dataset.authAction;
          if (action === "oauth") {
            if (typeof markLinkedInConsent === "function")
              markLinkedInConsent();
            checkAuthResult(
              await Account.client.auth.signInWithOAuth({
                provider: "linkedin_oidc",
                options: {
                  redirectTo: authCallback(),
                  queryParams: { enable_extended_login: "true" },
                },
              }),
            );
          }
          if (action === "link") {
            if (typeof markLinkedInConsent === "function")
              markLinkedInConsent();
            if (!Account.user)
              throw Error("Sign in before connecting LinkedIn.");
            checkAuthResult(
              await Account.client.auth.linkIdentity({
                provider: "linkedin_oidc",
                options: {
                  redirectTo: authCallback(),
                  queryParams: { enable_extended_login: "true" },
                },
              }),
            );
          }
          if (action === "reload") {
            await connectWorkspace(Account.user);
            render();
          }
          if (action === "delete-dialog") openDeleteAccount();
          if (action === "organization-signout") {
            await endAccountSession();
            location.hash = "organization-signup";
          }
          if (action === "signout") {
            if (Backend.ready && (Backend.pending.size || Backend.task))
              await saveWorkspace();
            await endAccountSession();
            Account.recovery = false;
            location.hash = "login";
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
          if (typeof markLinkedInConsent === "function") markLinkedInConsent();
          const data = checkAuthResult(
            await Account.client.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: authCallback(),
                data: { full_name: String(fields.get("name") || "").trim(), account_kind: "personal" },
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
          if (data.session) location.hash = postLoginRoute();
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
          location.hash = typeof isOrganizationAccount === "function" && isOrganizationAccount() ? "settings" : "profile";
        } else {
          if (typeof markLinkedInConsent === "function") markLinkedInConsent();
          const data = checkAuthResult(
            await Account.client.auth.signInWithPassword({ email, password }),
          );
          if (isOrganizationAccount(data.user)) {
            await endAccountSession();
            throw Error("This is an organization account. Use Organization login to access your hiring portal.");
          }
          location.hash = postLoginRoute();
        }
      });
    };
}
function activateWorkspace(user) {
  if (typeof resetProfileMedia === "function") resetProfileMedia();
  if (typeof resetOrganizationWorkspace === "function")
    resetOrganizationWorkspace();
  if (typeof resetOrganizationWorkspace === "function")
    resetOrganizationWorkspace();
  const owner = user?.id || null,
    changed = workspaceOwner !== owner;
  Account.user = user;
  workspaceOwner = owner;
  if (changed) {
    closeModal();
    saved = JSON.parse(workspaceLocal.getItem("lp-saved") || "[]");
    applications = JSON.parse(workspaceLocal.getItem("lp-apps") || "[]");
    resumeReport = null;
    if(typeof resetResumeReview==='function')resetResumeReview();
    profileStep = 0;
    if (typeof workTab !== "undefined") workTab = "applications";
    if (typeof recoState !== "undefined") recoState = { status: "idle", step: "", error: "", result: null, busy: false };
    activePerson = "";
    inboxFilter = "inbox";
    inboxQuery = "";
    query = "";
    category = "All projects";
    sort = "match";
    resumeMode = workspaceSession.getItem("proof-selected-listing")
      ? "job"
      : "general";
  }
}
async function initializeAccount() {
  clearLegacyWorkspaceStorage();
  const entryURL = new URL(location.href);
  try {
    if (!window.supabase?.createClient)
      throw Error("Account service could not load. Reload to try again.");
    Account.client = window.supabase.createClient(
      NEXTWORK_SUPABASE_URL,
      NEXTWORK_SUPABASE_KEY,
      {
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal || AbortSignal.timeout(15000),
            }),
        },
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
    Account.client.auth.onAuthStateChange((event, session) => {
      // The initial session is verified and rendered explicitly below.
      if (event === "INITIAL_SESSION") return;
      if (event === "PASSWORD_RECOVERY") Account.recovery = true;
      const epoch = Account.sessionEpoch;
      setTimeout(async () => {
        if (!Account.ready || epoch !== Account.sessionEpoch) return;
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
        } else {
          const wasLinked = Account.user?.identities?.some(identity => identity.provider === "linkedin_oidc");
          Account.user = session?.user || null;
          const linked = Account.user?.identities?.some(identity => identity.provider === "linkedin_oidc");
          if (
            ["SIGNED_IN", "USER_UPDATED"].includes(event) &&
            typeof fillMissingFromLinkedIn === "function"
          )
            fillMissingFromLinkedIn().catch(() => {});
          // Keep existing controls and drafts during routine session confirmations.
          if (!Account.recovery && ["SIGNED_IN", "USER_UPDATED"].includes(event) && wasLinked === linked) return;
        }
        if (Account.recovery) location.hash = "password";
        render();
      }, 0);
    });
    const data = checkAuthResult(await Account.client.auth.getSession());
    let verifiedUser = null;
    if (data.session) {
      const verification = await Account.client.auth.getUser();
      if (verification.error) {
        if (
          [401, 403, 404].includes(verification.error.status) ||
          [
            "user_not_found",
            "session_not_found",
            "refresh_token_not_found",
          ].includes(verification.error.code)
        )
          await endAccountSession();
        else
          throw Error(
            "We couldn’t verify your login. Check your connection and try again.",
          );
      } else if (verification.data?.user?.id)
        verifiedUser = verification.data.user;
      else await endAccountSession();
    }
    activateWorkspace(verifiedUser);
    await connectWorkspace(verifiedUser);
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
          ? postLoginRoute()
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
  return [
    "home",
    "pricing",
    "login",
    "signup",
    "forgot",
    "password",
    "organization",
    "organization-login",
    "organization-signup",
  ].includes(page);
}
function requireAccount(message = "Log in to access your Nextwork workspace.") {
  if (typeof Account === "undefined" || Account.user) return true;
  Account.message = message;
  if (location.hash === "#checkout") sessionStorage.setItem("nextwork-auth-intent", "checkout");
  const area = document.querySelector("#app");
  if (area) area.textContent = "";
  document.body.classList.remove("messages-page");
  closeModal();
  location.hash = "login";
  return false;
}
function updateAccountChrome(page) {
  document.body.dataset.auth = Account.user ? "member" : "guest";
  document.body.dataset.page = page;
  const pageLabel = document.querySelector('.workspace-page-label');
  if (pageLabel) { const labels={overview:'Overview',explore:'Find work',projects:'My work',recommend:'Project ideas',resume:'My resume',profile:'Account settings',messages:'Messages',organization:'Hiring portal',premium:'Premium',checkout:'Membership',settings:'Account settings'}; pageLabel.textContent=page.startsWith('recommend/saved/')?'My work':labels[page.split('/')[0]]||''; }

  const hiring = isOrganizationAccount();
  document.body.dataset.accountType = hiring ? "organization" : "personal";
  document.querySelectorAll('a.account').forEach(link => link.href = '#settings');
  const brand = document.querySelector('.workspace-header .brand');
  if (brand) brand.href = Account.user ? (hiring ? '#organization' : '#overview') : '#home';
  const nextStep = document.querySelector('.sidebar-next-step');
  if (nextStep) { nextStep.href = hiring ? '#organization' : '#resume'; nextStep.innerHTML = hiring ? '<span>YOUR HIRING WORKSPACE</span><b>Build your next team</b><small>Review listings & applicants →</small>' : '<span>YOUR NEXT STEP</span><b>Find your strongest match</b><small>Review resume →</small>'; }
  const bell = document.querySelector('.bell');
  if (bell) { bell.setAttribute('aria-label', hiring ? 'View applicants' : 'View messages'); bell.onclick = () => { if(hiring) Organization.tab='applicants'; location.hash=hiring?'organization':'messages'; render(); }; }
  const messageLabel = document.querySelector('.header-message-label');
  if (messageLabel) messageLabel.textContent = hiring ? 'Applicants' : 'Messages';

}

function postLoginRoute() {
  const next = sessionStorage.getItem("nextwork-auth-intent");
  sessionStorage.removeItem("nextwork-auth-intent");
  if (typeof isOrganizationAccount === 'function' && isOrganizationAccount()) return 'organization';
  return next === 'checkout' || /^project\/\d+$/.test(next || '') ? next : 'overview';
}

function openDeleteAccount() {
  if (!Account.user) return;
  const modal = document.querySelector("#modal");
  modal.hidden = false;
  modal.innerHTML = `<div class="dialog delete-account-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-heading"><button class="close" onclick="closeModal()" aria-label="Close">×</button><span class="account-eyebrow">ACCOUNT SETTINGS</span><h2 id="delete-account-heading">Delete your account?</h2><p>This permanently removes your login, LinkedIn connection, profile, resume, saved projects, and application drafts. If you own an organization, its listings and received applications will also be deleted. This cannot be undone.</p><form id="delete-account-form"><label class="field">Type DELETE to confirm<input id="delete-account-confirm" required autocomplete="off" pattern="DELETE" placeholder="DELETE"></label><p id="delete-account-error" class="review-error" role="alert"></p><div class="dialog-actions"><button type="button" class="account-button" onclick="closeModal()">Keep my account</button><button type="submit" class="account-delete-button">Permanently delete account</button></div></form></div>`;
  modal.querySelector(".close").focus();
  document.querySelector("#delete-account-form").onsubmit = async (event) => {
    event.preventDefault();
    if (document.querySelector("#delete-account-confirm").value !== "DELETE")
      return;
    const button = event.submitter;
    button.disabled = true;
    const errorNode = document.querySelector("#delete-account-error");
    errorNode.textContent = "";
    try {
      // Finish outstanding writes so a late request cannot recreate data after deletion.
      if (Backend.ready && (Backend.pending.size || Backend.task))
        await saveWorkspace();
      if (typeof cleanupMessagingUploads === "function") await cleanupMessagingUploads();
      if (typeof cleanupResumeUploads === "function") await cleanupResumeUploads();
      if (typeof cleanupProjectUploads === "function") await cleanupProjectUploads();
      let result = await Account.client.rpc("delete_my_account");
      if (result.error?.message?.includes("PHOTO_CLEANUP_REQUIRED")) {
        if (Account.client.storage)
          await Account.client.storage
            .from("profile-photo-staging")
            .remove([Account.user.id + "/pending"]);
        result = await Account.client.rpc("delete_my_account");
        if (result.error?.message?.includes("PHOTO_CLEANUP_REQUIRED")) {
          if (typeof photoRequest !== "function") throw result.error;
          await photoRequest("DELETE", null, null, true);
          result = await Account.client.rpc("delete_my_account");
        }
      }
      if (result.error) throw result.error;
      await endAccountSession();
      clearLegacyWorkspaceStorage();
      Account.message = "Your account has been deleted.";
      Account.error = "";
      location.hash = "login";
      closeModal();
      render();
    } catch (error) {
      errorNode.textContent = ["PGRST202", "42883"].includes(error.code)
        ? "Account deletion is not available yet. Please contact support."
        : "We couldn’t delete your account. Please check your connection and try again.";
      button.disabled = false;
    }
  };
}

function removeSavedAuthSession() {
  const prefix =
    "sb-" +
    new URL(NEXTWORK_SUPABASE_URL).hostname.split(".")[0] +
    "-auth-token";
  for (const storage of [localStorage, sessionStorage])
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (
        key &&
        (key === prefix ||
          key.startsWith(prefix + "-") ||
          key.startsWith(prefix + "."))
      )
        storage.removeItem(key);
    }
}
async function endAccountSession() {
  Account.sessionEpoch++;
  try {
    await Account.client?.auth.signOut({ scope: "local" });
  } catch {
  } finally {
    removeSavedAuthSession();
    Account.recovery = false;
    activateWorkspace(null);
    await connectWorkspace(null);
  }
}
