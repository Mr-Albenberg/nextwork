// Public project identifier/key. Privileged Supabase and LinkedIn credentials are never needed here.
const projectURL = "https://zkoqafidgromlbvczwzy.supabase.co";
const publishableKey = "sb_publishable_PdLwKMARqX1Lxxp3XAuhbQ_F0T2-Kye";
async function authenticate(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(header)) return { status: 401 };
  try {
    const response = await fetch(projectURL + "/auth/v1/user", {
      headers: { apikey: publishableKey, Authorization: header },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      return {
        status: response.status === 401 || response.status === 403 ? 401 : 503,
      };
    const user = await response.json();
    if (!user.id || user.is_anonymous) return { status: 401 };
    return { user, authorization: header };
  } catch {
    return { status: 503 };
  }
}
export { authenticate };
