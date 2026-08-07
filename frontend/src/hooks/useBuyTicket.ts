import { useWriteContract, usePublicClient, useAccount } from 'wagmi'
import { IDRX_ABI, IDRX_ADDRESS, MARKETPLACE_ABI, MARKETPLACE_ADDRESS } from '@/config/contracts'
import { parseEther } from 'viem'
import { useState } from 'react'

export function useBuyTicket() {
  const [txState, setTxState] = useState<'idle' | 'approving' | 'buying' | 'success'>('idle')

  const { writeContractAsync: writeContract } = useWriteContract()
  const publicClient = usePublicClient()
  const { address } = useAccount()

  const executePurchase = async (
    listingId: bigint,
    amount: number,
    totalPrice: string,
    niks: `0x${string}`[],
    names: string[]
  ) => {
    try {
      if (!publicClient) throw new Error("Public Client is not available")
      if (!address) throw new Error("Wallet belum terhubung")

      setTxState('approving')
      const approveHash = await writeContract({
        address: IDRX_ADDRESS,
        abi: IDRX_ABI,
        functionName: 'approve',
        args: [MARKETPLACE_ADDRESS, parseEther(totalPrice)],
      })

      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      setTxState('buying')
      await publicClient.simulateContract({
        account: address,
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'buyTicket',
        args: [listingId, BigInt(amount), niks, names],
      })

      const buyHash = await writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'buyTicket',
        args: [listingId, BigInt(amount), niks, names],
      })

      await publicClient.waitForTransactionReceipt({ hash: buyHash })

      setTxState('success')
    } catch (error) {
      setTxState('idle')
      throw error
    }
  }

  return { executePurchase, txState }
}
