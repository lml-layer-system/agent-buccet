import { NextResponse } from "next/server";
import { getProfileOrThrow } from "@/lib/profiles";

type Body = {
  profileId?: string;
  [key: string]: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const profileId = body.profileId ?? "DOC_LAW_PROFILE";
    const profile = getProfileOrThrow(profileId);

    const response = await fetch(new URL("/api/snap-run", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        runMode: "product",
        profileVersion: profile.version,
        profileImmutableHash: profile.immutableHash,
      }),
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Failed to run product SNAP route." }, { status: 500 });
  }
}
