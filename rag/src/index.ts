import { RasvsCommand } from "./app/commands/index.js";
import { runExtractCli } from "./app/services/extract/index.js";
import { runIngestCli } from "./app/services/ingest/index.js";
import { runEvaluateCli } from "./app/services/evaluate/index.js";
import { runAgentCli } from "./app/services/agent/index.js";

const COMMAND_RUNNERS = {
  extract: runExtractCli,
  ingest: runIngestCli,
  evaluate: runEvaluateCli,
  agent: runAgentCli,
};

async function main(): Promise<void> {
  const rasvs = new RasvsCommand(COMMAND_RUNNERS);
  await rasvs.run(process.argv);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
