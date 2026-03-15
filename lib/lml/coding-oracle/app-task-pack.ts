export type LawfulAppTaskPack = {
  id: string;
  title: string;
  graphVariant: string;
  scaffold: string;
  slotContracts: string[];
  invariants: string[];
  witnessExpectations: string[];
  forbiddenPatterns: string[];
  minimalLawfulBaseline: string;
};

export type HostileAppTaskPack = {
  id: string;
  title: string;
  targetFailure: string;
  hostileGraphVariant: string;
  hostileScaffoldShape: string;
  hostileSlotTrap: string;
  hostileInvariantsViolated: string[];
  hostileWitnessExpectation: string;
  forbiddenEscapeRoutes: string[];
  minimalHostileExample: string;
};

export const LAWFUL_APP_TASK_PACKS: LawfulAppTaskPack[] = [
  {
    id: "app_role_gated_delete_button",
    title: "Role-Gated Delete Button",
    graphVariant: "Client_Button(onClick) -> Server_Action -> Session.role == 'ADMIN' -> DB_Delete -> revalidatePath",
    scaffold: "'use server'; export async function deleteItem(id) { ... } / 'use client'; <button onClick={() => startTransition(() => deleteItem(id))}>",
    slotContracts: [
      "[SLOT_ACTION_AUTH]: Server-side session and role check.",
      "[SLOT_UI_PENDING]: Button disable during transition.",
    ],
    invariants: [
      "Action cannot accept a role argument.",
      "Mutation must revalidate path to clear router cache.",
    ],
    witnessExpectations: [
      "Non-admin session calling deleteItem(1) returns an error.",
      "Database delete count is unchanged for unauthorized calls.",
      "Button is disabled while transition is pending.",
    ],
    forbiddenPatterns: [
      "window.location.reload()",
      "trusting role or userId from client payload",
      "raw fetch('/api/delete') instead of server action invocation",
    ],
    minimalLawfulBaseline: [
      "'use server';",
      "import { revalidatePath } from 'next/cache';",
      "import { auth } from '@/lib/auth';",
      "",
      "export async function deleteItem(id: string) {",
      "  const session = await auth();",
      "  if (session?.role !== 'ADMIN') return { error: 'Unauthorized' };",
      "  await db.item.delete({ where: { id } });",
      "  revalidatePath('/');",
      "  return { success: true };",
      "}",
    ].join("\n"),
  },
  {
    id: "app_optimistic_ui_like_button",
    title: "Optimistic UI Like Button",
    graphVariant: "Click -> useOptimistic(increment) -> Server_Action_Call -> DB_Update -> Reconcile_State",
    scaffold: "'use client'; const [optLikes, addOptLike] = useOptimistic(likes, (state) => state + 1)",
    slotContracts: [
      "[SLOT_OPT_STATE]: Synchronous UI update.",
      "[SLOT_ACTION_SYNC]: Async server mutation with rollback path.",
    ],
    invariants: [
      "UI must update before awaiting the server.",
      "State must revert automatically if server throws.",
    ],
    witnessExpectations: [
      "Click updates UI count immediately before the network mock resolves.",
      "Rollback occurs automatically if the server action rejects.",
    ],
    forbiddenPatterns: [
      "await serverAction(); setLikes(...)",
      "storing likes purely in localStorage",
      "ignoring rollback on server error",
    ],
    minimalLawfulBaseline: [
      "'use client';",
      "import { useOptimistic, useTransition } from 'react';",
      "",
      "export function LikeButton({ initial }: { initial: number }) {",
      "  const [pending, startTransition] = useTransition();",
      "  const [likes, addLike] = useOptimistic(initial, (state: number) => state + 1);",
      "  return (",
      "    <button",
      "      disabled={pending}",
      "      onClick={() => startTransition(async () => {",
      "        addLike(1);",
      "        await updateLikeOnServer();",
      "      })}",
      "    >",
      "      {likes}",
      "    </button>",
      "  );",
      "}",
    ].join("\n"),
  },
  {
    id: "app_rsc_pagination_url_state",
    title: "RSC Pagination (URL State)",
    graphVariant: "URL_SearchParams -> RSC_DB_Fetch(Skip/Take) -> Render_List -> Next_Link(href=?page=N)",
    scaffold: "export default async function Page({ searchParams }) { const page = Number(searchParams.page) ... }",
    slotContracts: [
      "[SLOT_PARAM_PARSE]: Safe fallback parsing of URL string.",
      "[SLOT_PAGINATE_LINK]: Pure HTML link generation.",
    ],
    invariants: [
      "Zero 'use client' directives for pagination state.",
      "SSR HTML must contain the correct page items on first load.",
    ],
    witnessExpectations: [
      "Direct navigation to /items?page=2 yields the second page in raw HTML.",
      "Pagination uses Link hrefs instead of client-only router mutation.",
    ],
    forbiddenPatterns: [
      "const [page, setPage] = useState(1)",
      "router.push('?page=2') in an onClick handler",
      "client-only data fetch for first page render",
    ],
    minimalLawfulBaseline: [
      "import Link from 'next/link';",
      "",
      "export default async function Page({ searchParams }: { searchParams?: { page?: string } }) {",
      "  const page = searchParams?.page ? Number.parseInt(searchParams.page, 10) || 1 : 1;",
      "  const items = await db.items.list({ skip: (page - 1) * 10, take: 10 });",
      "  return (",
      "    <main>",
      "      {items.map((item) => <div key={item.id}>{item.name}</div>)}",
      "      <Link href={`?page=${page + 1}`}>Next</Link>",
      "    </main>",
      "  );",
      "}",
    ].join("\n"),
  },
  {
    id: "app_stripe_webhook_route_handler",
    title: "Stripe Webhook Route Handler",
    graphVariant: "POST_Request -> req.text() -> Stripe.constructEvent -> Switch(event.type) -> 200_OK",
    scaffold: "export async function POST(req: Request) { const body = await req.text(); const sig = req.headers.get('stripe-signature'); }",
    slotContracts: [
      "[SLOT_RAW_BODY]: Text extraction before verification.",
      "[SLOT_SIG_VERIFY]: Cryptographic validation through Stripe SDK.",
    ],
    invariants: [
      "Body must not be parsed as JSON before signature verification.",
      "Route must return 200 quickly for handled events.",
    ],
    witnessExpectations: [
      "Invalid signature returns 400 and causes zero DB mutations.",
      "Valid handled event returns 200.",
    ],
    forbiddenPatterns: [
      "const json = await req.json() before verification",
      "returning 500 for unhandled event types",
      "long-running logic inline without queuing",
    ],
    minimalLawfulBaseline: [
      "export async function POST(req: Request) {",
      "  const body = await req.text();",
      "  const signature = req.headers.get('stripe-signature');",
      "  if (!signature) return new Response('Bad Request', { status: 400 });",
      "  const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);",
      "  if (event.type === 'checkout.completed') await fulfill(event.data.object);",
      "  return new Response('OK', { status: 200 });",
      "}",
    ].join("\n"),
  },
  {
    id: "app_dynamic_seo_metadata_generation",
    title: "Dynamic SEO Metadata Generation",
    graphVariant: "generateMetadata({ params }) -> DB_Fetch(Slug) -> Return_Metadata_Object -> Next_Injects_Head",
    scaffold: "export async function generateMetadata({ params }): Promise<Metadata> { const post = await getPost(params.slug); }",
    slotContracts: [
      "[SLOT_META_FETCH]: Dedicated DB call for SEO context.",
      "[SLOT_META_RETURN]: Next.js Metadata schema match.",
    ],
    invariants: [
      "Must be exported from page.tsx or layout.tsx.",
      "Must handle null records gracefully.",
    ],
    witnessExpectations: [
      "SSR HTML contains the fetched post title in <title>.",
      "Missing post falls back to a Not Found metadata title.",
    ],
    forbiddenPatterns: [
      "document.title inside a client component",
      "hardcoded metadata for dynamic route",
      "invalid keys in Metadata object",
    ],
    minimalLawfulBaseline: [
      "import type { Metadata } from 'next';",
      "",
      "export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {",
      "  const post = await db.posts.getBySlug(params.slug);",
      "  return {",
      "    title: post ? `${post.title} | My App` : 'Not Found',",
      "    description: post ? post.excerpt : 'Missing post',",
      "  };",
      "}",
    ].join("\n"),
  },
];

