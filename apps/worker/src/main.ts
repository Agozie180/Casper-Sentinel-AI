import { loadConfig } from "@casper-sentinel/config";

/** Starts background workers for asynchronous Casper publication jobs. */
export function startWorker(): void {
  const config = loadConfig();
  console.info("casper-sentinel-worker ready", {
    casperNetwork: config.casperNetwork
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    startWorker();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}
