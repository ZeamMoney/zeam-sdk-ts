import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export type PaymentMethod =
  | "BANK"
  | "MOMO"
  | "CRYPTO"
  | "CARD"
  | "CASH"
  | "QR"
  | "VOUCHER"
  | "WALLET";

export type BeneficiaryType = "Individual" | "Business";

export interface PaymentDestination {
  id?: string;
  beneficiary_id?: string;
  method?: PaymentMethod;
  label?: string;
  is_primary?: boolean;
  is_zeam_account?: boolean;
  country_iso?: string;
  country_name?: string;
  currency_code?: string;
  region?: string;
  // bank
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  sort_code?: string;
  iban?: string;
  swift_bic?: string;
  branch_code?: string;
  // mobile
  mobile_number?: string;
  mobile_provider?: string;
  // crypto
  network_id?: string | null;
  network_name?: string;
  asset_id?: string | null;
  asset_symbol?: string;
  wallet_address?: string;
  connector_id?: string | null;
  connector_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentDestinationInput {
  method: PaymentMethod;
  is_primary: boolean;
  country_iso: string;
  label?: string;
  country_name?: string;
  currency_code?: string;
  region?: string;
  // bank
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  sort_code?: string;
  iban?: string;
  swift_bic?: string;
  branch_code?: string;
  // mobile
  mobile_number?: string;
  mobile_provider?: string;
  // crypto
  network_id?: string;
  network_name?: string;
  asset_id?: string;
  asset_symbol?: string;
  wallet_address?: string;
  connector_id?: string;
  connector_name?: string;
  is_zeam_account?: boolean;
}

export interface PaymentDestinationsResult {
  payment_destinations?: PaymentDestination[];
  total?: number;
}

export interface BeneficiaryIndividual {
  id?: string;
  first_name?: string;
  last_name?: string;
  id_number?: string;
  date_of_birth?: string | null;
  nationality?: string;
  mobile_number?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BeneficiaryBusiness {
  id?: string;
  company_name?: string;
  registration_number?: string;
  country_of_registration?: string;
  tax_id?: string;
  industry?: string;
  contact_person_name?: string;
  contact_number?: string;
  contact_email?: string;
  registered_address?: string;
}

export interface BeneficiaryIndividualInput {
  first_name: string;
  last_name: string;
  id_number?: string;
  date_of_birth?: string;
  nationality?: string;
  mobile_number?: string;
  email?: string;
}

export interface BeneficiaryBusinessInput {
  company_name: string;
  registration_number?: string;
  country_of_registration?: string;
  tax_id?: string;
  industry?: string;
  contact_person_name?: string;
  contact_number?: string;
  contact_email?: string;
  registered_address?: string;
}

export interface Beneficiary {
  id?: string;
  association_id?: string;
  beneficiary_type?: BeneficiaryType;
  reference?: string;
  individual?: BeneficiaryIndividual | null;
  business?: BeneficiaryBusiness | null;
  payment_destinations?: PaymentDestination[];
  addresses?: unknown[];
  created_at?: string;
  updated_at?: string;
}

export interface BeneficiaryInput {
  beneficiary_type: BeneficiaryType;
  reference?: string;
  individual?: BeneficiaryIndividualInput;
  business?: BeneficiaryBusinessInput;
  payment_destinations?: PaymentDestinationInput[];
  addresses?: unknown[];
  tags?: string[];
}

export interface BulkCreateResult {
  beneficiary_ids?: string[];
  success_count?: number;
  failed_count?: number;
  total?: number;
  results?: Array<{ beneficiary_id?: string; index?: number; success?: boolean }>;
}

export interface BeneficiaryTags {
  tags?: string[];
  suggested_tags?: string[];
}

export interface BeneficiaryListParams {
  search?: string;
  beneficiary_type?: BeneficiaryType;
  payment_method?: PaymentMethod;
}

export interface BeneficiaryListResult {
  beneficiaries?: Beneficiary[];
  total?: number;
}

export interface Connector {
  id?: string;
  name?: string;
  method?: PaymentMethod;
  countryISO?: string;
  [k: string]: unknown;
}

export interface ConnectorsResult {
  connectors?: { connectors?: Connector[] };
}

export function beneficiaryMethods(doer: Doer) {
  return {
    /**
     * List beneficiaries for an association, with optional filtering.
     *
     * `GET /v1/business/beneficiaries/:associationId`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association to list beneficiaries for.
     * @param params - Optional filters: `search` (name/reference), `beneficiary_type`, `payment_method`.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns {@link BeneficiaryListResult} containing the array and total count.
     *
     * @example
     * const { beneficiaries } = await business.listBeneficiaries(session, "assoc-uuid", {
     *   beneficiary_type: "Individual",
     *   payment_method: "BANK",
     * });
     */
    listBeneficiaries(
      session: Session,
      associationId: string,
      params?: BeneficiaryListParams,
      signal?: AbortSignal,
    ): Promise<BeneficiaryListResult> {
      const query = params ? new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
      ) : undefined;
      return call<BeneficiaryListResult>(doer, {
        method: "GET",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}`,
        session,
        requireTrack: Track.Business,
        query,
        signal,
      });
    },

    /**
     * Fetch a single beneficiary by its UUID within an association.
     *
     * `GET /v1/business/beneficiaries/:associationId/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary to retrieve.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Object containing the full {@link Beneficiary} record.
     *
     * @example
     * const { beneficiary } = await business.getBeneficiary(session, "assoc-uuid", "ben-uuid");
     * console.log(beneficiary.individual?.first_name);
     */
    getBeneficiary(
      session: Session,
      associationId: string,
      id: string,
      signal?: AbortSignal,
    ): Promise<{ beneficiary: Beneficiary }> {
      return call<{ beneficiary: Beneficiary }>(doer, {
        method: "GET",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Create a new beneficiary under an association.
     *
     * Set `beneficiary_type` to `"Individual"` or `"Business"` and populate
     * the corresponding `individual` or `business` sub-object. You can
     * optionally attach `payment_destinations` in the same call.
     *
     * `POST /v1/business/beneficiaries/:associationId`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association to create the beneficiary under.
     * @param input - Beneficiary details including type, profile, and optional payment destinations.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Object containing the newly created {@link Beneficiary}.
     *
     * @example
     * const { beneficiary } = await business.createBeneficiary(session, "assoc-uuid", {
     *   beneficiary_type: "Individual",
     *   individual: { first_name: "Jane", last_name: "Doe", email: "jane@example.com" },
     * });
     */
    createBeneficiary(
      session: Session,
      associationId: string,
      input: BeneficiaryInput,
      signal?: AbortSignal,
    ): Promise<{ beneficiary: Beneficiary }> {
      return call<{ beneficiary: Beneficiary }>(doer, {
        method: "POST",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    /**
     * Create multiple beneficiaries in a single request.
     *
     * Partial failures are tolerated — the response reports per-item success
     * via `results[]` and aggregate counts via `success_count` / `failed_count`.
     *
     * `POST /v1/business/beneficiaries/:associationId/bulk`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association to create the beneficiaries under.
     * @param beneficiaries - Array of {@link BeneficiaryInput} objects to create.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns {@link BulkCreateResult} with per-item outcomes and aggregate counts.
     *
     * @example
     * const result = await business.bulkCreateBeneficiaries(session, "assoc-uuid", [
     *   { beneficiary_type: "Individual", individual: { first_name: "Alice", last_name: "A" } },
     *   { beneficiary_type: "Individual", individual: { first_name: "Bob",   last_name: "B" } },
     * ]);
     * console.log(`${result.success_count} created, ${result.failed_count} failed`);
     */
    bulkCreateBeneficiaries(
      session: Session,
      associationId: string,
      beneficiaries: BeneficiaryInput[],
      signal?: AbortSignal,
    ): Promise<BulkCreateResult> {
      return call<BulkCreateResult>(doer, {
        method: "POST",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/bulk`,
        session,
        requireTrack: Track.Business,
        body: { beneficiaries },
        signal,
      });
    },

    /**
     * Update an existing beneficiary's profile.
     *
     * Replaces the beneficiary record with the supplied data. Include all
     * fields you want to keep — omitted optional fields may be cleared.
     *
     * `PUT /v1/business/beneficiaries/:associationId/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary to update.
     * @param input - Updated beneficiary data.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns The updated {@link Beneficiary}.
     *
     * @example
     * const updated = await business.updateBeneficiary(session, "assoc-uuid", "ben-uuid", {
     *   beneficiary_type: "Individual",
     *   individual: { first_name: "Jane", last_name: "Smith", email: "jane@new.com" },
     * });
     */
    updateBeneficiary(
      session: Session,
      associationId: string,
      id: string,
      input: BeneficiaryInput,
      signal?: AbortSignal,
    ): Promise<Beneficiary> {
      return call<Beneficiary>(doer, {
        method: "PUT",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    /**
     * Permanently delete a beneficiary.
     *
     * This is irreversible. Any associated payment destinations will also
     * be removed.
     *
     * `DELETE /v1/business/beneficiaries/:associationId/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary to delete.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Empty object `{}` on success.
     *
     * @example
     * await business.deleteBeneficiary(session, "assoc-uuid", "ben-uuid");
     */
    deleteBeneficiary(
      session: Session,
      associationId: string,
      id: string,
      signal?: AbortSignal,
    ): Promise<Record<string, never>> {
      return call<Record<string, never>>(doer, {
        method: "DELETE",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Fetch the tags attached to a beneficiary.
     *
     * Returns both the current `tags` and platform-suggested `suggested_tags`
     * for the beneficiary.
     *
     * `GET /v1/business/beneficiaries/:associationId/:id/tags`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns {@link BeneficiaryTags} with `tags` and `suggested_tags` arrays.
     *
     * @example
     * const { tags, suggested_tags } = await business.getBeneficiaryTags(session, "assoc-uuid", "ben-uuid");
     */
    getBeneficiaryTags(
      session: Session,
      associationId: string,
      id: string,
      signal?: AbortSignal,
    ): Promise<BeneficiaryTags> {
      return call<BeneficiaryTags>(doer, {
        method: "GET",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}/tags`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Replace all tags on a beneficiary.
     *
     * The supplied array fully replaces the existing tags — pass an empty
     * array `[]` to clear all tags.
     *
     * `PUT /v1/business/beneficiaries/:associationId/:id/tags`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary to update tags for.
     * @param tags - Full replacement set of tag strings.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Updated {@link BeneficiaryTags}.
     *
     * @example
     * await business.updateBeneficiaryTags(session, "assoc-uuid", "ben-uuid", ["vip", "priority"]);
     */
    updateBeneficiaryTags(
      session: Session,
      associationId: string,
      id: string,
      tags: string[],
      signal?: AbortSignal,
    ): Promise<BeneficiaryTags> {
      return call<BeneficiaryTags>(doer, {
        method: "PUT",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}/tags`,
        session,
        requireTrack: Track.Business,
        body: { tags },
        signal,
      });
    },

    /**
     * List all payment destinations for a beneficiary, optionally filtered by method.
     *
     * A payment destination represents one concrete payout channel (e.g. a
     * specific bank account, mobile money number, or crypto address).
     *
     * `GET /v1/business/beneficiaries/:associationId/:id/payment-destinations`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary.
     * @param method - Optional filter by payment method (`"BANK"`, `"MOMO"`, `"CRYPTO"`, etc.).
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns {@link PaymentDestinationsResult} with the destinations array and total count.
     *
     * @example
     * const { payment_destinations } = await business.listPaymentDestinations(
     *   session, "assoc-uuid", "ben-uuid", "BANK"
     * );
     */
    listPaymentDestinations(
      session: Session,
      associationId: string,
      id: string,
      method?: PaymentMethod,
      signal?: AbortSignal,
    ): Promise<PaymentDestinationsResult> {
      const query = method ? new URLSearchParams({ method }) : undefined;
      return call<PaymentDestinationsResult>(doer, {
        method: "GET",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}/payment-destinations`,
        session,
        requireTrack: Track.Business,
        query,
        signal,
      });
    },

    /**
     * Add a new payment destination to an existing beneficiary.
     *
     * Populate only the fields relevant to the chosen `method`:
     * - `BANK` → `bank_name`, `account_number`, `sort_code`, etc.
     * - `MOMO` → `mobile_number`, `mobile_provider`
     * - `CRYPTO` → `wallet_address`, `network_id`, `asset_id`, `connector_id`
     *
     * `POST /v1/business/beneficiaries/:associationId/:id/payment-destinations`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary to add a destination to.
     * @param input - Payment destination details — see {@link PaymentDestinationInput}.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Object containing the newly created {@link PaymentDestination}.
     *
     * @example
     * const { payment_destination } = await business.addPaymentDestination(
     *   session, "assoc-uuid", "ben-uuid",
     *   { method: "BANK", is_primary: true, country_iso: "ZA", account_number: "1234567890" }
     * );
     */
    addPaymentDestination(
      session: Session,
      associationId: string,
      id: string,
      input: PaymentDestinationInput,
      signal?: AbortSignal,
    ): Promise<{ payment_destination: PaymentDestination }> {
      return call<{ payment_destination: PaymentDestination }>(doer, {
        method: "POST",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}/payment-destinations`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    /**
     * Update an existing payment destination on a beneficiary.
     *
     * `PUT /v1/business/beneficiaries/:associationId/:id/payment-destinations/:destinationId`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary.
     * @param destinationId - UUID of the payment destination to update.
     * @param input - Updated payment destination details — see {@link PaymentDestinationInput}.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Object containing the updated {@link PaymentDestination}.
     *
     * @example
     * const { payment_destination } = await business.updatePaymentDestination(
     *   session, "assoc-uuid", "ben-uuid", "dest-uuid",
     *   { method: "BANK", is_primary: false, country_iso: "ZA", account_number: "9999999999" }
     * );
     */
    updatePaymentDestination(
      session: Session,
      associationId: string,
      id: string,
      destinationId: string,
      input: PaymentDestinationInput,
      signal?: AbortSignal,
    ): Promise<{ payment_destination: PaymentDestination }> {
      return call<{ payment_destination: PaymentDestination }>(doer, {
        method: "PUT",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}/payment-destinations/${encodeURIComponent(destinationId)}`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    /**
     * Permanently delete a payment destination from a beneficiary.
     *
     * If the deleted destination was the primary, another destination must be
     * promoted via {@link setPaymentDestinationPrimary}.
     *
     * `DELETE /v1/business/beneficiaries/:associationId/:id/payment-destinations/:destinationId`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary.
     * @param destinationId - UUID of the payment destination to delete.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Empty object `{}` on success.
     *
     * @example
     * await business.deletePaymentDestination(session, "assoc-uuid", "ben-uuid", "dest-uuid");
     */
    deletePaymentDestination(
      session: Session,
      associationId: string,
      id: string,
      destinationId: string,
      signal?: AbortSignal,
    ): Promise<Record<string, never>> {
      return call<Record<string, never>>(doer, {
        method: "DELETE",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}/payment-destinations/${encodeURIComponent(destinationId)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Mark a payment destination as the primary for a beneficiary.
     *
     * Only one destination per beneficiary can be primary at a time.
     * The previously primary destination will be demoted automatically.
     *
     * `PUT /v1/business/beneficiaries/:associationId/:id/payment-destinations/:destinationId/primary`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association the beneficiary belongs to.
     * @param id - UUID of the beneficiary.
     * @param destinationId - UUID of the payment destination to promote to primary.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Empty object `{}` on success.
     *
     * @example
     * await business.setPaymentDestinationPrimary(session, "assoc-uuid", "ben-uuid", "dest-uuid");
     */
    setPaymentDestinationPrimary(
      session: Session,
      associationId: string,
      id: string,
      destinationId: string,
      signal?: AbortSignal,
    ): Promise<Record<string, never>> {
      return call<Record<string, never>>(doer, {
        method: "PUT",
        path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(id)}/payment-destinations/${encodeURIComponent(destinationId)}/primary`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Fetch the payment connectors available for a specific beneficiary and payment method.
     *
     * A **connector** is a provider-level integration (e.g. a specific mobile money
     * operator or bank gateway) that can execute a payout. Use the returned
     * `connector_id` when creating a crypto/MOMO payment destination.
     *
     * `GET /v1/business/beneficiaries/getAvailableConnectors/:associationId/:beneficiaryId/:method`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association.
     * @param beneficiaryId - UUID of the beneficiary to check connectors for.
     * @param method - Payment method to query connectors for (e.g. `"MOMO"`, `"CRYPTO"`).
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns {@link ConnectorsResult} containing the nested array of {@link Connector} objects.
     *
     * @example
     * const result = await business.getAvailableConnectors(session, "assoc-uuid", "ben-uuid", "MOMO");
     * const connector = result.connectors.connectors[0];
     * console.log(connector.name, connector.countryISO);
     */
    getAvailableConnectors(
      session: Session,
      associationId: string,
      beneficiaryId: string,
      method: PaymentMethod,
      signal?: AbortSignal,
    ): Promise<ConnectorsResult> {
      return call<ConnectorsResult>(doer, {
        method: "GET",
        path: `/v1/business/beneficiaries/getAvailableConnectors/${encodeURIComponent(associationId)}/${encodeURIComponent(beneficiaryId)}/${encodeURIComponent(method)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },
  };
}
