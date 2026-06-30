import type { FastifyInstance } from "fastify";
import type { ReportRepository } from "./types.js";

/** Registers report history, detail, and Casper publication queue endpoints. */
export function registerReportRoutes(server: FastifyInstance, repository: ReportRepository): void {
  server.get("/v1/reports", async () => ({
    reports: await repository.list(),
  }));

  server.get<{ Params: { id: string } }>("/v1/reports/:id", async (request, reply) => {
    const report = await repository.findById(request.params.id);
    if (report === undefined) {
      return reply.code(404).send(reportNotFound(request.id));
    }

    return reply.code(200).send({ report });
  });

  server.post<{ Params: { id: string } }>("/v1/casper/reports/:id/publish", async (request, reply) => {
    const existing = await repository.findById(request.params.id);
    if (existing === undefined) {
      return reply.code(404).send(reportNotFound(request.id));
    }

    if (existing.casperStatus === "confirmed") {
      return reply.code(409).send({
        traceId: request.id,
        error: {
          code: "REPORT_ALREADY_CONFIRMED",
          message: "The report already has a confirmed Casper transaction.",
        },
      });
    }

    const updated = await repository.updateCasperPublication(request.params.id, {
      status: "queued",
      updatedAt: new Date().toISOString(),
    });

    return reply.code(202).send({ report: updated });
  });
}

function reportNotFound(traceId: string) {
  return {
    traceId,
    error: {
      code: "REPORT_NOT_FOUND",
      message: "No risk report exists for the supplied id.",
    },
  };
}
