import { useCallback, useMemo } from "react";
import { useReadContracts } from "wagmi";
import {
  LISTING_SCAN_CHECKPOINTS,
  LISTING_SCAN_STRIDE,
  MARKETPLACE_ABI,
  MARKETPLACE_ADDRESS,
  NFT_ABI,
  NFT_ADDRESS,
} from "@/config/contracts";
import type { Abi } from "viem";
import { baseSepolia } from "viem/chains";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface Listing {
  seller: `0x${string}`;
  tokenId: bigint;
  amount: bigint;
  pricePerUnit: bigint;
  originalPrice: bigint;
  active: boolean;
  isResale: boolean;
}

export interface EventDetails {
  title: string;
  venue: string;
  date: string;
  city: string;
  category: string;
  creator: `0x${string}`;
}

/**
 * Parsed event info extracted from the structured title format:
 * "Event Name | Ticket Class | Description | Terms"
 */
export interface ParsedEventInfo {
  eventName: string;
  ticketClass: string;
  description: string;
  terms?: string;
}

/**
 * Parse the on-chain title field into structured event info.
 * Format: "Event Name | Ticket Class | Description | Terms"
 * Fallback: If no delimiter is found, treats the whole string as the event name.
 */
export function parseEventTitle(rawTitle: string): ParsedEventInfo {
  const parts = rawTitle.split(" | ");
  const desc = parts[2]?.trim() || "";
  const rawTerms = parts[3]?.trim() || "";
  return {
    eventName: parts[0]?.trim() || rawTitle,
    ticketClass: parts[1]?.trim() || "Reguler",
    description: desc === "—" ? "" : desc,
    terms: rawTerms === "—" ? "" : rawTerms,
  };
}

export interface ListingWithId extends Listing {
  listingId: number;
  eventDetails?: EventDetails;
  parsedEvent?: ParsedEventInfo;
}

/**
 * Fetches all listings from the TicketMarketplace smart contract.
 * Filters for active ones, enriching each with dynamic on-chain metadata.
 *
 * Rentang pemindaian ditentukan otomatis, bukan konstanta. Setiap resale
 * membuat listingId baru selamanya, jadi batas tetap (dulu 20) akan membuat
 * listing baru hilang diam-diam begitu ambangnya terlampaui.
 */
export function useListings() {
  // ── Tahap 1: probe jarang untuk menemukan sampai mana listing terisi ──────
  // listingId berurutan dari 0 tanpa lubang, jadi kalau checkpoint k terisi,
  // semua id di bawah k * STRIDE pasti terisi juga.
  const checkpointContracts = useMemo(
    () =>
      Array.from({ length: LISTING_SCAN_CHECKPOINTS }, (_, i) => ({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI as Abi,
        functionName: "getListing" as const,
        args: [BigInt(i * LISTING_SCAN_STRIDE)] as const,
        chainId: baseSepolia.id,
      })),
    []
  );

  const { data: checkpointData, refetch: refetchCheckpoints } = useReadContracts({
    contracts: checkpointContracts,
    query: {
      refetchInterval: 30_000,
    },
  });

  // Checkpoint terisi paling tinggi menentukan batas atas pembacaan penuh.
  const scanCount = useMemo(() => {
    let highest = 0;
    if (checkpointData) {
      for (let i = 0; i < checkpointData.length; i++) {
        const res = checkpointData[i];
        if (res?.status === "success" && res.result) {
          const seller = (res.result as unknown as Listing).seller;
          if (seller && seller !== ZERO_ADDRESS) highest = i;
        }
      }
    }
    // Baca satu stride penuh melewati checkpoint terakhir yang terisi, karena
    // ujung sebenarnya ada di antara checkpoint itu dan checkpoint berikutnya.
    return (highest + 1) * LISTING_SCAN_STRIDE;
  }, [checkpointData]);

  // ── Tahap 2: baca rentang penuh 0..scanCount-1 ───────────────────────────
  const contracts = useMemo(
    () =>
      Array.from({ length: scanCount }, (_, i) => ({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI as Abi,
        functionName: "getListing" as const,
        args: [BigInt(i)] as const,
        chainId: baseSepolia.id,
      })),
    [scanCount]
  );

  const { data, isLoading, error, refetch: refetchListings } = useReadContracts({
    contracts,
    query: {
      refetchInterval: 15_000, // refresh every 15s
    },
  });

  // Pembelian/resale bisa menggeser ujung rentang, jadi segarkan keduanya.
  const refetch = useCallback(() => {
    refetchCheckpoints();
    return refetchListings();
  }, [refetchCheckpoints, refetchListings]);

  // Parse results and filter active listings
  const listings: ListingWithId[] = [];

  if (data) {
    for (let i = 0; i < data.length; i++) {
      const result = data[i];
      if (result.status === "success" && result.result) {
        const listing = result.result as unknown as Listing;
        // Skip empty/zero listings (seller is zero address)
        if (
          listing.seller !== ZERO_ADDRESS &&
          listing.amount > BigInt(0)
        ) {
          listings.push({ ...listing, listingId: i });
        }
      }
    }
  }

  const activeListingsRaw = listings.filter((l) => l.active);

  // Extract token IDs from raw active listings to fetch metadata
  const activeTokenIds = activeListingsRaw.map((l) => l.tokenId);

  // =========================================================================
  // LIMITASI BACA N+1 RPC (THESIS/POC NOTICE):
  // Hook ini melakukan query paralel `eventDetails` langsung dari RPC node 
  // on-chain untuk setiap listing aktif. Ini menciptakan overhead RPC (N+1 read).
  // Pada lingkungan skala produksi komersial, data ini harus diproses 
  // menggunakan Graph/Ponder Indexer demi performa yang optimal.
  // =========================================================================
  const eventDetailsCalls = activeTokenIds.map((tokenId) => ({
    address: NFT_ADDRESS,
    abi: NFT_ABI as Abi,
    functionName: "eventDetails" as const,
    args: [tokenId] as const,
    chainId: baseSepolia.id,
  }));

  const { data: eventDetailsData, isLoading: isLoadingDetails } = useReadContracts({
    contracts: eventDetailsCalls,
    query: {
      enabled: activeTokenIds.length > 0,
      refetchInterval: 15_000,
    },
  });

  const activeListingsEnriched: ListingWithId[] = activeListingsRaw.map((listing, index) => {
    const detailsResult = eventDetailsData?.[index];
    const details = detailsResult?.status === "success"
      ? (detailsResult.result as unknown as [string, string, string, string, string, `0x${string}`])
      : null;

    const eventDetails = details
      ? {
          title: details[0],
          venue: details[1],
          date: details[2],
          city: details[3],
          category: details[4],
          creator: details[5],
        }
      : undefined;

    return {
      ...listing,
      eventDetails,
      parsedEvent: eventDetails ? parseEventTitle(eventDetails.title) : undefined,
    };
  });

  const primaryListings = activeListingsEnriched.filter((l) => !l.isResale);
  const resaleListings = activeListingsEnriched.filter((l) => l.isResale);

  return {
    allListings: listings,
    activeListings: activeListingsEnriched,
    primaryListings,
    resaleListings,
    isLoading: isLoading || (activeTokenIds.length > 0 && isLoadingDetails),
    error,
    refetch,
  };
}
