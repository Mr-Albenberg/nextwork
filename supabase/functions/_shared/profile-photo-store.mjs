import { randomUUID } from "node:crypto";
import { PhotoError, readImageResponse } from "./profile-image.mjs";
const PROJECT = "https://zkoqafidgromlbvczwzy.supabase.co";
const PUBLIC_KEY = "sb_publishable_PdLwKMARqX1Lxxp3XAuhbQ_F0T2-Kye";
function secretKey() {
  return (
    globalThis.Deno?.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    globalThis.process?.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
function createPhotoStore({ fetcher = fetch, key = secretKey() } = {}) {
  if (!key)
    throw new PhotoError("Profile photo uploads are not available yet.", 503);
  const headers = { apikey: key, Authorization: "Bearer " + key };
  async function request(
    path,
    { method = "GET", body, extra = {}, raw = false } = {},
  ) {
    const response = await fetcher(PROJECT + path, {
      method,
      redirect: "error",
      headers: {
        ...headers,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      ...(body !== undefined
        ? { body: raw ? body : JSON.stringify(body) }
        : {}),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const failure = new PhotoError(
        ["42P01", "PGRST205", "PGRST202"].includes(error.code)
          ? "Profile photos are not available yet."
          : error.message?.includes("PHOTO_STORAGE_LIMIT") ? "Photo storage is currently full. Try again later." : "The photo service could not complete this request.",
        response.status === 404 ? 404 : 503,
      );
      failure.code = error.code;
      throw failure;
    }
    if (raw) return response;
    return response.status === 204 ? null : response.json();
  }
  const query = (table, id) =>
    "/rest/v1/" + table + "?user_id=eq." + encodeURIComponent(id);
  async function get(table, id) {
    const rows = await request(query(table, id) + "&select=*");
    return rows[0] || null;
  }
  async function state(id, patch) {
    return request("/rest/v1/profile_import_state?on_conflict=user_id", {
      method: "POST",
      body: { user_id: id, ...patch },
      extra: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  }
  async function removeObjects(bucket, paths) {
    if (paths.length)
      await request("/storage/v1/object/" + bucket, {
        method: "DELETE",
        body: { prefixes: paths },
      });
  }
  async function list(bucket, id) {
    return request("/storage/v1/object/list/" + bucket, {
      method: "POST",
      body: { prefix: id + "/", limit: 100, offset: 0 },
    });
  }
  async function cleanup(id, keep = null) {
    for (const bucket of ["profile-photos", "profile-photo-staging"]) {
      const rows = await list(bucket, id);
      await removeObjects(
        bucket,
        rows
          .filter((row) => row.id && id + "/" + row.name !== keep)
          .map((row) => id + "/" + row.name),
      );
    }
  }
  async function writePhoto(id, photo, source, { onlyIfMissing = false } = {}) {
    const previous = await get("profile_photos", id);
    if (onlyIfMissing && previous) return previous;
    const path = id + "/" + randomUUID() + ".jpg";
    await request("/storage/v1/object/profile-photos/" + path, {
      method: "POST",
      body: photo.bytes,
      raw: true,
      extra: {
        "Content-Type": "image/jpeg",
        "x-upsert": "false",
        "Cache-Control": "60",
      },
    });
    try {
      const row = {
        user_id: id,
        object_path: path,
        source,
        width: photo.width,
        height: photo.height,
        byte_size: photo.bytes.length,
        updated_at: new Date().toISOString(),
      };
      const published = await request("/rest/v1/rpc/commit_profile_photo", {
        method: "POST",
        body: { target: id, photo: row, allow_replace: !onlyIfMissing },
      });
      if (!published || published.object_path !== path) {
        await removeObjects("profile-photos", [path]);
        return published;
      }
      if (previous?.object_path && previous.object_path !== path)
        await removeObjects("profile-photos", [previous.object_path]);
      return published;
    } catch (error) {
      await removeObjects("profile-photos", [path]).catch(() => {});
      if (onlyIfMissing && error.code === "23505")
        return get("profile_photos", id);
      throw error;
    }
  }
  async function save(id, photo, source, options) {
    const lease = await request('/rest/v1/rpc/reserve_profile_photo', {method:'POST',body:{target:id}});
    try { return await writePhoto(id,photo,source,options); }
    finally { await request('/rest/v1/profile_photo_reservations?id=eq.'+encodeURIComponent(lease), {method:'DELETE'}).catch(() => {}); }
  }
  async function describe(id) {
    const photo = await get("profile_photos", id);
    if (!photo) return { hasPhoto: false };
    const result = await request(
      "/storage/v1/object/sign/profile-photos/" + photo.object_path,
      { method: "POST", body: { expiresIn: 300 } },
    );
    const signed = result.signedURL || result.signedUrl;
    const url = new URL(
      signed.startsWith("/storage/v1/")
        ? signed
        : "/storage/v1/" + signed.replace(/^\//, ""),
      PROJECT,
    );
    if (
      url.origin !== PROJECT ||
      !url.pathname.startsWith("/storage/v1/object/sign/profile-photos/")
    )
      throw new PhotoError("The photo could not be loaded.", 503);
    return {
      hasPhoto: true,
      url: url.href,
      expiresAt: Date.now() + 290000,
      source: photo.source,
      width: photo.width,
      height: photo.height,
    };
  }
  async function staged(id) {
    return readImageResponse(
      await request(
        "/storage/v1/object/authenticated/profile-photo-staging/" +
          id +
          "/pending",
        { raw: true },
      ),
    );
  }
  async function consume(authorization, action) {
    const response = await fetcher(
      PROJECT + "/rest/v1/rpc/consume_photo_action",
      {
        method: "POST",
        headers: {
          apikey: PUBLIC_KEY,
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action_name: action }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok || (await response.json()) !== true)
      throw new PhotoError(
        "Too many photo changes. Please try again later.",
        429,
      );
  }
  async function fill(id, fields) {
    return request("/rest/v1/rpc/fill_linkedin_profile", {
      method: "POST",
      body: { target: id, fields },
    });
  }
  async function remove(id, { account = false } = {}) {
    await state(id, { photo_removed: true });
    await cleanup(id);
    await request(query("profile_photos", id), { method: "DELETE" });
    return { hasPhoto: false };
  }
  return {
    get,
    state,
    save,
    describe,
    staged,
    consume,
    fill,
    remove,
    cleanup,
    clearStaging: (id) =>
      removeObjects("profile-photo-staging", [id + "/pending"]),
  };
}
export { createPhotoStore, secretKey };
