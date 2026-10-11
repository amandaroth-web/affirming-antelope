import { getDrill } from "@antelope/core";
import { ApiError, errorResponse, jsonResponse, optionsResponse, readJson, requireAi } from "@/lib/ai/http";
import { authenticate, chargeQuota } from "@/lib/ai/auth";
import { mockDrillFeedback } from "@/lib/ai/mock";
import { runDrillFeedback } from "@/lib/ai/pipeline";
import { parseDrillRequest } from "@/lib/ai/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

/** POST /api/drill/feedback -> DrillFeedback */
export async function POST(req: Request) {
  try {
    const caller = await authenticate(req);
    const mode = requireAi();

    const { drillId, response } = parseDrillRequest(await readJson(req));
    const drill = getDrill(drillId);
    if (!drill) throw new ApiError(404, `Unknown drill "${drillId}".`);
    if (!response) throw new ApiError(400, "response is required.");
    const quota = await chargeQuota(caller, "drill");

    const feedback =
      mode === "mock" ? await mockDrillFeedback(drill, response) : await runDrillFeedback(drill, response, req.signal);
    return jsonResponse(req, feedback, 200, quota);
  } catch (err) {
    return errorResponse(req, err);
  }
}
