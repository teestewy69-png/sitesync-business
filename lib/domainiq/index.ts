/**
 * In-process DomainIQ for Sitesinc (server-side). No DomainIQ server, database,
 * or API key: the deterministic generation + scoring engine is ported from
 * DomainIQ (see ./engine.ts) and its data is exported from the real Python
 * source by scripts/domainiq/export-domainiq.py.
 */
import { DOMAINIQ_DATA } from "./data.generated";
import { createDomainIQEngine } from "./engine";

export const DOMAINIQ_ENGINE_VERSION = "domainiq-ts-port@2026-10-05";
export const DOMAINIQ_MODE = "in-process" as const;

export const domainIQ = createDomainIQEngine(DOMAINIQ_DATA);

export type { DomainIQEngine } from "./engine";
