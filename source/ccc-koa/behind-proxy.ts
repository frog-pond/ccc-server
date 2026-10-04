/// The server only takes requests through the nginx in front of it, which adds
/// the address it saw to X-Forwarded-For. Koa trusts that header with `proxy`,
/// and `maxIpsCount: 1` keeps only the address nginx added: anything to its left
/// came from the client, and could say anything.
export const BEHIND_NGINX = {proxy: true, maxIpsCount: 1} as const
