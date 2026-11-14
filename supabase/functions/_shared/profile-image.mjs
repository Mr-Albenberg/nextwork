import { Buffer } from "node:buffer";
import { initializeImageMagick, MagickImage, MagickFormat, MagickReadSettings,
  MagickImageInfo, ResourceLimits, MagickGeometry, Gravity, MagickColors, AlphaAction } from "@imagemagick/magick-wasm";
let decoderReady;
function initializeDecoder() {
  return decoderReady ||= (async () => {
    const wasm = new URL("../profile-photo/vendor/magick.wasm", import.meta.url);
    const bytes = globalThis.Deno ? await Deno.readFile(wasm) :
      await (await import("node:fs/promises")).readFile(wasm);
    await initializeImageMagick(bytes);
    // No disk spill or unbounded pixel allocations in a 256 MB Edge worker.
    ResourceLimits.memory = 96n * 1024n * 1024n;
    ResourceLimits.maxMemoryRequest = 96n * 1024n * 1024n;
    ResourceLimits.maxProfileSize = 1024n * 1024n;
    ResourceLimits.disk = 0n;
    ResourceLimits.width = 7680n;
    ResourceLimits.height = 7680n;
    ResourceLimits.listLength = 8n;
  })();
}
import { createHash } from "node:crypto";
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 7680,
  MAX_HEIGHT = 4320,
  MAX_PIXELS = MAX_WIDTH * MAX_HEIGHT;
