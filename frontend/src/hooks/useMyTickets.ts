import { useAccount, useReadContracts } from "wagmi";
import { NFT_ABI, NFT_ADDRESS } from "@/config/contracts";
import { useTokenCatalog } from "@/hooks/useTokenCatalog";
import type { ParsedEventInfo } from "@/hooks/useListings";
import type { Abi } from "viem";
import { baseSepolia } from "viem/chains";

export interface TicketHolder {
  name: string;
  /** Hash NIK (keccak256, bytes32). NIK asli tidak pernah disimpan on-chain. */
  nikHash: `0x${string}`;
  registered: boolean;
  used: boolean;
}

export interface OwnedTicket {
  tokenId: number;
  balance: bigint;
  holders: TicketHolder[];
  /** Metadata event dari on-chain, dipakai untuk nama event & kelas tiket. */
  parsedEvent?: ParsedEventInfo;
}

/**
 * Fetches all tickets owned by the connected wallet.
 * Reads balanceOf and getTicketHolders for each token category yang benar-benar
 * ada on-chain (lihat useTokenCatalog) — bukan daftar tokenId statis, karena
 * tokenId terus bertambah setiap kali kategori event baru dibuat.
 */
export function useMyTickets() {
  const { address, isConnected } = useAccount();
  const { tokenIds, categories, isLoading: isLoadingCatalog } = useTokenCatalog();

  // Build multicall: for each tokenId → [balanceOf, getTicketHolders]
  const contracts = isConnected && address
    ? tokenIds.flatMap((tokenId) => [
        {
          address: NFT_ADDRESS,
          abi: NFT_ABI as Abi,
          functionName: "balanceOf" as const,
          args: [address, BigInt(tokenId)] as const,
          chainId: baseSepolia.id,
        },
        {
          address: NFT_ADDRESS,
          abi: NFT_ABI as Abi,
          functionName: "getTicketHolders" as const,
          args: [address, BigInt(tokenId)] as const,
          chainId: baseSepolia.id,
        },
      ])
    : [];

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: isConnected && !!address && tokenIds.length > 0,
      refetchInterval: 15_000,
    },
  });

  const tickets: OwnedTicket[] = [];

  if (data) {
    for (let i = 0; i < tokenIds.length; i++) {
      const balanceResult = data[i * 2];
      const holdersResult = data[i * 2 + 1];

      const balance =
        balanceResult?.status === "success"
          ? (balanceResult.result as bigint)
          : BigInt(0);

      const holders =
        holdersResult?.status === "success"
          ? (holdersResult.result as unknown as TicketHolder[])
          : [];

      if (balance > BigInt(0) || holders.length > 0) {
        tickets.push({
          tokenId: tokenIds[i],
          balance,
          holders,
          parsedEvent: categories[i]?.parsedEvent,
        });
      }
    }
  }

  return {
    tickets,
    isLoading: isLoadingCatalog || isLoading,
    error,
    isConnected,
    refetch,
  };
}
