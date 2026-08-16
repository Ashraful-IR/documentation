import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as auditService from "@/services/audit.service";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor();
    const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? 15);
    return ok(await auditService.listAuditLogs(actor, page, pageSize));
  } catch (err) {
    return handleError(err);
  }
}
