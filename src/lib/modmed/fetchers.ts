/**
 * FHIR resource fetchers for ModMed API.
 *
 * Each fetcher returns an array of typed FHIR resources, handling
 * pagination transparently. Safety cap prevents runaway pagination.
 *
 * HIPAA: These fetchers return raw FHIR resources that contain PHI.
 * Callers MUST pass results through data mappers (which encrypt PHI)
 * before persisting. Never log FHIR response bodies.
 */

import type { ModMedClient } from "./client";
import type {
  FHIRBundle,
  FHIRPatient,
  FHIRAppointment,
  FHIRCoverage,
  FHIRPractitioner,
  FHIRResource,
} from "./types";

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_PAGE_SIZE = 50;

export interface FetcherOptions {
  /** Max pages to fetch before stopping. Default: 50 */
  maxPages?: number;
  /** Resources per page (_count param). Default: 50 */
  pageSize?: number;
}

export class FHIRFetcher {
  private readonly client: ModMedClient;
  private readonly maxPages: number;
  private readonly pageSize: number;

  constructor(client: ModMedClient, opts: FetcherOptions = {}) {
    this.client = client;
    this.maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
    this.pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  // ---------------------------------------------------------------------------
  // Resource-specific fetchers
  // ---------------------------------------------------------------------------

  /**
   * Fetch all active patients.
   */
  async fetchPatients(
    params?: Record<string, string>
  ): Promise<FHIRPatient[]> {
    return this.fetchAllPages<FHIRPatient>("ema/fhir/v2/Patient", {
      _count: String(this.pageSize),
      ...params,
    });
  }

  /**
   * Fetch appointments within a date range.
   *
   * @param dateFrom - ISO date string, e.g. "2026-04-01"
   * @param dateTo - ISO date string, e.g. "2026-04-30"
   */
  async fetchAppointments(
    dateFrom?: string,
    dateTo?: string,
    params?: Record<string, string>
  ): Promise<FHIRAppointment[]> {
    const searchParams: Record<string, string> = {
      _count: String(this.pageSize),
      ...params,
    };

    if (dateFrom) searchParams.date = `ge${dateFrom}`;
    if (dateTo) {
      // FHIR date search supports multiple date params for range
      searchParams["date"] = dateFrom
        ? `ge${dateFrom}&date=le${dateTo}`
        : `le${dateTo}`;
    }

    return this.fetchAllPages<FHIRAppointment>(
      "ema/fhir/v2/Appointment",
      searchParams
    );
  }

  /**
   * Fetch coverage (insurance) records for a specific patient.
   *
   * @param patientId - ModMed patient ID
   */
  async fetchCoverageForPatient(
    patientId: string
  ): Promise<FHIRCoverage[]> {
    return this.fetchAllPages<FHIRCoverage>("ema/fhir/v2/Coverage", {
      _count: String(this.pageSize),
      beneficiary: `Patient/${patientId}`,
    });
  }

  /**
   * Fetch all coverage records (for full sync).
   */
  async fetchAllCoverage(
    params?: Record<string, string>
  ): Promise<FHIRCoverage[]> {
    return this.fetchAllPages<FHIRCoverage>("ema/fhir/v2/Coverage", {
      _count: String(this.pageSize),
      ...params,
    });
  }

  /**
   * Fetch all practitioners.
   */
  async fetchPractitioners(
    params?: Record<string, string>
  ): Promise<FHIRPractitioner[]> {
    return this.fetchAllPages<FHIRPractitioner>("ema/fhir/v2/Practitioner", {
      _count: String(this.pageSize),
      ...params,
    });
  }

  // ---------------------------------------------------------------------------
  // Pagination engine
  // ---------------------------------------------------------------------------

  /**
   * Fetch all pages of a FHIR Bundle search result.
   *
   * Follows `Bundle.link[relation=next]` until no more pages or
   * maxPages is reached. Returns a flat array of resources.
   */
  private async fetchAllPages<T extends FHIRResource>(
    path: string,
    params?: Record<string, string>
  ): Promise<T[]> {
    const results: T[] = [];
    let pageCount = 0;

    // First page: use path + params
    let bundle = await this.client.request<FHIRBundle<T>>(path, params);
    results.push(...this.extractResources(bundle));
    pageCount++;

    // Subsequent pages: follow "next" link
    while (pageCount < this.maxPages) {
      const nextUrl = this.getNextLink(bundle);
      if (!nextUrl) break;

      bundle = await this.client.requestUrl<FHIRBundle<T>>(nextUrl);
      results.push(...this.extractResources(bundle));
      pageCount++;
    }

    return results;
  }

  /**
   * Extract resources from a FHIR Bundle's entry array.
   * Silently skips entries without a resource (shouldn't happen but defensive).
   */
  private extractResources<T extends FHIRResource>(
    bundle: FHIRBundle<T>
  ): T[] {
    if (!bundle.entry) return [];
    return bundle.entry
      .filter((entry) => entry.resource != null)
      .map((entry) => entry.resource!);
  }

  /**
   * Find the "next" pagination link in a FHIR Bundle.
   */
  private getNextLink(bundle: FHIRBundle): string | null {
    if (!bundle.link) return null;
    const next = bundle.link.find((l) => l.relation === "next");
    return next?.url ?? null;
  }
}
