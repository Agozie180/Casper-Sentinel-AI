import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { createStoredRiskReport } from "../reports/report-factory.js";
import type { ReportRepository } from "../reports/types.js";
import {
  analyzeTransaction,
  toTransactionIntent,
  type AnalyzeTransactionOptions,
} from "./analyze-transaction.js";
import { analyzeRequestSchema } from "./schemas.js";

export interface ScreeningRouteOptions extends AnalyzeTransactionOptions {
  readonly reportRepository: ReportRepository;
}

export interface ErrorResponse {
  readonly traceId: string;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

/** Registers transaction-screening API routes. */
export function registerScreeningRoutes(server: FastifyInstance, options: ScreeningRouteOptions): void {
  server.post("/v1/analyze", async (request, reply) => {
    const traceId = request.id;
    const parsed = analyzeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(toValidationError(traceId, parsed.error));
    }

    const analyzedAt = options.now?.() ?? new Date();
    const response = await analyzeTransaction(parsed.data, traceId, {
      now: () => analyzedAt,
      ...(options.aiProvider !== undefined ? { aiProvider: options.aiProvider } : {}),
      ...(options.aiAnalyst !== undefined ? { aiAnalyst: options.aiAnalyst } : {}),
    });
    const report = await options.reportRepository.save(
      createStoredRiskReport(response, toTransactionIntent(parsed.data.intent), analyzedAt),
    );

    return reply.code(200).send({
      ...response,
      reportId: report.id,
      createdAt: report.createdAt,
    });
  });
}

/** Converts validation failures into a stable public error response. */
export function toValidationError(traceId: string, error: ZodError): ErrorResponse {
  return {
    traceId,
    error: {
      code: "VALIDATION_ERROR",
      message: "Request body failed validation.",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  };
}

