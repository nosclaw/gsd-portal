import { handlers } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { success, resetAt } = rateLimit(`auth:${ip}`, 10, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
    );
  }
  return handlers.POST(req);
}
