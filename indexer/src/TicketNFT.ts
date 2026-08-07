import { ponder } from "ponder:registry";
import { checkIn } from "ponder:schema";

// ─── Handler: TicketCheckedIn ───────────────────────────────────────────────

/**
 * Dipanggil saat gatekeeper melakukan check-in tiket pengunjung di gerbang.
 * Mencatat aktivitas check-in ke tabel `checkIn`.
 */
ponder.on("TicketNFT:TicketCheckedIn", async ({ event, context }): Promise<void> => {
  const { db } = context;

  await db.insert(checkIn).values({
    id: `${event.args.from}-${event.args.tokenId}-${event.args.index}-${event.transaction.hash}`,
    holder: event.args.from.toLowerCase(),
    tokenId: event.args.tokenId,
    holderIndex: event.args.index,
    checkedInAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});