const LINKEDIN_HOSTS = new Set(["media.licdn.com", "media.licdn-ei.com"]);
class PhotoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function imageFormat(bytes) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "jpeg";
  throw new PhotoError("Choose a valid PNG or JPEG image.");
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++)
    crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function checkPNG(bytes) {
  let offset = 8,
    ended = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset),
      type = bytes.toString("ascii", offset + 4, offset + 8);
    if (size > MAX_BYTES || offset + 12 + size > bytes.length)
      throw new PhotoError("This PNG is incomplete or damaged.");
    if (type === "acTL")
      throw new PhotoError("Animated images are not supported.");
    if (
      crc32(bytes, offset + 4, offset + 8 + size) !==
      bytes.readUInt32BE(offset + 8 + size)
    )
      throw new PhotoError("This PNG is damaged.");
    offset += 12 + size;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || offset !== bytes.length)
    throw new PhotoError("This PNG is incomplete or contains unexpected data.");
}
async function normalizePhoto(
  input,
  { source = "upload", mime = null, filename = null } = {},
) {
  const bytes = Buffer.from(input);
  if (!bytes.length) throw new PhotoError("Choose an image.");
  if (bytes.length > MAX_BYTES)
    throw new PhotoError("Photos must be 8 MB or smaller.", 413);
  const format = imageFormat(bytes),
    expected = format === "png" ? "image/png" : "image/jpeg";
  if (mime && mime.split(";")[0].trim().toLowerCase() !== expected)
    throw new PhotoError("The file type does not match its image contents.");
  if (filename) {
    const extension = String(filename).split(".").pop().toLowerCase();
    if (
      !["png", "jpg", "jpeg"].includes(extension) ||
      (extension === "png") !== (format === "png")
    )
      throw new PhotoError("Choose a PNG (.png) or JPEG (.jpg or .jpeg) file.");
  }
  if (format === "png") checkPNG(bytes);
  try {
    await initializeDecoder();
    const settings = new MagickReadSettings({ format: format === "png" ? MagickFormat.Png : MagickFormat.Jpeg });
    const info = MagickImageInfo.create(bytes, settings);
    const rotated = [5, 6, 7, 8].includes(info.orientation),
      width = rotated ? info.height : info.width,
      height = rotated ? info.width : info.height;
    const minimum = source === "linkedin" ? 1 : 400;
    if (
      !width ||
      !height ||
      width < minimum ||
      height < minimum ||
      width > MAX_WIDTH ||
      height > MAX_HEIGHT
    )
      throw new PhotoError(
        source === "linkedin"
          ? "The LinkedIn photo has unsupported dimensions."
          : "Use an image at least 400 × 400 and no larger than 7680 × 4320 pixels.",
      );
    // JPEG IDCT scaling reduces large source photos before allocating full pixels.
    settings.setDefine(MagickFormat.Jpeg, "size", "1024x1024");
    const target = Math.min(512, width, height);
    const image = MagickImage.create();
    try {
      let warning = false;
      image.onWarning = () => { warning = true; return 0; };
      image.read(bytes, settings);
      image.autoOrient();
      image.thumbnail(new MagickGeometry(`${target}x${target}^`));
      image.crop(target, target, Gravity.Center);
      image.backgroundColor = MagickColors.White;
      image.alpha(AlphaAction.Remove);
      image.strip();
      image.quality = 85;
      if (warning) throw new PhotoError("This image is damaged.");
      return image.write(MagickFormat.Jpeg, output => {
        if (warning || output.length > 1024 * 1024)
          throw new PhotoError("This image could not be safely processed.");
        return { bytes: Buffer.from(output), width: image.width, height: image.height,
          sourceWidth: width, sourceHeight: height, mime: "image/jpeg" };
      });
    } finally { image.dispose(); }
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError(
      "This image is damaged or too complex to process. Choose a smaller PNG or JPEG.",
    );
  }
}
function linkedInData(user) {
  const identity = (user.identities || []).find(
    (i) => i.provider === "linkedin_oidc",
  );
  if (!identity) return null;
  // identity_data is maintained by the OAuth provider; user_metadata is user-editable and is never trusted here.
  const data = identity.identity_data || {},
    name =
      data.full_name ||
      data.name ||
      [data.given_name, data.family_name].filter(Boolean).join(" ");
  return {
    name: typeof name === "string" ? name.trim().slice(0, 300) : "",
    email: user.email || data.email || "",
    tagline: typeof data.headline === "string" ? data.headline.trim().slice(0,300) : "",
    bio: typeof data.summary === "string" ? data.summary.trim().slice(0,2000) : "",
    picture:
      typeof data.picture === "string"
        ? data.picture
        : typeof data.avatar_url === "string"
          ? data.avatar_url
          : null,
  };
}
function linkedInPhotoURL(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new PhotoError("LinkedIn has not provided a usable photo.");
  }
  if (
    url.protocol !== "https:" ||
    !LINKEDIN_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !url.pathname.startsWith("/dms/image/")
  )
    throw new PhotoError("LinkedIn has not provided a supported photo URL.");
  return url;
}
async function readImageResponse(response) {
  if (!response.ok)
    throw new PhotoError(
      "The photo could not be downloaded. Try reconnecting LinkedIn.",
      422,
    );
  const type = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!["image/png", "image/jpeg"].includes(type))
    throw new PhotoError("Use a PNG or JPEG image.");
  if (Number(response.headers.get("content-length") || 0) > MAX_BYTES)
    throw new PhotoError("Photos must be 8 MB or smaller.", 413);
  const reader = response.body?.getReader();
  if (!reader) throw new PhotoError("The image response was empty.");
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new PhotoError("Photos must be 8 MB or smaller.", 413);
      }
      parts.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return { bytes: Buffer.concat(parts, size), mime: type };
}
async function downloadLinkedInPhoto(value, fetcher = fetch) {
  const url = linkedInPhotoURL(value);
  const response = await fetcher(url.href, {
    redirect: "manual",
    headers: { Accept: "image/jpeg, image/png" },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status >= 300 && response.status < 400)
    throw new PhotoError(
      "The LinkedIn photo address has changed. Please reconnect LinkedIn.",
      422,
    );
  return readImageResponse(response);
}
function pictureReference(value) {
  return value ? createHash("sha256").update(value).digest("hex") : null;
}
export {
  PhotoError,
  MAX_BYTES,
  normalizePhoto,
  linkedInData,
  linkedInPhotoURL,
  readImageResponse,
  downloadLinkedInPhoto,
  pictureReference,
};
