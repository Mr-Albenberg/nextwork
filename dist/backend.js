// Authenticated Supabase requests run under RLS; no privileged key is used by the browser.
const Backend = {
  owner: null,
  ready: false,
  busy: false,
  status: "",
  error: "",
  conflict: false,
  timer: null,
  loading: false,
  paused: false,
  generation: 0,
};
function backendKey(name, owner = Backend.owner) {
  return "nextwork:" + owner + ":sync-" + name;
}
function backendDirty() {
  return Boolean(Backend.owner && localStorage.getItem(backendKey("dirty")));
}
function workspaceChanged(key, value) {
  if (!workspaceOwner || Backend.loading) return;
  if (
    ![
      "proof-profile",
      "lp-saved",
      "proof-applications",
      "proof-resume",
    ].includes(key)
  )
    return;
  if (key === "proof-resume")
    localStorage.setItem(
      "nextwork:" + workspaceOwner + ":proof-cloud-resume",
      value || "",
    );
  localStorage.setItem(backendKey("dirty", workspaceOwner), "true");
  if (Backend.owner === workspaceOwner) {
    Backend.status = "Changes saved on this device. Sync pending.";
    backendStatus();
    clearTimeout(Backend.timer);
    Backend.timer = setTimeout(() => syncWorkspace(), 800);
  }
}
function backendStatus() {
  const node = document.querySelector("#sync-status");
  if (node) node.textContent = Backend.error || Backend.status;
  document
    .querySelectorAll('[data-auth-action="cloud"], [data-auth-action="device"]')
    .forEach((button) => (button.hidden = !Backend.conflict));
}
function backendPanel() {
  if (!Account.user) return "";
  return `<div class="account-sync"><div class="account-sync-status">${icon("check", 16)}<p id="sync-status" role="status">${esc(Backend.error || Backend.status)}</p></div><button class="account-text-button" data-auth-action="sync">Sync now</button><div class="account-sync-conflict"><button class="account-button" data-auth-action="cloud" ${Backend.conflict ? "" : "hidden"}>Use account copy</button><button class="account-button" data-auth-action="device" ${Backend.conflict ? "" : "hidden"}>Replace account copy with this device</button></div></div>`;
}
function workspacePayload() {
  return {
    user_id: Backend.owner,
    profile: graduateProfile(),
    saved_projects: JSON.parse(workspaceLocal.getItem("lp-saved") || "[]"),
    application_drafts: JSON.parse(
      workspaceLocal.getItem("proof-applications") || "[]",
    ),
    resume:
      workspaceLocal.getItem("proof-cloud-resume") ||
      workspaceSession.getItem("proof-resume") ||
      "",
  };
}
function hydrateWorkspace(row) {
  Backend.loading = true;
  try {
    workspaceLocal.setItem("proof-profile", JSON.stringify(row.profile || {}));
    for (const key of ["name", "education", "portfolio", "bio"])
      workspaceLocal.removeItem("lp-" + key);
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
    workspaceLocal.setItem("proof-cloud-resume", row.resume || "");
    workspaceSession.setItem("proof-resume", row.resume || "");
    workspaceLocal.removeItem("lp-resume");
    localStorage.setItem(backendKey("version"), String(row.version));
    localStorage.removeItem(backendKey("dirty"));
    saved = row.saved_projects || [];
    applications = (row.application_drafts || []).map((a) => a.jobId);
    resumeReport = null;
  } finally {
    Backend.loading = false;
  }
}
function backendError(error) {
  if (["PGRST205", "42P01", "PGRST202", "42883"].includes(error?.code))
    return "Account storage is not set up yet. Changes remain on this device until the database migration is applied.";
  return "Could not sync your account. Changes are safe on this device. Check your connection and try Sync now.";
}
async function connectWorkspace(user) {
  clearTimeout(Backend.timer);
  Backend.generation++;
  Backend.busy = false;
  Backend.owner = user?.id || null;
  Backend.ready = false;
  Backend.paused = false;
  Backend.conflict = false;
  Backend.error = "";
  Backend.status = user ? "Loading account data…" : "";
  if (!user) return;
  const resume = workspaceLocal.getItem("proof-cloud-resume");
  if (resume !== null) {
    Backend.loading = true;
    workspaceSession.setItem("proof-resume", resume);
    Backend.loading = false;
  }
  await syncWorkspace(true);
}
async function syncWorkspace(initial = false, resolution = null) {
  const owner = Backend.owner;
  if (!owner || owner !== workspaceOwner || Backend.busy || Backend.paused)
    return;
  Backend.busy = true;
  const client = Account.client,
    generation = Backend.generation;
  const current = () =>
    Backend.owner === owner &&
    workspaceOwner === owner &&
    Backend.generation === generation;
  try {
    Backend.status = "Syncing your account…";
    Backend.error = "";
    backendStatus();
    const { data: remote, error } = await client
      .from("account_workspaces")
      .select("*")
      .eq("user_id", owner)
      .maybeSingle();
    if (!current()) return;
    if (error) throw error;
    const version = Number(localStorage.getItem(backendKey("version")) || 0),
      dirty = backendDirty();
    if (remote && resolution === "cloud") {
      hydrateWorkspace(remote);
    } else if (remote && !dirty) {
      hydrateWorkspace(remote);
    } else {
      if (remote && remote.version !== version && resolution !== "device") {
        Backend.conflict = true;
        Backend.status =
          "Your account changed on another device. Choose which copy to keep in Account & connections.";
        return;
      }
      const payload = workspacePayload(),
        signature = JSON.stringify(payload);
      let result;
      if (remote)
        result = await client
          .from("account_workspaces")
          .update(payload)
          .eq("user_id", owner)
          .eq("version", remote.version)
          .select("version")
          .maybeSingle();
      else
        result = await client
          .from("account_workspaces")
          .insert(payload)
          .select("version")
          .single();
      if (!current()) return;
      if (result.error) {
        if (["PGRST116", "23505"].includes(result.error.code)) {
          Backend.conflict = true;
          Backend.status =
            "Your account changed during sync. Choose which copy to keep in Account & connections.";
          return;
        }
        throw result.error;
      }
      if (!result.data) {
        Backend.conflict = true;
        Backend.status =
          "Your account changed during sync. Choose which copy to keep in Account & connections.";
        return;
      }
      localStorage.setItem(backendKey("version"), String(result.data.version));
      if (JSON.stringify(workspacePayload()) === signature)
        localStorage.removeItem(backendKey("dirty"));
    }
    Backend.conflict = false;
    Backend.ready = true;
    Backend.status = backendDirty()
      ? "Changes saved on this device. Sync pending."
      : "Your profile, saved projects, application drafts, and resume are synced.";
  } catch (error) {
    if (current()) {
      Backend.error = backendError(error);
      Backend.status = "Saved on this device.";
    }
  } finally {
    if (current()) {
      Backend.busy = false;
      backendStatus();
      if (
        Backend.ready &&
        backendDirty() &&
        !Backend.conflict &&
        !Backend.error
      ) {
        clearTimeout(Backend.timer);
        Backend.timer = setTimeout(() => syncWorkspace(), 1000);
      }
    }
  }
}
window.addEventListener("online", () => {
  if (Account.user) syncWorkspace();
});
