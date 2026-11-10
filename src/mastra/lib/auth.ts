import type { MastraAuthConfig } from '@mastra/core/server';
import { MastraJwtAuth } from '@mastra/auth';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '@mastra/server/server-adapter';

import { knowledgeOrgScope } from './knowledge';

type JwtClaims = { sub?: string; knowledge?: 'all' | string[] };
type RequestContextLike = { set(key: string, value: unknown): void };
type HonoContextLike = { get(key: 'requestContext'): RequestContextLike };

/**
 * Which Knowledge pages a signed-in user can browse in Studio's Knowledge
 * explorer. A `knowledge` claim on the JWT wins (`"all"` for an admin, or a list
 * of scope addresses); otherwise the user sees the org scope and their own
 * `resource:<sub>` pages, the same pages the agent can read for them.
 */
export function knowledgePrincipalsFor(claims: JwtClaims): 'all' | string[] {
  if (claims.knowledge) return claims.knowledge;
  return claims.sub ? [knowledgeOrgScope, `resource:${claims.sub}`] : [knowledgeOrgScope];
}

/**
 * JWT auth for every /api/* route and Studio, used when MASTRA_JWT_SECRET is set.
 * Any valid token is let through, as with plain MastraJwtAuth. The one addition
 * is the Knowledge principals mapping that the explorer routes require.
 */
export function createAuth(secret: string): MastraAuthConfig<JwtClaims> {
  const jwt = new MastraJwtAuth({ secret });
  return {
    authenticateToken: async (token) =>
      (await jwt.authenticateToken(token)) as JwtClaims,
    mapUserToResourceId: (user) => user.sub ?? null,
    authorize: async (path, _method, user, context) => {
      if (path.startsWith('/api/knowledge')) {
        (context as HonoContextLike)
          .get('requestContext')
          .set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, knowledgePrincipalsFor(user));
      }
      return Boolean(user);
    },
  };
}