export const HOSTILE_APP_TASK_PACKS: HostileAppTaskPack[] = [
  {
    id: "APP_TASK_DELETE_AUTH_BYPASS",
    title: "Hostile Role-Gated Delete",
    targetFailure: "execution_failed:EX_SEC_ACTION_AUTH",
    hostileGraphVariant: "Client_Payload({id: 1, role: 'ADMIN'}) -> Server_Action -> DB_Delete",
    hostileScaffoldShape: "export async function delete(id, userRole) { if (userRole === 'ADMIN') await db.delete(id); }",
    hostileSlotTrap: "[SLOT_ACTION_AUTH] trust client role argument instead of secure server session.",
    hostileInvariantsViolated: [
      "authorization identity must come from server session",
      "role cannot be trusted from client payload",
    ],
    hostileWitnessExpectation: "Calling delete(1, 'ADMIN') without a valid session cookie must fail and leave DB unchanged.",
    forbiddenEscapeRoutes: [
      "read role from unverified request body",
      "check JWT presence but still trust payload role",
    ],
    minimalHostileExample: [
      "'use server';",
      "export async function deletePost(postId: string, clientRole: string) {",
      "  if (clientRole !== 'ADMIN') throw new Error('Unauthorized');",
      "  await db.post.delete({ where: { id: postId } });",
      "}",
    ].join("\n"),
  },
  {
    id: "APP_TASK_OPTIMISTIC_BLOCK",
    title: "Hostile Optimistic UI",
    targetFailure: "semantic_failed:app_optimistic_blocking",
    hostileGraphVariant: "Click -> await Server_Action -> useState(increment) -> Render",
    hostileScaffoldShape: "const handleLike = async () => { await serverLike(); setLikes(l => l + 1); }",
    hostileSlotTrap: "[SLOT_OPT_STATE] block the UI behind await and use useState instead of useOptimistic.",
    hostileInvariantsViolated: [
      "optimistic UI must update before network round-trip",
      "client must preserve rollback-capable optimistic state",
    ],
    hostileWitnessExpectation: "Immediately after click, UI count must already reflect the optimistic increment before the mock server resolves.",
    forbiddenEscapeRoutes: [
      "remove await without rollback path",
      "persist likes only in localStorage",
    ],
    minimalHostileExample: [
      "'use client';",
      "export function LikeButton({ initial }: { initial: number }) {",
      "  const [likes, setLikes] = useState(initial);",
      "  const onClick = async () => {",
      "    await updateLikeOnServer();",
      "    setLikes(likes + 1);",
      "  };",
      "  return <button onClick={onClick}>{likes}</button>;",
      "}",
    ].join("\n"),
  },
  {
    id: "APP_TASK_PAGINATION_CLIENT_LEAK",
    title: "Hostile RSC Pagination",
    targetFailure: "semantic_failed:app_rsc_state_leak",
    hostileGraphVariant: "'use client' -> useState(page) -> useEffect(fetchData) -> Render_List",
    hostileScaffoldShape: "'use client'; const [page, setPage] = useState(1); useEffect(() => { fetch(...) }, [page])",
    hostileSlotTrap: "[SLOT_PARAM_PARSE] rewrite the route as a client SPA and abandon RSC pagination.",
    hostileInvariantsViolated: [
      "pagination must remain server-first and URL-shareable",
      "first render must contain SSR page items",
    ],
    hostileWitnessExpectation: "Fetching /items?page=2 directly must return server-rendered items instead of a loading shell.",
    forbiddenEscapeRoutes: [
      "useSearchParams in a client component with client fetch",
      "client-only pagination state for initial render",
    ],
    minimalHostileExample: [
      "'use client';",
      "export default function PaginatedList() {",
      "  const [page, setPage] = useState(1);",
      "  const [data, setData] = useState([]);",
      "  useEffect(() => {",
      "    fetch(`/api/items?page=${page}`).then((r) => r.json()).then(setData);",
      "  }, [page]);",
      "  return null;",
      "}",
    ].join("\n"),
  },
  {
    id: "APP_TASK_WEBHOOK_SIG_BYPASS",
    title: "Hostile Webhook Route",
    targetFailure: "execution_failed:EX_SEC_WEBHOOK_SIG",
    hostileGraphVariant: "POST_Request -> req.json() -> Process_DB_Fulfillment -> 200_OK",
    hostileScaffoldShape: "export async function POST(req) { const data = await req.json(); if(data.type === 'checkout') fulfill(...) }",
    hostileSlotTrap: "[SLOT_SIG_VERIFY] trust JSON body and skip Stripe signature verification.",
    hostileInvariantsViolated: [
      "raw body must be verified before parsing event intent",
      "webhook fulfillment must be impossible with forged unsigned JSON",
    ],
    hostileWitnessExpectation: "Forged payload without stripe-signature must fail and leave DB unchanged.",
    forbiddenEscapeRoutes: [
      "req.text() followed by JSON.parse without Stripe SDK verification",
      "blindly trusting event.type from client JSON",
    ],
    minimalHostileExample: [
      "export async function POST(req: Request) {",
      "  const body = await req.json();",
      "  if (body.type === 'payment_intent.succeeded') {",
      "    await db.user.update({ data: { isPro: true } });",
      "  }",
      "  return new Response('OK');",
      "}",
    ].join("\n"),
  },
  {
    id: "APP_TASK_METADATA_CLIENT_TRAP",
    title: "Hostile Dynamic Metadata",
    targetFailure: "semantic_failed:app_seo_ssr_miss",
    hostileGraphVariant: "'use client' -> useEffect -> document.title = Post Title",
    hostileScaffoldShape: "useEffect(() => { document.title = post.title }, [post])",
    hostileSlotTrap: "[SLOT_META_RETURN] try to solve SEO on the client instead of Next.js server metadata.",
    hostileInvariantsViolated: [
      "dynamic metadata must exist in SSR output",
      "SEO title must not depend on client-side effect execution",
    ],
    hostileWitnessExpectation: "Raw page source must include the dynamic post title without executing client JavaScript.",
    forbiddenEscapeRoutes: [
      "static hardcoded metadata for dynamic routes",
      "document.title in client effect",
    ],
    minimalHostileExample: [
      "'use client';",
      "export default function BlogPost({ post }) {",
      "  useEffect(() => {",
      "    document.title = `${post.title} | My Blog`;",
      "  }, [post]);",
      "  return <div>{post.content}</div>;",
      "}",
    ].join("\n"),
  },
];
