export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly logLevel: "debug" | "info" | "warn" | "error";
  readonly casperNetwork: "testnet" | "mainnet";
  readonly casperRpcUrl: string;
  readonly casperSseUrl: string;
  readonly reportStorePath: string;
}

/** Reads application configuration from an environment-like object with secure defaults. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: parseNodeEnv(env.NODE_ENV),
    port: parsePort(env.PORT),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    casperNetwork: parseCasperNetwork(env.CASPER_NETWORK),
    casperRpcUrl: env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc",
    casperSseUrl: env.CASPER_SSE_URL ?? "https://node.testnet.casper.network/events/main",
    reportStorePath: env.REPORT_STORE_PATH ?? ".data/risk-reports.json",
  };
}

/** Parses NODE_ENV into the supported runtime modes. */
export function parseNodeEnv(value: string | undefined): AppConfig["nodeEnv"] {
  if (value === "test" || value === "production") return value;
  return "development";
}

/** Parses the HTTP port with a local development default. */
export function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? "4000");
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new RangeError("PORT must be an integer between 1 and 65535.");
  }
  return parsed;
}

/** Parses the configured structured logging level. */
export function parseLogLevel(value: string | undefined): AppConfig["logLevel"] {
  if (value === "debug" || value === "warn" || value === "error") return value;
  return "info";
}

/** Parses the Casper network while defaulting to Testnet for MVP safety. */
export function parseCasperNetwork(value: string | undefined): AppConfig["casperNetwork"] {
  if (value === "mainnet") return "mainnet";
  return "testnet";
}
