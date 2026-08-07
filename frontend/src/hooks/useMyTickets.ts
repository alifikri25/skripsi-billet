import { useAccount, useReadContracts } from "wagmi";
import { NFT_ABI, NFT_ADDRESS, SUPPORTED_TOKEN_IDS } from "@/config/contracts";
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
}

/**
 * Fetches all tickets owned by the connected wallet.
 * Reads balanceOf and getTicketHolders for each token category.
 */
export function useMyTickets() {
  const { address, isConnected } = useAccount();

  // Build multicall: for each tokenId → [balanceOf, getTicketHolders]
  const contracts = isConnected && address
    ? SUPPORTED_TOKEN_IDS.flatMap((tokenId) => [
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
      enabled: isConnected && !!address,
      refetchInterval: 15_000,
    },
  });

  const tickets: OwnedTicket[] = [];

  if (data) {
    for (let i = 0; i < SUPPORTED_TOKEN_IDS.length; i++) {
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
          tokenId: SUPPORTED_TOKEN_IDS[i],
          balance,
          holders,
        });
      }
    }
  }

  return {
    tickets,
    isLoading,
    error,
    isConnected,
    refetch,
  };
}
