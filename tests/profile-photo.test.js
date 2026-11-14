const assert = require("node:assert/strict");
const sharp = require("sharp");
const { createHash } = require("node:crypto");
let normalizePhoto, PhotoError, MAX_BYTES, linkedInData, linkedInPhotoURL, downloadLinkedInPhoto, readImageResponse, importLinkedIn, handlerFor, createPhotoStore;
const id = "00000000-0000-0000-0000-000000000001";
const user = {
  id,
  email: "member@example.com",
  user_metadata: { picture: "http://169.254.169.254/metadata" },
  identities: [
    {
      provider: "linkedin_oidc",
      identity_data: {
        full_name: "LinkedIn Member",
        email: "member@example.com",
        picture:
          "https://media.licdn.com/dms/image/test/profile-displayphoto-shrink_100_100/0/?t=provider-signature",
      },
    },
  ],
};
const image = (width, height, format = "jpeg") =>
  sharp({ create: { width, height, channels: 3, background: "#3564a4" } })
    [format]()
    .toBuffer();
function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
function fakeStore() {
  let photo = null,
    state = null,
    profile = { name: "", email: "", skills: "React" },
    writes = 0,
    version = 1;
  const store = {
    async get(table) {
      return table === "profile_photos" ? photo : state;
    },
    async state(_id, patch) {
      state = { ...state, ...patch };
    },
    async consume() {},
    async fill(_id, fields) {
      for (const key of ["name", "email"])
        if (!String(profile[key] || "").trim() && fields[key]) {
          profile[key] = fields[key];
          version++;
        }
      return { profile: { ...profile }, version };
    },
    async describe() {
      return photo
        ? {
            hasPhoto: true,
            url: "https://zkoqafidgromlbvczwzy.supabase.co/storage/v1/object/sign/profile-photos/test?token=test",
            expiresAt: Date.now() + 300000,
          }
        : { hasPhoto: false };
    },
    async save(_id, bytes, source) {
      writes++;
      photo = { object_path: id + "/photo.jpg", source, ...bytes };
    },
    async cleanup() {},
    async clearStaging() {},
    async remove() {
      photo = null;
      return { hasPhoto: false };
    },
    setPhoto(v) {
      photo = v;
    },
    setState(v) {
      state = v;
    },
    setProfile(v) {
      profile = v;
    },
    get writes() {
      return writes;
    },
    get profile() {
      return profile;
    },
    async staged() {
      return { bytes: jpeg, mime: "image/jpeg" };
    },
  };
  return store;
}
let jpeg;
(async () => {
  ({ normalizePhoto, PhotoError, MAX_BYTES, linkedInData, linkedInPhotoURL, downloadLinkedInPhoto, readImageResponse } = await import("../supabase/functions/_shared/profile-image.mjs"));
  ({ importLinkedIn } = await import("../supabase/functions/_shared/linkedin-import.mjs"));
  ({ handlerFor } = await import("../supabase/functions/_shared/profile-photo-handler.mjs"));
  ({ createPhotoStore } = await import("../supabase/functions/_shared/profile-photo-store.mjs"));
  jpeg = await image(400, 400);
  const png = await image(800, 600, "png");
  const normalized = await normalizePhoto(png, {
    filename: "photo.png",
    mime: "image/png",
  });
  assert.equal(normalized.mime, "image/jpeg");
  assert.equal(normalized.width, 512);
  assert.equal(normalized.height, 512);
  assert.equal((await sharp(normalized.bytes).metadata()).format, "jpeg");
  const meta = await sharp(jpeg)
    .withExif({ IFD0: { Artist: "private metadata marker" } })
    .toBuffer();
  const stripped = await normalizePhoto(meta);
  assert.equal((await sharp(stripped.bytes).metadata()).exif, undefined);
  assert(!stripped.bytes.includes(Buffer.from("private metadata marker")));
  for (const [bytes, options] of [
    [Buffer.from('<svg onload="alert(1)"/>'), {}],
    [Buffer.from("GIF89a"), {}],
    [png.subarray(0, png.length - 5), {}],
    [jpeg.subarray(0, jpeg.length - 10), {}],
    [Buffer.concat([png, Buffer.from("<script>payload</script>")]), {}],
    [jpeg, { mime: "image/png" }],
    [png, { filename: "fake.jpg" }],
    [Buffer.from([255, 216, 255, 0]), {}],
  ])
    await assert.rejects(() => normalizePhoto(bytes, options), PhotoError);
  await assert.rejects(
    () => normalizePhoto(Buffer.alloc(MAX_BYTES + 1)),
    (e) => e.status === 413,
  );
  const tiny = await image(100, 100);
  await assert.rejects(() => normalizePhoto(tiny), /400/);
  const thumbnail = await normalizePhoto(tiny, { source: "linkedin" });
  assert.equal(thumbnail.width, 100);
  assert.equal(thumbnail.height, 100);
  const tooWide = await image(7681, 400);
  await assert.rejects(() => normalizePhoto(tooWide), PhotoError);
  const tooTall = await image(400, 4321);
  await assert.rejects(() => normalizePhoto(tooTall), PhotoError);
  const maximum = await normalizePhoto(await image(7680, 4320));
  assert.equal(maximum.width, 512);
  // APNG animation is rejected even if an image decoder would expose only its first frame.
  const animation = Buffer.alloc(20);
  animation.writeUInt32BE(8, 0);
  animation.write("acTL", 4);
  const apng = Buffer.concat([
    png.subarray(0, png.length - 12),
    animation,
    png.subarray(png.length - 12),
  ]);
  await assert.rejects(() => normalizePhoto(apng), /Animated/);
  assert.equal(
    linkedInData(user).picture,
    user.identities[0].identity_data.picture,
  );
  assert.equal(linkedInData({ ...user, identities: [] }), null);
  const enriched = {...user, identities:[{provider:'linkedin_oidc',identity_data:{headline:'Developer',summary:'Building accessible tools'}}]};
  assert.equal(linkedInData(enriched).tagline,'Developer');
  assert.equal(linkedInData(enriched).bio,'Building accessible tools');
  assert.equal(linkedInData(user).tagline,'');
  const fieldsStore = fakeStore();
  fieldsStore.fill = async (id,fields) => {assert.equal(fields.tagline,'Developer');assert.equal(fields.bio,'Building accessible tools');return {profile:fields};};
  await importLinkedIn({user:enriched,consent:true,authorization:'Bearer member',store:fieldsStore});
  for (const value of [
    "http://media.licdn.com/dms/image/x",
    "https://media.licdn.com.evil.example/dms/image/x",
    "https://127.0.0.1/dms/image/x",
    "https://user:pass@media.licdn.com/dms/image/x",
    "https://media.licdn.com:444/dms/image/x",
    "https://media.licdn.com/admin",
    "javascript:alert(1)",
  ])
    assert.throws(() => linkedInPhotoURL(value));
  let fetches = 0;
  await assert.rejects(
    () =>
      downloadLinkedInPhoto(
        user.identities[0].identity_data.picture,
        async (_url, opts) => {
          fetches++;
          assert.equal(opts.redirect, "manual");
          return new Response(null, {
            status: 302,
            headers: { Location: "http://169.254.169.254" },
          });
        },
      ),
    /changed/,
  );
  assert.equal(fetches, 1);
  let cancelled = false;
  await assert.rejects(
    () =>
      readImageResponse(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(MAX_BYTES));
              c.enqueue(new Uint8Array(1));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "Content-Type": "image/jpeg" } },
        ),
      ),
    (e) => e.status === 413,
  );
  assert(cancelled);
  let store = fakeStore(),
    downloads = 0;
  const fetcher = async (url) => {
    downloads++;
    assert.equal(url, user.identities[0].identity_data.picture);
    return new Response(tiny, { headers: { "Content-Type": "image/jpeg" } });
  };
  let result = await importLinkedIn({
    user,
    authorization: "Bearer member",
    store,
    fetcher,
  });
  assert(result.needsConsent);
  assert.equal(store.writes, 0);
  result = await importLinkedIn({
    user,
    authorization: "Bearer member",
    consent: true,
    store,
    fetcher,
  });
  assert(result.hasPhoto);
  assert.equal(store.profile.name, "LinkedIn Member");
  assert.equal(store.writes, 1);
  assert.equal(downloads, 1);
  await importLinkedIn({
    user,
    authorization: "Bearer member",
    store,
    fetcher,
  });
  assert.equal(store.writes, 1);
  assert.equal(downloads, 1);
  store = fakeStore();
  store.setProfile({ name: "My chosen name", email: "my-contact@example.com" });
  store.setPhoto({ object_path: id + "/manual.jpg", source: "upload" });
  await importLinkedIn({
    user,
    authorization: "Bearer member",
    consent: true,
    store,
    fetcher,
  });
  assert.equal(store.profile.name, "My chosen name");
  assert.equal(store.profile.email, "my-contact@example.com");
  assert.equal(store.writes, 0);
  store = fakeStore();
  store.setState({
    photo_removed: true,
    consented_at: new Date().toISOString(),
  });
  await importLinkedIn({
    user,
    authorization: "Bearer member",
    store,
    fetcher,
  });
  assert.equal(store.writes, 0);
  store = fakeStore();
  result = await importLinkedIn({
    user,
    authorization: "Bearer member",
    consent: true,
    store,
    fetcher: async () => new Response(null, { status: 403 }),
  });
  assert(result.photoError);
  assert.equal(store.profile.name, "LinkedIn Member");
  assert.equal(store.writes, 0);
  const auth = async () => ({ user, authorization: "Bearer member" });
  let res = response();
  await handlerFor({
    auth: async () => ({ status: 401 }),
    storeFactory: () => {
      throw Error("must not run");
    },
  })({ method: "POST", headers: {}, body: { action: "upload" } }, res);
  assert.equal(res.statusCode, 401);
  store = fakeStore();
  res = response();
  await handlerFor({ auth, storeFactory: () => store })(
    {
      method: "POST",
      body: {
        action: "upload",
        filename: "photo.jpg",
        sha256: "0".repeat(64),
        userId: "another-user",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.equal(store.writes, 0);
  let savedFor;
  store = fakeStore();
  const save = store.save;
  store.save = (owner, ...args) => {
    savedFor = owner;
    return save(owner, ...args);
  };
  res = response();
  await handlerFor({ auth, storeFactory: () => store })(
    {
      method: "POST",
      body: {
        action: "upload",
        filename: "photo.jpg",
        sha256: createHash("sha256").update(jpeg).digest("hex"),
        userId: "someone-else",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(savedFor, id);
  res = response();
  await handlerFor({
    auth,
    storeFactory: () => {
      throw Error("server secret must never be returned");
    },
  })({ method: "GET", query: {} }, res);
  assert.equal(res.statusCode, 503);
  assert(!JSON.stringify(res.body).includes("server secret"));
  for (const signedURL of [
    "/object/sign/profile-photos/test.jpg?token=test",
    "/storage/v1/object/sign/profile-photos/test.jpg?token=test",
  ]) {
    const client = createPhotoStore({
      key: "test-server-only",
      fetcher: async (url, opts) => {
        assert.equal(opts.headers.apikey, "test-server-only");
        return new Response(
          JSON.stringify(
            url.includes("/rest/v1/")
              ? [
                  {
                    object_path: "test.jpg",
                    source: "upload",
                    width: 400,
                    height: 400,
                  },
                ]
              : { signedURL },
          ),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    });
    assert(
      (await client.describe(id)).url.startsWith(
        "https://zkoqafidgromlbvczwzy.supabase.co/storage/v1/object/sign/profile-photos/",
      ),
    );
  }
  console.log(
    "Image decoding, format/dimension/byte limits, metadata stripping, thumbnails, SSRF/redirect rejection, import backfill, non-overwrite, removal suppression, failed imports, ownership and secret isolation passed.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
