import type { FastifyInstance } from "fastify";
import type { ReportRepository } from "./types.js";

/** Registers report history and detail endpoints. */
export function registerReportRoutes(server: FastifyInstance, repository: ReportRepository): void {
  server.get("/v1/reports", async () => ({
    reports: await repository.list(),
  }));

  server.get<{ Params: { id: string } }>("/v1/reports/:id", async (request, reply) => {
    const report = await repository.findById(request.params.id);
    if (report === undefined) {
      return reply.code(404).send({
        traceId: request.id,
        error: {
          code: "REPORT_NOT_FOUND",
          message: "No risk report exists for the supplied id.",
        },
      });
    }

    return reply.code(200).send({ report });
  });
}
