import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { ApplicationRecord } from "../core/index.js";

export interface TransitionInput {
  reason?: string;
}

function transition(doer: Doer, id: string, action: string, input: TransitionInput | undefined, session: Session, signal?: AbortSignal): Promise<ApplicationRecord> {
  return call<ApplicationRecord>(doer, {
    method: "POST",
    path: `/v1/application/${encodeURIComponent(id)}/${action}`,
    session,
    requireTrack: Track.Business,
    body: input ?? {},
    signal,
  });
}

export function lifecycleMethods(doer: Doer) {
  return {
    submit(
      session: Session,
      id: string,
      input?: TransitionInput,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return transition(doer, id, "submit", input, session, signal);
    },

    approve(
      session: Session,
      id: string,
      input?: TransitionInput,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return transition(doer, id, "approve", input, session, signal);
    },

    reject(
      session: Session,
      id: string,
      input?: TransitionInput,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return transition(doer, id, "reject", input, session, signal);
    },

    suspend(
      session: Session,
      id: string,
      input?: TransitionInput,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return transition(doer, id, "suspend", input, session, signal);
    },

    resume(
      session: Session,
      id: string,
      input?: TransitionInput,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return transition(doer, id, "resume", input, session, signal);
    },

    revoke(
      session: Session,
      id: string,
      input?: TransitionInput,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return transition(doer, id, "revoke", input, session, signal);
    },
  };
}
