import { NextRequest, NextResponse } from "next/server";

/**
 * The root layout can't know which locale a page is until it renders (App
 * Router root layouts are shared across every route). Middleware tags the
 * request with the locale implied by the URL (/en/* → en, everything else
 * → ar per brief §4's AR-default) so app/layout.tsx can set a correct
 * outer <html lang dir> instead of always defaulting to Arabic.
 */
export function middleware(request: NextRequest) {
  const isEnglish = request.nextUrl.pathname === "/en" || request.nextUrl.pathname.startsWith("/en/");
  const headers = new Headers(request.headers);
  headers.set("x-locale", isEnglish ? "en" : "ar");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
