export const CODING_APP_TASK_LAWS = [
  "ABILITY.CODING.147: Application server actions must derive identity, authorization, and mutation permission from server-side session state, never from client-supplied role or identity payload.",
  "ABILITY.CODING.148: Application optimistic-interaction tasks must update optimistic UI state before network resolution and must preserve an explicit rollback path on server failure.",
  "ABILITY.CODING.149: Application RSC pagination tasks must keep pagination authority in URL/searchParams and server-side fetch flow; client-only pagination state is inadmissible when SSR/RSC pagination is requested.",
  "ABILITY.CODING.150: Application webhook tasks must verify raw request body and signature before side effects; parsed-but-unverified webhook payloads are direct execution-safety failures.",
  "ABILITY.CODING.151: Application dynamic metadata tasks must bind SEO state through server metadata exports; client-side title or meta mutation is not admissible metadata fulfillment.",
] as const;
