/**
 * ModMed Integration Module
 *
 * Connects to ModMed's Proprietary FHIR API for appointment sync,
 * patient data, and insurance coverage. Read-only in v1.
 *
 * Architecture:
 * - One ModMedClient per practice (credentials as constructor args)
 * - FHIRFetcher wraps the client with pagination + typed responses
 * - Data mappers transform FHIR resources → our internal models
 * - PHI is encrypted at the mapper layer before storage
 *
 * Usage:
 *   const client = new ModMedClient(config);
 *   const fetcher = new FHIRFetcher(client);
 *   const patients = await fetcher.fetchPatients();
 *   const mapped = patients.map(p => mapPatient(p, practiceId));
 */

// Client
export { ModMedClient, ModMedApiError, CircuitOpenError } from "./client";
export type { ModMedClientOptions } from "./client";

// Fetchers
export { FHIRFetcher } from "./fetchers";
export type { FetcherOptions } from "./fetchers";

// Circuit Breaker
export { CircuitBreaker, InMemoryCircuitBreakerStore } from "./circuit-breaker";
export type { CircuitBreakerStore } from "./circuit-breaker";

// Rate Limiter
export { RateLimiter } from "./rate-limiter";

// Mappers
export { mapPatient, formatPatientName } from "./mappers/patient";
export { mapAppointment } from "./mappers/appointment";
export { mapCoverage, pickPrimaryCoverage, normalizePayerName } from "./mappers/coverage";
export { mapPractitioner } from "./mappers/practitioner";

// Sync
export { runSync } from "./sync";
export type { SyncResult, SyncError } from "./sync";

// PA Detection
export { runPADetection } from "./pa-detection";
export type { PADetectionResult } from "./pa-detection";

// DB-backed circuit breaker store
export { SupabaseCircuitBreakerStore } from "./circuit-breaker-db-store";

// Types
export type {
  ModMedClientConfig,
  ModMedTokenResponse,
  CircuitBreakerState,
  MappedPatient,
  MappedAppointment,
  MappedCoverage,
  MappedPractitioner,
  FHIRPatient,
  FHIRAppointment,
  FHIRCoverage,
  FHIRPractitioner,
  FHIRBundle,
  SyncType,
  SyncStatus,
  SyncTrigger,
} from "./types";
