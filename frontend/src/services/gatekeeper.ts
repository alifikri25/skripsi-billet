import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { NFT_ABI, NFT_ADDRESS } from '@/config/contracts'

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

export interface TicketHolder {
  name: string;
  /** Hash NIK (keccak256, bytes32). NIK asli tidak pernah disimpan on-chain. */
  nikHash: `0x${string}`;
  registered: boolean;
  used: boolean;
}

export async function getHoldersFromBlockchain(
  walletAddress: string,
  tokenId: number
): Promise<TicketHolder[]> {
  try {
    const data = await publicClient.readContract({
      address: NFT_ADDRESS,
      abi: NFT_ABI,
      functionName: 'getTicketHolders',
      args: [walletAddress as `0x${string}`, BigInt(tokenId)],
    }) as TicketHolder[]

    return data.map((item) => ({
      name: item.name,
      nikHash: item.nikHash,
      registered: item.registered,
      used: item.used,
    }))

  } catch (error) {
    console.error("Gagal kueri data blockchain:", error)
    throw error
  }
}
