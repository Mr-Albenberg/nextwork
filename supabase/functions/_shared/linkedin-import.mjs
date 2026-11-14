import {
  normalizePhoto,
  linkedInData,
  downloadLinkedInPhoto,
  pictureReference,
  PhotoError,
} from "./profile-image.mjs";
const IMPORT_VERSION = 2;
async function importLinkedIn({
  user,
  authorization,
  consent = false,
  retry = false,
  store,
  fetcher = fetch,
}) {
  const details = linkedInData(user);
  if (!details) return { connected: false };
  const [photo, state] = await Promise.all([
    store.get("profile_photos", user.id),
    store.get("profile_import_state", user.id),
  ]);
  if (!consent && !state?.consented_at)
    return { connected: true, needsConsent: true, hasPhoto: Boolean(photo) };
  if (consent && !state?.consented_at)
    await store.state(user.id, { consented_at: new Date().toISOString() });
  // The SQL routine locks the workspace row and fills only blank name/email fields.
  const fields = await store.fill(user.id, {
    name: details.name,
    email: details.email,
    tagline: details.tagline,
    bio: details.bio,
  });
  const result = { connected: true, needsConsent: false, ...fields };
  if (photo || state?.photo_removed) {
    await store.state(user.id, {
      import_version: IMPORT_VERSION,
      completed_at: new Date().toISOString(),
    });
    return { ...result, ...(await store.describe(user.id)) };
  }
  if (!details.picture) {
    await store.state(user.id, {
      import_version: IMPORT_VERSION,
      completed_at: new Date().toISOString(),
    });
    return { ...result, hasPhoto: false, photoError: "LinkedIn did not provide a photo. Log in with LinkedIn again to refresh its details, or upload a photo." };
  }
  const reference = pictureReference(details.picture),
    recent =
      state?.attempted_at &&
      Date.now() - Date.parse(state.attempted_at) < 86400000;
  if (!retry && recent && state.picture_ref === reference && state.import_version >= IMPORT_VERSION)
    return { ...result, hasPhoto: false, photoError: "The last LinkedIn photo import did not finish. You can retry the import or upload a photo." };
  await store.consume(authorization, "import");
  await store.state(user.id, {
    attempted_at: new Date().toISOString(),
    import_version: IMPORT_VERSION,
    picture_ref: reference,
  });
  try {
    const downloaded = await downloadLinkedInPhoto(details.picture, fetcher);
    const image = await normalizePhoto(downloaded.bytes, {
      source: "linkedin",
      mime: downloaded.mime,
    });
    // Compare-and-insert keeps a photo uploaded in another tab while this import was downloading.
    await store.save(user.id, image, "linkedin", { onlyIfMissing: true });
    await store.state(user.id, {
      import_version: IMPORT_VERSION,
      completed_at: new Date().toISOString(),
    });
    return { ...result, ...(await store.describe(user.id)) };
  } catch (error) {
    const current = await store
      .describe(user.id)
      .catch(() => ({ hasPhoto: false }));
    return {
      ...result,
      ...current,
      photoError: current.hasPhoto
        ? null
        : error instanceof PhotoError
          ? error.message
          : "LinkedIn’s photo could not be imported. You can upload a photo instead.",
    };
  }
}
export { IMPORT_VERSION, importLinkedIn };
