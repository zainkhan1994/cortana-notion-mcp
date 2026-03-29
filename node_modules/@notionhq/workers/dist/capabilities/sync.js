import { ExecutionError, unreachable } from "../error.js";
import { createCapabilityContext } from "./context.js";
function createSyncCapability(key, syncConfiguration) {
  return {
    _tag: "sync",
    key,
    config: {
      primaryKeyProperty: syncConfiguration.primaryKeyProperty,
      schema: syncConfiguration.schema,
      mode: syncConfiguration.mode,
      schedule: parseSchedule(syncConfiguration.schedule)
    },
    async handler(runtimeContext, options) {
      const capabilityContext = createCapabilityContext();
      const state = runtimeContext?.state ?? runtimeContext?.userContext;
      let executionResult;
      try {
        executionResult = await syncConfiguration.execute(
          state,
          capabilityContext
        );
      } catch (err) {
        const error = new ExecutionError(err);
        if (!options?.concreteOutput) {
          process.stdout.write(
            `
<output>${JSON.stringify({ _tag: "error", error: { name: error.name, message: error.message } })}</output>
`
          );
        }
        throw error;
      }
      const result = {
        changes: executionResult.changes,
        hasMore: executionResult.hasMore,
        nextUserContext: executionResult.nextState
      };
      if (options?.concreteOutput) {
        return result;
      } else {
        process.stdout.write(
          `
<output>${JSON.stringify({ _tag: "success", value: result })}</output>
`
        );
      }
      return result;
    }
  };
}
const MS_PER_MINUTE = 60 * 1e3;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MIN_INTERVAL_MS = MS_PER_MINUTE;
const MAX_INTERVAL_MS = 7 * MS_PER_DAY;
const DEFAULT_INTERVAL_MS = 30 * MS_PER_MINUTE;
function parseSchedule(schedule) {
  if (schedule === "continuous") {
    return { type: "continuous" };
  }
  if (!schedule) {
    return { type: "interval", intervalMs: DEFAULT_INTERVAL_MS };
  }
  const match = schedule.match(/^(\d+)(m|h|d)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(
      `Invalid schedule format: "${schedule}". Use "continuous" or an interval like "30m", "1h", "1d".`
    );
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  let intervalMs;
  switch (unit) {
    case "m":
      intervalMs = value * MS_PER_MINUTE;
      break;
    case "h":
      intervalMs = value * MS_PER_HOUR;
      break;
    case "d":
      intervalMs = value * MS_PER_DAY;
      break;
    default:
      unreachable(unit);
  }
  if (intervalMs < MIN_INTERVAL_MS) {
    throw new Error(
      `Schedule interval must be at least 1 minute. Got: "${schedule}"`
    );
  }
  if (intervalMs > MAX_INTERVAL_MS) {
    throw new Error(
      `Schedule interval must be at most 7 days. Got: "${schedule}"`
    );
  }
  return { type: "interval", intervalMs };
}
export {
  createSyncCapability
};
