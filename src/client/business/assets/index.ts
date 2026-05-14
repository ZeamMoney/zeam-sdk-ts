import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetName: string;
  type: string;
  decimals: number;
  contractAddress: string;
  issuerAddress: string;
  networkID: string;
  networkName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDTO {
  assetID: string;
  name: string;
  symbol: string;
  contractAddress: string;
  issuerAddress: string;
  networkID: string;
  networkName: string;
  imageUrl: string;
  networkImageUrl: string;
}

export function assetMethods(doer: Doer) {
  return {
    listAssets(session: Session, signal?: AbortSignal): Promise<Asset[]> {
      return call<Asset[]>(doer, {
        method: "GET",
        path: "/v1/business/asset",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    getAssetById(session: Session, id: string, signal?: AbortSignal): Promise<Asset> {
      return call<Asset>(doer, {
        method: "GET",
        path: `/v1/business/asset/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    listAssetDTOs(session: Session, signal?: AbortSignal): Promise<AssetDTO[]> {
      return call<AssetDTO[]>(doer, {
        method: "GET",
        path: "/v1/business/asset/dto",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    getAssetDTOById(session: Session, id: string, signal?: AbortSignal): Promise<AssetDTO> {
      return call<AssetDTO>(doer, {
        method: "GET",
        path: `/v1/business/asset/dto/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },
  };
}
