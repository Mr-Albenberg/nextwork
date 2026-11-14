// Account data lives in Postgres. The browser holds only the current page's working state.
const Backend = {
  owner: null,
  ready: false,
  loading: false,
  saving: false,
  version: 0,
  error: "",
  status: "",
  pending: new Set(),
  timer: null,
  task: null,
  generation: 0,
};
const extraKeys = [
  "proof-resume-versions",
  "proof-conversations",
  "lp-score",
  "nextwork-growth",
];
const accountColumns = {
  "proof-profile": "profile",
  "lp-saved": "saved_projects",
  "proof-applications": "application_drafts",
  "proof-resume": "resume",
};
function workspaceChanged(key) {
  if (!workspaceOwner || Backend.loading || !Backend.ready) return;
  const column =
    accountColumns[key] || (extraKeys.includes(key) ? "extras" : null);
  if (!column) return;
  Backend.pending.add(column);
  Backend.status = "Saving changes…";
  backendStatus();
  clearTimeout(Backend.timer);
  Backend.timer = setTimeout(() => saveWorkspace().catch(() => {}), 400);
}
function backendStatus() {
  const node = document.querySelector("#account-save-status");
  if (node) node.textContent = Backend.status;
}
function backendPanel() {
  return Account.user
    ? `<p id="account-save-status" class="account-save-status" role="status">${esc(Backend.status)}</p>`
    : "";
}
function workspacePayload() {
  return {
    profile: graduateProfile(),
    saved_projects: JSON.parse(workspaceLocal.getItem("lp-saved") || "[]"),
    application_drafts: JSON.parse(
      workspaceLocal.getItem("proof-applications") || "[]",
    ),
    resume: workspaceSession.getItem("proof-resume") || "",
    extras: Object.fromEntries(
      extraKeys
        .map((key) => [key, workspaceLocal.getItem(key)])
        .filter(([, value]) => value !== null),
    ),
  };
}
function hydrateWorkspace(row) {
  Backend.loading = true;
  try {
    for (const key of extraKeys) workspaceLocal.removeItem(key);
    for (const [key, value] of Object.entries(row.extras || {}))
      if (extraKeys.includes(key) && typeof value === "string")
        workspaceLocal.setItem(key, value);
    workspaceLocal.setItem("proof-profile", JSON.stringify(row.profile || {}));
    workspaceLocal.setItem(
      "lp-saved",
      JSON.stringify(row.saved_projects || []),
    );
    workspaceLocal.setItem(
      "proof-applications",
      JSON.stringify(row.application_drafts || []),
    );
    workspaceLocal.setItem(
      "lp-apps",
      JSON.stringify((row.application_drafts || []).map((a) => a.jobId)),
    );
    workspaceSession.setItem("proof-resume", row.resume || "");
    Backend.version = row.version;
    saved = row.saved_projects || [];
    applications = (row.application_drafts || []).map((a) => a.jobId);
    resumeReport = null;
  } finally {
    Backend.loading = false;
  }
}
function accountConnectionPage() {
  return `<section class="account-panel connection-error"><span class="account-eyebrow">NEXTWORK</span><h1>We couldn’t open your workspace.</h1><p>${esc(Backend.error || "An internet connection is required. Please try again.")}</p><div class="dialog-actions"><button class="auth-submit" data-auth-action="reload">Try again</button><button class="account-button" data-auth-action="signout">Log out</button></div></section>`;
}
function failWorkspace() {
  if (typeof resetOrganizationWorkspace === "function")
    resetOrganizationWorkspace();
  Backend.ready = false;
  Backend.error =
    "We couldn’t reach your account. Check your connection and try again. Changes that were not saved have been discarded.";
  Backend.status = "";
  Backend.pending.clear();
  clearTimeout(Backend.timer);
  clearWorkspaceMemory();
  saved = [];
  applications = [];
  resumeReport = null;
  closeModal();
  render();
}
async function connectWorkspace(user) {
  clearTimeout(Backend.timer);
  const generation = ++Backend.generation;
  Backend.owner = user?.id || null;
  Backend.ready = false;
  Backend.loading = false;
  Backend.saving = false;
  Backend.version = 0;
  Backend.pending.clear();
  Backend.task = null;
  Backend.error = "";
  Backend.status = "";
  clearWorkspaceMemory();
  saved = [];
  applications = [];
  resumeReport = null;
  if (!user) return;
  if (typeof isOrganizationAccount === "function" && isOrganizationAccount(user)) { Backend.ready = true; return; }
  try {
    let result = await Account.client
      .from("account_workspaces")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (generation !== Backend.generation) return;
    if (result.error) throw result.error;
    if (!result.data) {
      const metadata = user.user_metadata || {};
      result = await Account.client
        .from("account_workspaces")
        .insert({
          user_id: user.id,
          profile: {
            name: metadata.full_name || metadata.name || "",
            email: user.email || "",
          },
        })
        .select("*")
        .single();
      if (result.error?.code === "23505")
        result = await Account.client
          .from("account_workspaces")
          .select("*")
          .eq("user_id", user.id)
          .single();
      if (result.error) throw result.error;
    }
    if (generation !== Backend.generation) return;
    hydrateWorkspace(result.data);
    Backend.ready = true;
  } catch {
    if (generation === Backend.generation) {
      Backend.error =
        "We couldn’t reach your account. Check your connection and try again.";
      Backend.ready = false;
    }
  }
}
async function saveWorkspace() {
  clearTimeout(Backend.timer);
  if (!Backend.ready)
    throw Error("Your account is unavailable. Please reconnect.");
  if (Backend.task) return Backend.task;
  if (!Backend.pending.size) return;
  const owner = Backend.owner,
    generation = Backend.generation,
    current = () =>
      generation === Backend.generation && owner === workspaceOwner;
  Backend.saving = true;
  const task = (async () => {
    try {
      while (Backend.pending.size && current()) {
        const columns = [...Backend.pending];
        Backend.pending.clear();
        const payload = workspacePayload(),
          patch = Object.fromEntries(
            columns.map((column) => [column, payload[column]]),
          );
        let result;
        for (let attempt = 0; attempt < 3; attempt++) {
          result = await Account.client
            .from("account_workspaces")
            .update(patch)
            .eq("user_id", owner)
            .eq("version", Backend.version)
            .select("version")
            .maybeSingle();
          if (!current()) return;
          if (result.error && result.error.code !== "PGRST116")
            throw result.error;
          if (result.data && !result.error) break;
          const latest = await Account.client
            .from("account_workspaces")
            .select("version")
            .eq("user_id", owner)
            .single();
          if (latest.error) throw latest.error;
          Backend.version = latest.data.version;
        }
        if (!result?.data || result.error)
          throw Error("Account changed during save");
        Backend.version = result.data.version;
      }
      if (current()) {
        Backend.status = "Changes saved.";
        backendStatus();
      }
    } catch (error) {
      if (current()) failWorkspace();
      throw error;
    } finally {
      if (current()) {
        Backend.saving = false;
        Backend.task = null;
      }
    }
  })();
  Backend.task = task;
  return task;
}
window.addEventListener("offline", () => {
  if (Account.user && Backend.ready) failWorkspace();
});
