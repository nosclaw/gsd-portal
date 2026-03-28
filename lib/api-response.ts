import { NextResponse } from "next/server";

export function apiError(code: string, message: string, status: number = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
