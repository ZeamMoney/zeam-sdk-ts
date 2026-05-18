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
    /**
     * List all assets available to the business.
     *
     * Returns the full {@link Asset} records including network details,
     * decimals, and contract/issuer addresses.
     *
     * `GET /v1/business/asset`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Array of all {@link Asset} records.
     *
     * @example
     * const assets = await business.listAssets(session);
     * console.log(assets.map(a => a.symbol));
     */
    listAssets(session: Session, signal?: AbortSignal): Promise<Asset[]> {
      return call<Asset[]>(doer, {
        method: "GET",
        path: "/v1/business/asset",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Fetch the full details of a single asset by its UUID.
     *
     * `GET /v1/business/asset/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param id - UUID of the asset to retrieve.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns The matching {@link Asset}.
     *
     * @example
     * const asset = await business.getAssetById(session, "asset-uuid");
     * console.log(asset.decimals);
     */
    getAssetById(session: Session, id: string, signal?: AbortSignal): Promise<Asset> {
      return call<Asset>(doer, {
        method: "GET",
        path: `/v1/business/asset/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * List all assets in their lightweight DTO form.
     *
     * {@link AssetDTO} is a slimmed-down view that includes image URLs,
     * making it suitable for display in UIs without the full chain details.
     *
     * `GET /v1/business/asset/dto`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Array of {@link AssetDTO} records.
     *
     * @example
     * const dtos = await business.listAssetDTOs(session);
     * console.log(dtos[0].imageUrl);
     */
    listAssetDTOs(session: Session, signal?: AbortSignal): Promise<AssetDTO[]> {
      return call<AssetDTO[]>(doer, {
        method: "GET",
        path: "/v1/business/asset/dto",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Fetch the lightweight DTO for a single asset by its UUID.
     *
     * `GET /v1/business/asset/dto/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param id - UUID of the asset to retrieve.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns The matching {@link AssetDTO}.
     *
     * @example
     * const dto = await business.getAssetDTOById(session, "asset-uuid");
     * console.log(dto.networkImageUrl);
     */
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
