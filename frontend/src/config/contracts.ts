import TicketMarketplaceABI from './abi/TicketMarketplace.json'
import TicketNFTABI from './abi/TicketNFT.json'
import { parseAbi } from 'viem'

export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const NFT_ADDRESS = (process.env.NEXT_PUBLIC_NFT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const IDRX_ADDRESS = (process.env.NEXT_PUBLIC_IDRX_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

/**
 * Batas atas pemindaian tokenId kategori tiket.
 *
 * tokenId dialokasikan berurutan mulai dari 1 oleh `TicketNFT._nextTokenId` dan
 * dibagi lintas SEMUA event, sehingga tidak bisa di-hardcode per event.
 * `useTokenCatalog` memindai 1..MAX_TOKEN_ID_SCAN untuk menemukan kategori yang
 * benar-benar ada. Naikkan nilainya kalau jumlah kategori mendekati batas ini.
 */
export const MAX_TOKEN_ID_SCAN = 60;

/**
 * Parameter pemindaian listing marketplace.
 *
 * `_nextListingId` di TicketMarketplace bersifat private (tak ada getter) dan
 * naik SATU untuk setiap listing baru — termasuk setiap resale. Jadi jumlah
 * listing hanya bertambah seiring waktu dan tidak boleh dibatasi angka tetap.
 *
 * Karena listingId berurutan dari 0 tanpa lubang, `useListings` memakai probe
 * dua tahap: sampel tiap LISTING_SCAN_STRIDE untuk menemukan checkpoint terisi
 * paling tinggi, lalu baca rentang penuh sampai batas itu saja.
 */
export const LISTING_SCAN_STRIDE = 32;
export const LISTING_SCAN_CHECKPOINTS = 24; // jangkauan: 32 * 24 = 768 listing

export const MARKETPLACE_ABI = TicketMarketplaceABI
export const NFT_ABI = TicketNFTABI

export const IDRX_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
])
