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
    listAssociations(session: Session, signal?: AbortSignal): Promise<Association[]> {
      return call<Association[]>(doer, {
        method: "GET",
        path: "/v1/business/association/all",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

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
