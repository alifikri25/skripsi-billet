"use client";

import { Loader2, Wallet, Ticket, TicketCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TicketCard } from "@/components/tickets/TicketCard";
import { useMyTickets } from "@/hooks/useMyTickets";
import { getCategoryName } from "@/lib/format";
import { ConnectKitButton } from "connectkit";

export default function MyTicketsPage() {
  const { tickets, isLoading, isConnected } = useMyTickets();

  // Flatten all holder entries for total count
  const totalHolders = tickets.reduce(
    (acc, t) => acc + t.holders.filter((h) => h.registered).length,
    0
  );
  const usedCount = tickets.reduce(
    (acc, t) => acc + t.holders.filter((h) => h.registered && h.used).length,
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-white">
      <Navbar />

      <main className="flex-1 pb-24">
        {/* ─── Page Header ──────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-hairline">
          <div className="section-container pt-12 pb-8 relative">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div className="space-y-2">
                <span className="font-caption-uppercase text-[10px] text-primary tracking-wider">
                  USER TICKETS LIST
                </span>
                <h1 className="font-display-md text-3xl sm:text-4xl uppercase tracking-tight text-white leading-none">
                  TIKET SAYA
                </h1>
                <p className="font-body-sm text-[13px] text-body max-w-md leading-relaxed">
                  Kelola tiket acara yang Anda miliki. Cek status aktivasi untuk check-in atau daftarkan info pengunjung.
                </p>
              </div>

              {isConnected && totalHolders > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 border border-hairline bg-canvas-elevated text-xs font-caption-uppercase tracking-wider">
                    <Ticket className="w-4 h-4 text-primary" />
                    <span className="text-white">{totalHolders} TIKET</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 border border-hairline bg-canvas-elevated text-xs font-caption-uppercase tracking-wider">
                    <TicketCheck className="w-4 h-4 text-semantic-success" />
                    <span className="text-white">{usedCount} TERPAKAI</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Content Grid ──────────────────────────────────────── */}
        <section className="section-container py-12" id="my-tickets-grid">
          {!isConnected ? (
            /* Not Connected lock block */
            <div className="flex flex-col items-center justify-center py-20 text-center border border-hairline bg-canvas-elevated p-8">
              <div className="w-12 h-12 border border-white/10 bg-canvas flex items-center justify-center mb-4">
                <Wallet className="w-5 h-5 text-body" />
              </div>
              <h3 className="font-display-md text-xl uppercase tracking-tight text-white mb-2">
                DOMPET BELUM TERHUBUNG
              </h3>
              <p className="font-body-sm text-[13px] text-body max-w-xs mb-6 leading-relaxed">
                Hubungkan dompet Web3 Anda untuk memuat tiket digital yang Anda miliki secara on-chain.
              </p>
              <div className="flex justify-center">
                <ConnectKitButton />
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 border border-hairline bg-canvas-elevated">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="font-body-sm text-sm text-body">Memuat tiket dari blockchain...</p>
            </div>
          ) : totalHolders === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-center border border-hairline bg-canvas-elevated p-8">
              <div className="w-12 h-12 border border-white/10 bg-canvas flex items-center justify-center mb-4">
                <Ticket className="w-5 h-5 text-primary -rotate-45" />
              </div>
              <h3 className="font-display-md text-xl uppercase tracking-tight text-white mb-2">
                BELUM PUNYA TIKET
              </h3>
              <p className="font-body-sm text-[13px] text-body max-w-xs mb-6 leading-relaxed">
                Anda belum memiliki tiket terdaftar. Jelajahi event seru kami sekarang!
              </p>
              <Link href="/events" className="btn-primary">
                BELI TIKET PERTAMA <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          ) : (
            /* Ticket Grid categorized */
            <div className="space-y-12">
              {tickets.map((ticket) => {
                const registeredHolders = ticket.holders.filter((h) => h.registered);
                if (registeredHolders.length === 0) return null;

                return (
                  <div key={ticket.tokenId} className="space-y-4">
                    {/* Category Header */}
                    <div className="flex items-center gap-3 border-b border-hairline pb-2">
                      <h2 className="font-display-md text-xl uppercase tracking-tight text-white">
                        {getCategoryName(ticket.tokenId)}
                      </h2>
                      <span className="px-2 py-0.5 border border-hairline bg-canvas-elevated font-caption-uppercase text-[9px] tracking-wider text-body">
                        {registeredHolders.length} TIKET
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                      {registeredHolders.map((holder, idx) => {
                        const unusedRegisteredHolders = registeredHolders.filter((h) => !h.used);
                        const unusedIndex = holder.used ? -1 : unusedRegisteredHolders.indexOf(holder);

                        return (
                          <TicketCard
                            key={`${ticket.tokenId}-${idx}`}
                            tokenId={ticket.tokenId}
                            holder={holder}
                            index={idx}
                            balance={ticket.balance}
                            unusedIndex={unusedIndex}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
