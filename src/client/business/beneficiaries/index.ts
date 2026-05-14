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
  id: string;
  beneficiary_id: string;
  method: PaymentMethod;
  label: string;
  is_primary: boolean;
  is_zeam_account: boolean;
  country_iso: string;
  country_name: string;
  currency_code: string;
  region: string;
  // bank
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  sort_code: string;
  iban: string;
  swift_bic: string;
  branch_code: string;
  // mobile
  mobile_number: string;
  mobile_provider: string;
  // crypto
  network_id: string | null;
  network_name: string;
  asset_id: string | null;
  asset_symbol: string;
  wallet_address: string;
  connector_id: string | null;
  connector_name: string;
  created_at: string;
  updated_at: string;
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
  payment_destinations: PaymentDestination[];
  total: number;
}

export interface BeneficiaryIndividual {
  id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  date_of_birth: string | null;
  nationality: string;
  mobile_number: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface BeneficiaryBusiness {
  id: string;
  company_name: string;
  registration_number: string;
  country_of_registration: string;
  tax_id: string;
  industry: string;
  contact_person_name: string;
  contact_number: string;
  contact_email: string;
  registered_address: string;
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
  id: string;
  association_id: string;
  beneficiary_type: BeneficiaryType;
  reference: string;
  individual: BeneficiaryIndividual | null;
  business: BeneficiaryBusiness | null;
  payment_destinations: PaymentDestination[];
  addresses: unknown[];
  created_at: string;
  updated_at: string;
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
  beneficiary_ids: string[];
  success_count: number;
  failed_count: number;
  total: number;
  results: Array<{ beneficiary_id: string; index: number; success: boolean }>;
}

export interface BeneficiaryTags {
  tags: string[];
  suggested_tags: string[];
}

export interface BeneficiaryListParams {
  search?: string;
  beneficiary_type?: BeneficiaryType;
  payment_method?: PaymentMethod;
}

export interface BeneficiaryListResult {
  beneficiaries: Beneficiary[];
  total?: number;
}

export interface Connector {
  id: string;
  name: string;
  method: PaymentMethod;
  countryISO: string;
  [k: string]: unknown;
}

export interface ConnectorsResult {
  connectors: { connectors: Connector[] };
}

export function beneficiaryMethods(doer: Doer) {
  return {
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
