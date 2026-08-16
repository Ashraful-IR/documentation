import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as auditService from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor();
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    return ok(await auditService.listAuditLogs(actor, limit));
  } catch (err) {
    return handleError(err);
  }
}
