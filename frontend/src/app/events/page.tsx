"use client";

import { useState, useMemo } from "react";
import { Loader2, Ticket, Search } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { EventCard } from "@/components/events/EventCard";
import { useListings, type ListingWithId } from "@/hooks/useListings";
import { groupListingsByEvent } from "@/lib/groupListings";

type FilterTab = "all" | "primary" | "resale";

const filterTabs: { id: FilterTab; label: string }[] = [
  { id: "all", label: "SEMUA TIKET" },
  { id: "primary", label: "PENJUALAN UTAMA" },
  { id: "resale", label: "PASAR SEKUNDER" },
];

export default function EventsPage() {
  const { activeListings, primaryListings, resaleListings, isLoading } =
    useListings();
  const [filter, setFilter] = useState<FilterTab>("all");

  const displayedListings =
    filter === "primary"
      ? primaryListings
      : filter === "resale"
        ? resaleListings
        : activeListings;

  // Group listings by event
  const groupedEvents = useMemo(
    () => groupListingsByEvent(displayedListings),
    [displayedListings]
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
                  BILLET CATALOGUE
                </span>
                <h1 className="font-display-md text-3xl sm:text-4xl uppercase tracking-tight text-white leading-none">
                  JELAJAHI EVENT
                </h1>
                <p className="font-body-sm text-[13px] text-body max-w-md leading-relaxed">
                  Temukan tiket acara yang aktif langsung dari organizer resmi maupun penawaran sekunder terverifikasi.
                </p>
              </div>

              {/* Stats badge */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 border border-hairline bg-canvas-elevated text-xs font-caption-uppercase tracking-wider">
                  <Ticket className="w-4 h-4 text-primary" />
                  <span className="text-white">
                    {groupedEvents.length} EVENT
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 border border-hairline bg-canvas-elevated text-xs font-caption-uppercase tracking-wider">
                  <span className="text-body">
                    {activeListings.length} LISTING
                  </span>
                </div>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 mt-8">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`
                    px-4 py-2 border font-caption-uppercase text-[11px] tracking-wider transition-all duration-200 cursor-pointer
                    ${filter === tab.id
                      ? "bg-primary border-primary text-white"
                      : "bg-canvas border-hairline text-body hover:text-white"
                    }
                  `}
                  id={`filter-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Listings Grid (Grouped) ────────────────────────── */}
        <section className="section-container py-12" id="events-grid">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 border border-hairline bg-canvas-elevated">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="font-body-sm text-sm text-body">Menyelaraskan saldo blockchain...</p>
            </div>
          ) : groupedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-hairline bg-canvas-elevated p-8">
              <div className="w-12 h-12 border border-white/10 bg-canvas flex items-center justify-center mb-4">
                <Search className="w-5 h-5 text-body" />
              </div>
              <h3 className="font-display-md text-xl uppercase tracking-tight text-white mb-2">
                BELUM ADA LISTING
              </h3>
              <p className="font-body-sm text-[13px] text-body max-w-xs leading-relaxed">
                {filter !== "all"
                  ? `Tidak ada listing ${filter === "primary" ? "Penjualan Utama" : "Pasar Sekunder"} yang aktif saat ini.`
                  : "Belum ada tiket yang tersedia di jaringan ini."}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {groupedEvents.map((group) => (
                <EventCard
                  key={group.key}
                  listing={group.listings[0]}
                  groupedListings={group.listings}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
