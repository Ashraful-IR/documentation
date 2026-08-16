import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as searchService from "@/services/search.service";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor();
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
    return ok(await searchService.search(actor, q, limit));
  } catch (err) {
    return handleError(err);
  }
}
