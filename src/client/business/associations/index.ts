import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export interface Association {
  id: string;
  associationName: string;
  associationTypeId: string;
  typeName: string;
  identityName: string;
  publicKey: string;
  signerId: string;
  creatorIdentityId: string;
  status: string;
  merchant: boolean;
  createdAt: string;
}

export function associationMethods(doer: Doer) {
  return {
    /**
     * List every association linked to the authenticated business identity.
     *
     * An **association** is a named grouping (e.g. a branch or subsidiary)
     * that owns wallets and beneficiaries.
     *
     * `GET /v1/business/association/all`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Array of all {@link Association} records for this business.
     *
     * @example
     * const associations = await business.listAssociations(session);
     * console.log(associations[0].associationName);
     */
    listAssociations(session: Session, signal?: AbortSignal): Promise<Association[]> {
      return call<Association[]>(doer, {
        method: "GET",
        path: "/v1/business/association/all",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Fetch a single association by its UUID.
     *
     * `GET /v1/business/association/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param id - UUID of the association to retrieve.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns The matching {@link Association}.
     *
     * @example
     * const assoc = await business.getAssociationById(session, "assoc-uuid");
     * console.log(assoc.typeName);
     */
    getAssociationById(
      session: Session,
      id: string,
      signal?: AbortSignal,
    ): Promise<Association> {
      return call<Association>(doer, {
        method: "GET",
        path: `/v1/business/association/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },
  };
}
