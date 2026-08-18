import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { logger } from "./logging_configuration.js";

export interface MilvusConnectionSettings {
  address: string;
  database: string;
  username?: string;
  password?: string;
  token?: string;
}

interface MilvusClientOptions {
  address: string;
  database: string;
  token?: string;
  username?: string;
  password?: string;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isLocalAddress(address: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(address);
}

export function readMilvusSettingsFromEnv(): MilvusConnectionSettings {
  return {
    address: process.env.MILVUS_AMB_URI ?? "http://localhost:19530",
    database: process.env.MILVUS_DB_NAME ?? "default",
    username: optionalEnv("MILVUS_USERNAME"),
    password: optionalEnv("MILVUS_PASSWORD"),
    token: optionalEnv("MILVUS_TOKEN"),
  };
}

export function milvusCollectionNameFromEnv(): string {
  return process.env.MILVUS_COLLECTION_NAME ?? "asvs_documents";
}

export function createAuthenticatedMilvusClient(
  overrides: Partial<MilvusConnectionSettings> = {}
): MilvusClient {
  const env = readMilvusSettingsFromEnv();
  const address = overrides.address ?? env.address;
  const database = overrides.database ?? env.database;
  const token = overrides.token ?? env.token;
  const username = overrides.username ?? env.username;
  const password = overrides.password ?? env.password;

  const config: MilvusClientOptions = { address, database };
  const hasToken = Boolean(token);
  const hasUserPassword = Boolean(username && password);

  if (hasToken) {
    config.token = token;
  } else if (hasUserPassword) {
    config.username = username;
    config.password = password;
  } else if (username || password) {
    throw new Error(
      "Both MILVUS_USERNAME and MILVUS_PASSWORD are required when MILVUS_TOKEN is not set."
    );
  } else if (!isLocalAddress(address)) {
    throw new Error(
      "Milvus credentials are required for non-local connections. Set MILVUS_TOKEN or MILVUS_USERNAME and MILVUS_PASSWORD."
    );
  } else {
    logger.warn(
      "Milvus client created without token or username/password. Set MILVUS_TOKEN or MILVUS_USERNAME and MILVUS_PASSWORD."
    );
  }

  return new MilvusClient(config);
}
