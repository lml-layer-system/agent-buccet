/**
 * Execute exactly the destination the Buccet runtime approved.
 *
 * fetch() follows redirects by default. A 302 from an approved URL could
 * otherwise cause an outbound request to an entirely different destination
 * without an additional Boundary/UPL decision. We deliberately fail closed.
 * To follow a redirect, the agent must submit its Location as a fresh tool
 * proposal for a fresh boundary decision.
 */
export async function fetchBuccetApprovedDestination(
  url: string,
  options: {
    method: string;
    body?: string;
    headers: Record<string, string>;
  },
): Promise<Response> {
  return fetch(url, {
    method: options.method,
    body: options.body,
    headers: options.headers,
    redirect: "error",
  });
}
