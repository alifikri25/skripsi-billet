import TicketMarketplaceABI from './abi/TicketMarketplace.json'
import TicketNFTABI from './abi/TicketNFT.json'
import { parseAbi } from 'viem'

export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const NFT_ADDRESS = (process.env.NEXT_PUBLIC_NFT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const IDRX_ADDRESS = (process.env.NEXT_PUBLIC_IDRX_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const SUPPORTED_TOKEN_IDS = [1, 2, 3];

export const MARKETPLACE_ABI = TicketMarketplaceABI
export const NFT_ABI = TicketNFTABI

export const IDRX_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
])
