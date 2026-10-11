import { getScenario } from "@antelope/core";
import { ApiError, errorResponse, optionsResponse, rateLimit, readJson, requireClientKey, streamResponse, requireAi } from "@/lib/ai/http";
import { mockEmployeeReply, mockStream } from "@/lib/ai/mock";
import { streamEmployeeReply } from "@/lib/ai/roleplay";
import { parseScenarioId, parseTurns } from "@/lib/ai/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

/** POST /api/roleplay/turn -> text/plain stream of the employee's reply. */
export async function POST(req: Request) {
  try {
    requireClientKey(req);
    const mode = requireAi();
    rateLimit(req, "turn", 40);

    const { id, obj } = parseScenarioId(await readJson(req));
    const spec = getScenario(id);
    if (!spec) throw new ApiError(404, `Unknown scenario "${id}".`);
    const turns = parseTurns(obj.turns, { lastMustBeLearner: true });

    if (mode === "mock") return streamResponse(req, mockStream(mockEmployeeReply(turns), req.signal));
    return streamResponse(req, await streamEmployeeReply(spec, turns, req.signal));
  } catch (err) {
    return errorResponse(req, err);
  }
}
