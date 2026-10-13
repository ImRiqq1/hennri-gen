import { createMiddleware } from "hono/factory"
import { createRemoteJWKSet, jwtVerify } from "jose"
import type { AppEnv } from "../types"

// O Access já barra na borda quem não está logado; aqui é a segunda camada: toda
// requisição de /api/* (menos o webhook) precisa trazer um JWT válido do Access.
// Sem ACCESS_TEAM_DOMAIN/ACCESS_AUD configurados, nega tudo (falha fechada).

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function jwksFor(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
    jwksCache.set(teamDomain, jwks)
  }
  return jwks
}

export const requireAccess = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.path.startsWith("/api/webhooks/")) return next()

  // DEV_BYPASS_ACCESS só existe no .dev.vars (wrangler dev). Não dá pra checar o host:
  // o wrangler dev reescreve a URL pro host da rota (gen.hennri.com). Nunca criar esse
  // secret em produção — e mesmo se criassem, o Access na borda continua barrando.
  if (c.env.DEV_BYPASS_ACCESS === "1") return next()

  const { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud } = c.env
  if (!team || !aud) {
    return c.json({ error: "Access não configurado no Worker" }, 503)
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion")
  if (!token) return c.json({ error: "não autenticado" }, 401)

  try {
    await jwtVerify(token, jwksFor(team), { issuer: `https://${team}`, audience: aud })
  } catch {
    return c.json({ error: "token do Access inválido" }, 401)
  }
  return next()
})
