import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { MAX_TOKEN_ID_SCAN, NFT_ABI, NFT_ADDRESS } from "@/config/contracts";
import { parseEventTitle, type EventDetails, type ParsedEventInfo } from "@/hooks/useListings";
import type { Abi } from "viem";
import { baseSepolia } from "viem/chains";

export interface TicketCategory {
  tokenId: number;
  maxSupply: bigint;
  eventDetails?: EventDetails;
  parsedEvent?: ParsedEventInfo;
}

/**
 * Menemukan SEMUA kategori tiket yang pernah dibuat on-chain.
 *
 * `TicketNFT.createTicketCategory` memakai counter global (`_nextTokenId`, mulai
 * dari 1) yang terus naik untuk SETIAP kategori dari SEMUA event. Jadi event
 * kedua memakai tokenId 4,5,6 — bukan 1,2,3. Daftar tokenId yang di-hardcode
 * membuat tiket dari event mana pun setelah yang pertama menjadi tidak terlihat
 * meskipun NFT-nya benar-benar dimiliki user on-chain.
 *
 * Karena tokenId berurutan tanpa lubang, kita probe `maxSupply(tokenId)` dari 1
 * sampai MAX_TOKEN_ID_SCAN — kategori yang ada pasti punya maxSupply > 0.
 * Semua probe digabung jadi satu multicall, jadi biayanya tetap 1 round-trip RPC.
 */
export function useTokenCatalog() {
  const probeContracts = useMemo(
    () =>
      Array.from({ length: MAX_TOKEN_ID_SCAN }, (_, i) => ({
        address: NFT_ADDRESS,
        abi: NFT_ABI as Abi,
        functionName: "maxSupply" as const,
        args: [BigInt(i + 1)] as const,
        chainId: baseSepolia.id,
      })),
    []
  );

  const { data: supplyData, isLoading: isProbing } = useReadContracts({
    contracts: probeContracts,
    query: {
      // Kategori baru jarang dibuat — cache lama sudah cukup.
      staleTime: 60_000,
    },
  });

  const tokenIds = useMemo(() => {
    if (!supplyData) return [];
    const ids: number[] = [];
    for (let i = 0; i < supplyData.length; i++) {
      const res = supplyData[i];
      if (res?.status === "success" && (res.result as bigint) > BigInt(0)) {
        ids.push(i + 1);
      }
    }
    return ids;
  }, [supplyData]);

  // Ambil metadata event untuk tiap kategori yang benar-benar ada.
  const detailContracts = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        address: NFT_ADDRESS,
        abi: NFT_ABI as Abi,
        functionName: "eventDetails" as const,
        args: [BigInt(tokenId)] as const,
        chainId: baseSepolia.id,
      })),
    [tokenIds]
  );

  const { data: detailData, isLoading: isLoadingDetails } = useReadContracts({
    contracts: detailContracts,
    query: {
      enabled: tokenIds.length > 0,
      staleTime: 60_000,
    },
  });

  const categories: TicketCategory[] = useMemo(
    () =>
      tokenIds.map((tokenId, index) => {
        const res = detailData?.[index];
        const raw =
          res?.status === "success"
            ? (res.result as unknown as [string, string, string, string, string, `0x${string}`])
            : null;

        const eventDetails = raw
          ? {
              title: raw[0],
              venue: raw[1],
              date: raw[2],
              city: raw[3],
              category: raw[4],
              creator: raw[5],
            }
          : undefined;

        return {
          tokenId,
          maxSupply: (supplyData?.[tokenId - 1]?.result as bigint) ?? BigInt(0),
          eventDetails,
          parsedEvent: eventDetails ? parseEventTitle(eventDetails.title) : undefined,
        };
      }),
    [tokenIds, detailData, supplyData]
  );

  return {
    tokenIds,
    categories,
    isLoading: isProbing || (tokenIds.length > 0 && isLoadingDetails),
  };
}
