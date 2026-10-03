import { validateServerEnvironment } from "@/lib/config/env";

function main() {
  const environment = validateServerEnvironment();
  console.log(JSON.stringify({
    status: "ok",
    environment: environment.nodeEnv,
    siteConfigured: Boolean(environment.siteUrl),
    version: environment.appVersion,
    commitConfigured: Boolean(environment.commitSha),
    databaseConfigured: true,
  }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Environment validation failed.");
  process.exitCode = 1;
}
