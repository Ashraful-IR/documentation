import { NextRequest } from "next/server";

import { ok, fail, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as mediaService from "@/services/media.service";

export async function GET() {
  try {
    const actor = await requireActor();
    return ok(await mediaService.listMedia(actor));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return fail("NO_FILE", "No file was uploaded", 400);
    }
    const blob = file as File;
    const uploaded = await mediaService.saveUpload(actor, blob);
    return ok(uploaded, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
