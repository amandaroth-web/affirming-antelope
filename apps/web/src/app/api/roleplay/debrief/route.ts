import { getScenario } from "@antelope/core";
import { ApiError, errorResponse, jsonResponse, optionsResponse, readJson, requireAi } from "@/lib/ai/http";
import { authorize } from "@/lib/ai/auth";
import { mockDebrief } from "@/lib/ai/mock";
import { runDebrief } from "@/lib/ai/pipeline";
import { parseScenarioId, parseSelfReflection, parseTurns } from "@/lib/ai/validate";

export const runtime = "nodejs";
export const maxDuration = 150; // observer then coach, run in sequence

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

/** POST /api/roleplay/debrief -> Debrief */
export async function POST(req: Request) {
  try {
    await authorize(req, "debrief", { guestMax: 8 });
    const mode = requireAi();

    const { id, obj } = parseScenarioId(await readJson(req));
    const spec = getScenario(id);
    if (!spec) throw new ApiError(404, `Unknown scenario "${id}".`);
    const turns = parseTurns(obj.turns, { lastMustBeLearner: false });
    const selfReflection = parseSelfReflection(obj.selfReflection);

    const debrief =
      mode === "mock"
        ? await mockDebrief(spec, turns, selfReflection)
        : await runDebrief(spec, turns, selfReflection, req.signal);
    return jsonResponse(req, debrief);
  } catch (err) {
    return errorResponse(req, err);
  }
}
