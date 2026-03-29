import { ExecutionError } from "../error.js";
import { createCapabilityContext } from "./context.js";
function createAutomationCapability(key, config) {
  return {
    _tag: "automation",
    key,
    config: {
      title: config.title,
      description: config.description
    },
    async handler(event, options) {
      try {
        const capabilityContext = createCapabilityContext();
        await config.execute(event, capabilityContext);
        if (options?.concreteOutput) {
          return { status: "success" };
        } else {
          process.stdout.write(
            `
<output>${JSON.stringify({ _tag: "success", value: { status: "success" } })}</output>
`
          );
        }
      } catch (err) {
        const error = new ExecutionError(err);
        if (!options?.concreteOutput) {
          process.stdout.write(
            `
<output>${JSON.stringify({ _tag: "error", error: { name: error.name, message: error.message, trace: error.stack } })}</output>
`
          );
        }
        throw error;
      }
    }
  };
}
export {
  createAutomationCapability
};
