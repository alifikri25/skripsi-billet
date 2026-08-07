import { onchainTable, index } from "ponder";

// ─── Tabel Listing Tiket ────────────────────────────────────────────────────

/**
 * Menyimpan semua listing tiket (primary + resale).
 * Ini adalah tabel utama yang dibaca oleh halaman "Daftar Tiket" di frontend.
 */
export const listing = onchainTable("listing", (t) => ({
  // Primary Key: listingId dari smart contract
  id: t.text().primaryKey(),

  // Data dari event TicketListed
  seller: t.text().notNull(),
  tokenId: t.bigint().notNull(),
  amount: t.bigint().notNull(),
  pricePerUnit: t.bigint().notNull(),
  isResale: t.boolean().notNull(),

  // Status listing (diupdate saat TicketSold / ListingCancelled)
  active: t.boolean().notNull().default(true),

  // Metadata tambahan
  createdAt: t.bigint().notNull(),       // block.timestamp saat listing dibuat
  blockNumber: t.bigint().notNull(),      // block number untuk referensi
}), (table) => ({
  // Index untuk mempercepat query filter
  activeIdx: index().on(table.active),
  tokenIdIdx: index().on(table.tokenId),
  sellerIdx: index().on(table.seller),
}));

// ─── Tabel Penjualan Tiket ──────────────────────────────────────────────────

/**
 * Menyimpan riwayat transaksi pembelian tiket.
 * Berguna untuk halaman "Riwayat Transaksi" dan analitik dashboard.
 */
export const sale = onchainTable("sale", (t) => ({
  // Primary Key: kombinasi listingId + buyer + txHash untuk keunikan
  id: t.text().primaryKey(),

  listingId: t.text().notNull(),
  buyer: t.text().notNull(),
  amount: t.bigint().notNull(),
  totalPrice: t.bigint().notNull(),

  // Metadata
  soldAt: t.bigint().notNull(),          // block.timestamp saat terjual
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
}), (table) => ({
  buyerIdx: index().on(table.buyer),
  listingIdIdx: index().on(table.listingId),
}));

// ─── Tabel Check-In Tiket ───────────────────────────────────────────────────

/**
 * Menyimpan riwayat check-in tiket di gerbang masuk.
 * Berguna untuk dashboard panitia dan statistik kehadiran.
 */
export const checkIn = onchainTable("check_in", (t) => ({
  // Primary Key: kombinasi dari + tokenId + index + txHash
  id: t.text().primaryKey(),

  holder: t.text().notNull(),           // address pemegang tiket
  tokenId: t.bigint().notNull(),
  holderIndex: t.bigint().notNull(),    // index di array TicketHolder

  // Metadata
  checkedInAt: t.bigint().notNull(),     // block.timestamp saat check-in
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
}), (table) => ({
  holderIdx: index().on(table.holder),
  tokenIdIdx: index().on(table.tokenId),
}));
