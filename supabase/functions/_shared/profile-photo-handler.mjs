import { createHash } from "node:crypto";
import { authenticate } from "./photo-auth.mjs";
import { PhotoError, normalizePhoto } from "./profile-image.mjs";
import { createPhotoStore } from "./profile-photo-store.mjs";
import { importLinkedIn } from "./linkedin-import.mjs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function handlerFor({
  auth = authenticate,
  storeFactory = createPhotoStore,
  fetcher = fetch,
} = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "POST", "DELETE"].includes(req.method))
      return res.status(405).json({ error: "Method not allowed." });
    const identity = await auth(req);
    if (identity.status)
      return res
        .status(identity.status)
        .json({
          error:
            identity.status === 401
              ? "Log in to manage profile photos."
              : "Your session could not be verified.",
        });
    if (!uuid.test(identity.user.id))
      return res.status(401).json({ error: "Your session is invalid." });
    try {
      const store = storeFactory(),
        user = identity.user;
      if (req.method === "GET") {
        const id = req.query?.userId || user.id;
        if (typeof id !== "string" || !uuid.test(id))
          throw new PhotoError("Choose a valid member.");
        return res.status(200).json(await store.describe(id));
      }
      if (req.method === "DELETE") {
        const result = await store.remove(user.id, {
          account: req.query?.account === "true",
        });
        return res.status(200).json(result);
      }
      let body = req.body;
      if (typeof body === "string") {
        if (body.length > 4096)
          throw new PhotoError("Photo request is too large.", 413);
        try {
          body = JSON.parse(body);
        } catch {
          throw new PhotoError("Invalid photo request.");
        }
      }
      if (!body || JSON.stringify(body).length > 4096)
        throw new PhotoError("Invalid photo request.");
      if (body.action === "import")
        return res
          .status(200)
          .json(
            await importLinkedIn({
              user,
              authorization: identity.authorization,
              consent: body.consent === true,
              store,
              fetcher,
            }),
          );
      if (body.action !== "upload")
        throw new PhotoError("Choose a valid photo action.");
      if (
        typeof body.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/.test(body.sha256) ||
        typeof body.filename !== "string" ||
        body.filename.length > 255
      )
        throw new PhotoError("Choose a valid PNG or JPEG file.");
      await store.consume(identity.authorization, "process");
      try {
        const downloaded = await store.staged(user.id);
        if (
          createHash("sha256").update(downloaded.bytes).digest("hex") !==
          body.sha256
        )
          throw new PhotoError(
            "The upload changed before processing. Please choose the file again.",
          );
        const image = await normalizePhoto(downloaded.bytes, {
          filename: body.filename,
          mime: downloaded.mime,
        });
        await store.save(user.id, image, "upload");
        await store.clearStaging(user.id);
        return res.status(200).json(await store.describe(user.id));
      } finally {
        await store.clearStaging(user.id).catch(() => {});
      }
    } catch (error) {
      return res
        .status(error instanceof PhotoError ? error.status : 503)
        .json({
          error:
            error instanceof PhotoError
              ? error.message
              : "The profile photo service is temporarily unavailable.",
        });
    }
  };
}
export { handlerFor };
