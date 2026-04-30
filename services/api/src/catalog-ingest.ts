import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  CatalogManifestValidationError,
  createCatalogIngestionService,
} from "./catalog-ingestion-service.js";
import { createApiConfig } from "./config.js";
import { initializeLocalStorage } from "./storage.js";

const resolveManifestPath = (manifestPath: string) => {
  if (isAbsolute(manifestPath)) {
    return manifestPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), manifestPath);
};

export const ingestCatalogManifestFile = async (manifestPath: string) => {
  const config = createApiConfig();
  const layout = await initializeLocalStorage(config.dataDir);
  const ingestionService = createCatalogIngestionService(layout);
  const summary = await ingestionService.ingestManifestFile(
    resolveManifestPath(manifestPath),
  );

  return {
    status: summary.idempotent ? "unchanged" : "ingested",
    summary,
  };
};

const runCatalogIngestCli = async () => {
  const [manifestPath] = process.argv.slice(2);

  if (!manifestPath) {
    console.error("Usage: pnpm catalog:ingest <service-manifest.json>");
    process.exitCode = 1;
    return;
  }

  try {
    console.log(JSON.stringify(await ingestCatalogManifestFile(manifestPath), null, 2));
  } catch (error: unknown) {
    if (error instanceof CatalogManifestValidationError) {
      console.error(
        JSON.stringify(
          {
            code: "INVALID_CATALOG_MANIFEST",
            message: "Catalog manifest validation failed",
            details: {
              issues: error.issues,
            },
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }

    throw error;
  }
};

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (entrypoint === import.meta.url) {
  runCatalogIngestCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
