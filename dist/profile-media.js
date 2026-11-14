const ProfileMedia = {
  owner: null,
  generation: 0,
  photos: new Map(),
  requests: new Map(),
  error: "",
  importError: "",
  importing: false,
  needsConsent: false,
  revision: 0,
  preview: null,
  file: null,
  sha256: null,
};
function resetProfileMedia() {
  ProfileMedia.generation++;
  ProfileMedia.revision++;
  ProfileMedia.owner = null;
  ProfileMedia.photos.clear();
  ProfileMedia.requests.clear();
  ProfileMedia.error = "";
  ProfileMedia.importError = "";
  ProfileMedia.importing = false;
  ProfileMedia.needsConsent = false;
  closePhotoPreview();
}
function markLinkedInConsent() {
  sessionStorage.setItem("nextwork-linkedin-consent", String(Date.now()));
}
function hasLinkedInConsent() {
  const at = Number(sessionStorage.getItem("nextwork-linkedin-consent") || 0);
  return at > 0 && Date.now() - at < 3600000;
}
function photoConsentText() {
  return "By continuing, you allow Nextwork to store your LinkedIn name, email, available headline and description, and profile photo and fill missing profile details if LinkedIn is connected. Your photo is visible to signed-in Nextwork members. You can edit or remove these details.";
}
async function photoRequest(
  method = "GET",
  body = null,
  target = null,
  account = false,
) {
  const session = (await Account.client.auth.getSession()).data.session;
  if (!session) throw Error("Log in to manage your profile photo.");
  const url = new URL(NEXTWORK_SUPABASE_URL + "/functions/v1/profile-photo");
  if (target) url.searchParams.set("userId", target);
  if (account) url.searchParams.set("account", "true");
  const response = await fetch(url.href, {
    method,
    headers: {
      Authorization: "Bearer " + session.access_token,
      apikey: NEXTWORK_SUPABASE_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(
      data.error || "Your photo could not be loaded. Please try again.",
    );
  return data;
}
function validPhotoURL(value) {
  try {
    const url = new URL(value);
    return (
      url.origin === NEXTWORK_SUPABASE_URL &&
      url.pathname.startsWith("/storage/v1/object/sign/profile-photos/")
    );
  } catch {
    return false;
  }
}
function ownPhoto() {
  return ProfileMedia.photos.get(Account.user?.id) || { hasPhoto: false };
}
function canRetryLinkedInImport() {
  if (typeof Account === "undefined") return false;
  return Boolean(Account.user?.identities?.some(identity => identity.provider === "linkedin_oidc") &&
    !ownPhoto().hasPhoto && (ProfileMedia.needsConsent || ProfileMedia.importError));
}
function updatePhotoStatus() {
  document
    .querySelectorAll("[data-photo-consent]")
    .forEach((node) => (node.hidden = !ProfileMedia.needsConsent));
  document
    .querySelectorAll("[data-photo-status]")
    .forEach(
      (node) =>
        (node.textContent =
          ProfileMedia.importing ? "Importing your LinkedIn details…" : ProfileMedia.importError || ProfileMedia.error || "Visible to signed-in Nextwork members."),
    );
  document
    .querySelectorAll('[data-photo-action="remove"]')
    .forEach((node) => (node.hidden = !ownPhoto().hasPhoto));
  document
    .querySelectorAll('[data-photo-action="import"]')
    .forEach(node => {
      node.hidden = !canRetryLinkedInImport();
      node.disabled = ProfileMedia.importing;
      node.textContent = ProfileMedia.importing ? "Importing…" : ProfileMedia.needsConsent ? "Fill missing details from LinkedIn" : "Retry LinkedIn import";
    });
}
function paintProfilePhotos() {
  if (typeof Account === "undefined" || !Account.user) return;
  document
    .querySelectorAll(
      ".avatar,.landing-account-avatar,[data-own-photo],[data-member-id]",
    )
    .forEach((node) => {
      const id = node.dataset.memberId || Account.user.id,
        photo = ProfileMedia.photos.get(id);
      if (id === Account.user.id && typeof isOrganizationAccount === "function" && isOrganizationAccount()) return;
      if (
        photo?.hasPhoto &&
        validPhotoURL(photo.url) &&
        photo.expiresAt > Date.now()
      ) {
        if (node.querySelector("img")?.src === photo.url) return;
        const img = document.createElement("img");
        img.src = photo.url;
        img.alt =
          id === Account.user.id
            ? "Your profile photo"
            : "Member profile photo";
        img.referrerPolicy = "no-referrer";
        img.decoding = "async";
        img.onerror = () => {
          node.replaceChildren(
            document.createTextNode(
              id === Account.user?.id
                ? profileInitials(graduateProfile().name)
                : "?",
            ),
          );
        };
        node.replaceChildren(img);
      } else if (!node.querySelector("img")) {
        if (id === Account.user.id)
          node.textContent = profileInitials(graduateProfile().name);
        if (!photo || photo.expiresAt < Date.now())
          loadProfilePhoto(id).catch(() => {});
      }
    });
  updatePhotoStatus();
}
async function loadProfilePhoto(id = Account.user?.id) {
  if (!id || !Account.user) return;
  if (ProfileMedia.requests.has(id)) return ProfileMedia.requests.get(id);
  const generation = ProfileMedia.generation,
    revision = ProfileMedia.revision;
  const task = (async () => {
    try {
      const data = await photoRequest("GET", null, id);
      if (
        generation !== ProfileMedia.generation ||
        (id === Account.user?.id && revision !== ProfileMedia.revision)
      )
        return;
      ProfileMedia.photos.set(id, {
        ...data,
        expiresAt: data.expiresAt || Date.now() + 60000,
      });
      if (id === Account.user?.id) ProfileMedia.error = "";
      paintProfilePhotos();
    } catch (error) {
      if (
        generation === ProfileMedia.generation &&
        (id !== Account.user?.id || revision === ProfileMedia.revision)
      ) {
        ProfileMedia.photos.set(id, {
          hasPhoto: false,
          expiresAt: Date.now() + 60000,
        });
        if (id === Account.user?.id) ProfileMedia.error = error.message;
        updatePhotoStatus();
      }
    } finally {
      if (ProfileMedia.requests.get(id) === task)
        ProfileMedia.requests.delete(id);
    }
  })();
  ProfileMedia.requests.set(id, task);
  return task;
}
function applyImportedFields(data) {
  if (!data.profile) return;
  const current = graduateProfile();
  let changed = false;
  for (const key of ["name", "email", "tagline", "bio"])
    if (!String(current[key] || "").trim() && data.profile[key]) {
      current[key] = data.profile[key];
      changed = true;
      const field = document.querySelector(
        '#profile-form [name="' + key + '"]',
      );
      if (field && !field.value.trim()) field.value = current[key];
    }
  if (changed) {
    const needSave =
      Backend.saving ||
      Backend.pending.has("profile") ||
      Backend.version > Number(data.version || 0);
    Backend.loading = !needSave;
    workspaceLocal.setItem("proof-profile", JSON.stringify(current));
    Backend.loading = false;
  }
  if (!Backend.pending.size && !Backend.saving && data.version)
    Backend.version = Math.max(Backend.version, Number(data.version));
}
async function fillMissingFromLinkedIn({
  consent = hasLinkedInConsent(),
  retry = false,
} = {}) {
  if (ProfileMedia.importing) return;
  if (
    !Account.user?.identities?.some(
      (identity) => identity.provider === "linkedin_oidc",
    )
  )
    return;
  const owner = Account.user.id,
    generation = ProfileMedia.generation,
    revision = ProfileMedia.revision;
  ProfileMedia.importing = true;
  ProfileMedia.importError = "";
  updatePhotoStatus();
  try {
    const data = await photoRequest("POST", { action: "import", consent, retry });
    if (generation !== ProfileMedia.generation || owner !== Account.user?.id)
      return;
    sessionStorage.removeItem("nextwork-linkedin-consent");
    ProfileMedia.needsConsent = Boolean(data.needsConsent);
    applyImportedFields(data);
    if (data.hasPhoto !== undefined && revision === ProfileMedia.revision) {
      ProfileMedia.revision++;
      ProfileMedia.photos.set(owner, {
        ...data,
        expiresAt: data.expiresAt || Date.now() + 60000,
      });
    }
    ProfileMedia.importError = data.photoError || "";
    refreshProfileIdentity();
    updatePhotoStatus();
  } catch (error) {
    if (generation === ProfileMedia.generation) {
      ProfileMedia.importError = error.message;
      updatePhotoStatus();
    }
  } finally {
    if (generation === ProfileMedia.generation) {
      ProfileMedia.importing = false;
      updatePhotoStatus();
    }
  }
}
function initializeProfileMedia(user) {
  resetProfileMedia();
  if (!user) return;
  ProfileMedia.owner = user.id;
  if (
    !user.identities?.some((identity) => identity.provider === "linkedin_oidc")
  )
    sessionStorage.removeItem("nextwork-linkedin-consent");
  loadProfilePhoto(user.id).catch(() => {});
  fillMissingFromLinkedIn().catch(() => {});
}
function profilePhotoEditor(p) {
  return `<div class="profile-photo-editor"><button type="button" class="profile-photo-trigger" data-photo-action="open" aria-label="Change profile photo"><span class="profile-photo-current" data-own-photo>${profileInitials(p.name)}</span><span class="photo-camera" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/></svg></span></button><div class="profile-photo-controls"><button type="button" class="account-text-button" data-photo-action="open">Change photo</button><button type="button" class="account-text-button" data-photo-action="remove" ${ownPhoto().hasPhoto ? "" : "hidden"}>Remove photo</button><p data-photo-status role="status">Visible to signed-in Nextwork members.</p><small class="linkedin-data-consent" data-photo-consent ${ProfileMedia.needsConsent ? "" : "hidden"}>${photoConsentText()}</small><button type="button" class="account-text-button" data-photo-action="import" ${canRetryLinkedInImport() ? "" : "hidden"}>Fill missing details from LinkedIn</button></div></div>`;
}
function closePhotoPreview() {
  if (ProfileMedia.preview) URL.revokeObjectURL(ProfileMedia.preview);
  ProfileMedia.preview = null;
  ProfileMedia.file = null;
  ProfileMedia.sha256 = null;
}
function imageDimensions(bytes) {
  const data = new DataView(bytes);
  if (
    data.byteLength >= 24 &&
    data.getUint32(0) === 0x89504e47 &&
    data.getUint32(4) === 0x0d0a1a0a
  )
    return { width: data.getUint32(16), height: data.getUint32(20) };
  if (data.byteLength < 4 || data.getUint16(0) !== 0xffd8)
    throw Error("Choose a valid PNG or JPEG image.");
  let offset = 2;
  while (offset + 4 < data.byteLength) {
    if (data.getUint8(offset++) !== 0xff) throw Error("This JPEG is damaged.");
    let marker = data.getUint8(offset++);
    while (marker === 0xff) marker = data.getUint8(offset++);
    if (marker === 0xd9 || marker === 0xda) break;
    const size = data.getUint16(offset);
    if (size < 2 || offset + size > data.byteLength)
      throw Error("This JPEG is damaged.");
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker) &&
      size >= 8
    )
      return {
        height: data.getUint16(offset + 3),
        width: data.getUint16(offset + 5),
      };
    offset += size;
  }
  throw Error("The image dimensions could not be read.");
}
async function preparePhotoUpload(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    if (width < 400 || height < 400 || width > 7680 || height > 4320)
      throw Error("Use a photo between 400 × 400 and 7680 × 4320 pixels after rotation.");
    const side = Math.min(width, height), target = Math.min(512, side);
    const canvas = document.createElement('canvas');canvas.width = canvas.height = target;
    const context = canvas.getContext('2d');
    if (!context) throw Error("Your browser could not prepare this photo.");
    context.fillStyle = '#ffffff';context.fillRect(0,0,target,target);
    context.drawImage(image,(width-side)/2,(height-side)/2,side,side,0,0,target,target);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.85));
    if (!blob) throw Error("Your browser could not prepare this photo.");
    return new File([blob], 'profile-photo.jpg', {type:'image/jpeg'});
  } finally { URL.revokeObjectURL(url); }
}
function openPhotoEditor() {
  if (!requireAccount()) return;
  closePhotoPreview();
  const modal = document.querySelector("#modal");
  modal.hidden = false;
  modal.innerHTML = `<div class="dialog photo-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-heading"><button class="close" onclick="closeModal()" aria-label="Close">×</button><span class="account-eyebrow">YOUR PROFILE</span><h2 id="photo-heading">Choose your profile photo</h2><p>Visible to signed-in Nextwork members.</p><div class="photo-preview" id="photo-preview">${profileInitials(graduateProfile().name)}</div><form id="photo-upload-form"><label class="photo-file-label" for="photo-file">Choose a PNG or JPEG<input id="photo-file" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" required></label><p class="photo-requirements">Up to 8 MB · at least 400 × 400 · no larger than 7680 × 4320 pixels. Photos are cropped to a square. Official LinkedIn thumbnails may be smaller.</p><p id="photo-upload-error" class="review-error" role="alert"></p><div class="dialog-actions"><button type="button" class="account-button" onclick="closeModal()">Cancel</button><button id="photo-save" class="auth-submit" type="submit" disabled>Save photo</button></div></form></div>`;
  modal.querySelector(".close").focus();
  const input = document.querySelector("#photo-file"),
    save = document.querySelector("#photo-save"),
    errorNode = document.querySelector("#photo-upload-error");
  input.onchange = async () => {
    closePhotoPreview();
    save.disabled = true;
    errorNode.textContent = "";
    try {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024)
        throw Error("Photos must be 8 MB or smaller.");
      const extension = file.name.split(".").pop().toLowerCase();
      if (
        !["png", "jpg", "jpeg"].includes(extension) ||
        (file.type && !["image/png", "image/jpeg"].includes(file.type))
      )
        throw Error("Choose a PNG or JPEG file.");
      const bytes = await file.arrayBuffer(),
        size = imageDimensions(bytes);
      if (
        size.width < 400 ||
        size.height < 400 ||
        size.width > 7680 ||
        size.height > 7680 ||
        size.width * size.height > 7680 * 4320
      )
        throw Error("Use a photo between 400 × 400 and 7680 × 4320 pixels.");
      const isPNG = new Uint8Array(bytes)[0] === 137;
      if ((extension === 'png') !== isPNG || (file.type && file.type !== (isPNG ? 'image/png' : 'image/jpeg')))
        throw Error("The file type does not match its image contents.");
      const prepared = await preparePhotoUpload(file);
      const digest = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", await prepared.arrayBuffer())),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (!input.isConnected || input.files[0] !== file) return;
      ProfileMedia.sha256 = digest;
      ProfileMedia.file = prepared;
      ProfileMedia.preview = URL.createObjectURL(prepared);
      const image = document.createElement("img");
      image.src = ProfileMedia.preview;
      image.alt = "Your selected photo preview";
      document.querySelector("#photo-preview").replaceChildren(image);
      save.disabled = false;
    } catch (error) {
      errorNode.textContent = error.message;
    }
  };
  document.querySelector("#photo-upload-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!ProfileMedia.file) return;
    save.disabled = true;
    input.disabled = true;
    save.textContent = "Saving photo…";
    const owner = Account.user.id,
      generation = ProfileMedia.generation,
      file = ProfileMedia.file,
      sha256 = ProfileMedia.sha256;
    try {
      const mime =
        file.type ||
        (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      const result = await Account.client.storage
        .from("profile-photo-staging")
        .upload(owner + "/pending", file, {
          contentType: mime,
          upsert: true,
          cacheControl: "0",
        });
      if (result.error)
        throw Error("The photo could not be uploaded. Please try again.");
      const photo = await photoRequest("POST", {
        action: "upload",
        filename: file.name,
        sha256,
      });
      if (owner !== Account.user?.id || generation !== ProfileMedia.generation)
        return;
      ProfileMedia.revision++;
      ProfileMedia.photos.set(owner, photo);
      ProfileMedia.error = "";
      ProfileMedia.importError = "";
      closeModal();
      paintProfilePhotos();
      toast("Profile photo updated");
    } catch (error) {
      await Account.client.storage
        .from("profile-photo-staging")
        .remove([owner + "/pending"])
        .catch(() => {});
      errorNode.textContent = error.message;
      save.disabled = false;
      input.disabled = false;
      save.textContent = "Save photo";
    }
  };
}
function bindProfileMedia() {
  document.querySelectorAll("[data-photo-action]").forEach(
    (button) =>
      (button.onclick = async () => {
        const action = button.dataset.photoAction;
        if (action === "open") return openPhotoEditor();
        button.disabled = true;
        try {
          if (action === "remove") {
            const data = await photoRequest("DELETE");
            ProfileMedia.revision++;
            ProfileMedia.photos.set(Account.user.id, {
              ...data,
              expiresAt: Date.now() + 60000,
            });
            ProfileMedia.error = "";
            ProfileMedia.importError = "";
            document
              .querySelectorAll(
                ".avatar,.landing-account-avatar,[data-own-photo]",
              )
              .forEach(
                (node) =>
                  (node.textContent = profileInitials(graduateProfile().name)),
              );
            paintProfilePhotos();
            toast("Profile photo removed");
          }
          if (action === "import") {
            markLinkedInConsent();
            await fillMissingFromLinkedIn({ consent: true, retry: true });
            updatePhotoStatus();
          }
        } catch (error) {
          ProfileMedia.error = error.message;
          updatePhotoStatus();
        } finally {
          button.disabled = false;
        }
      }),
  );
  paintProfilePhotos();
}

function memberPhotoAvatar(userId, name) {
  return `<span class="member-photo-avatar" data-member-id="${esc(userId)}" aria-label="${esc(name || "Member")}">${profileInitials(name)}</span>`;
}

let profilePhotoPaintQueued = false;
function scheduleProfilePhotoPaint() {
  if (profilePhotoPaintQueued) return;
  profilePhotoPaintQueued = true;
  Promise.resolve().then(() => { profilePhotoPaintQueued = false; paintProfilePhotos(); });
}
