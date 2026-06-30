import Fastify, { type FastifyInstance } from "fastify";
import { loadConfig } from "@casper-sentinel/config";
import type { AIAnalystProvider } from "@casper-sentinel/ai-agent";
import { pathToFileURL } from "node:url";
import { InMemoryReportRepository } from "./features/reports/in-memory-report-repository.js";
import { FileReportRepository } from "./features/reports/file-report-repository.js";
import { registerReportRoutes } from "./features/reports/routes.js";
import type { ReportRepository } from "./features/reports/types.js";
import { registerScreeningRoutes } from "./features/screening/routes.js";

export interface BuildServerOptions {
  readonly now?: () => Date;
  readonly aiProvider?: AIAnalystProvider;
  readonly reportRepository?: ReportRepository;
}

/** Builds the HTTP API shell used by the dashboard and future public clients. */
export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const reportRepository = options.reportRepository ?? new InMemoryReportRepository();
  const server = Fastify({
    logger: true,
    genReqId: () => crypto.randomUUID(),
  });

  server.addHook("onRequest", (request, reply, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return;
    }
    done();
  });

  server.get("/v1/health", () => ({
    status: "ok",
    service: "casper-sentinel-api",
  }));

  registerScreeningRoutes(server, {
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.aiProvider !== undefined ? { aiProvider: options.aiProvider } : {}),
    reportRepository,
  });
  registerReportRoutes(server, reportRepository);

  return server;
}

/** Starts the API process from environment configuration. */
export async function startApi(): Promise<void> {
  const config = loadConfig();
  const server = buildServer({ reportRepository: new FileReportRepository(config.reportStorePath) });
  await server.listen({ port: config.port, host: "0.0.0.0" });
}

export function isEntrypoint(moduleUrl: string, scriptPath: string | undefined): boolean {
  return scriptPath !== undefined && moduleUrl === pathToFileURL(scriptPath).href;
}

if (isEntrypoint(import.meta.url, process.argv[1])) {
  startApi().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
