import { http, createConfig } from 'wagmi'
import { base, baseSepolia, mainnet } from 'wagmi/chains'
import { walletConnect, injected } from 'wagmi/connectors'

export const config = createConfig({
  // `mainnet` disertakan HANYA agar ConnectKit dapat me-resolve ENS name/avatar
  // milik wallet yang terhubung. Tanpa transport chain 1, viem fallback ke RPC
  // default `https://eth.merkle.io` yang memblokir request browser (CORS) →
  // membanjiri console dengan error. Transport di bawah mengarah ke RPC mainnet
  // yang CORS-friendly sehingga lookup ENS berhasil (dan diam saat address tak punya ENS).
  chains: [base, baseSepolia, mainnet],
  connectors: [
    injected(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'dummy_project_id' }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC || 'https://ethereum-rpc.publicnode.com'),
  },
})
