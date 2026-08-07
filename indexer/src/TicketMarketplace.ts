import { ponder } from "ponder:registry";
import { listing, sale } from "ponder:schema";

// ─── Handler: TicketListed ──────────────────────────────────────────────────

/**
 * Dipanggil setiap kali organizer/user mendaftarkan tiket untuk dijual.
 * Membuat record baru di tabel `listing`.
 */
ponder.on("TicketMarketplace:TicketListed", async ({ event, context }): Promise<void> => {
  const { db } = context;

  await db.insert(listing).values({
    id: event.args.listingId.toString(),
    seller: event.args.seller.toLowerCase(),
    tokenId: event.args.tokenId,
    amount: event.args.amount,
    pricePerUnit: event.args.pricePerUnit,
    isResale: event.args.isResale,
    active: true,
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
  });
});

// ─── Handler: TicketSold ────────────────────────────────────────────────────

/**
 * Dipanggil setiap kali tiket berhasil dibeli.
 * 1. Mencatat transaksi ke tabel `sale`.
 * 2. Mengupdate sisa amount dan status `active` di tabel `listing`.
 */
ponder.on("TicketMarketplace:TicketSold", async ({ event, context }): Promise<void> => {
  const { db } = context;

  // 1. Catat riwayat penjualan
  await db.insert(sale).values({
    id: `${event.args.listingId}-${event.transaction.hash}-${event.log.logIndex}`,
    listingId: event.args.listingId.toString(),
    buyer: event.args.buyer.toLowerCase(),
    amount: event.args.amount,
    totalPrice: event.args.totalPrice,
    soldAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });

  // 2. Update listing: kurangi amount, set inactive jika habis
  const currentListing = await db.find(listing, {
    id: event.args.listingId.toString(),
  });

  if (currentListing) {
    const remainingAmount = currentListing.amount - event.args.amount;
    await db
      .update(listing, { id: event.args.listingId.toString() })
      .set({
        amount: remainingAmount,
        active: remainingAmount > 0n,
      });
  }
});

// ─── Handler: ListingCancelled ──────────────────────────────────────────────

/**
 * Dipanggil saat seller membatalkan listing.
 * Mengubah status listing menjadi inactive.
 */
ponder.on("TicketMarketplace:ListingCancelled", async ({ event, context }): Promise<void> => {
  const { db } = context;

  await db
    .update(listing, { id: event.args.listingId.toString() })
    .set({ active: false });
});
