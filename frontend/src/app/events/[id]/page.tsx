"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Loader2, MapPin, Calendar, Users, Tag, ArrowLeft, Shield } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BuyTicketDialog } from "@/components/events/BuyTicketDialog";
import { useListings, type ListingWithId } from "@/hooks/useListings";
import { formatIDRX, truncateAddress } from "@/lib/format";
import Link from "next/link";

export default function EventDetailPage() {
  const params = useParams();
  const eventKey = decodeURIComponent(params.id as string);
  const { activeListings, isLoading, refetch } = useListings();
  const [selectedListing, setSelectedListing] = useState<ListingWithId | null>(null);

  // Find all listings that match this event key
  const eventListings = useMemo(() => {
    // Try matching by eventKey format: "EventName__Venue__Date"
    const parts = eventKey.split("__");
    if (parts.length === 3) {
      const [eventName, venue, date] = parts;
      return activeListings.filter((l) => {
        const parsed = l.parsedEvent;
        const name = parsed?.eventName || l.eventDetails?.title || "";
        const lVenue = l.eventDetails?.venue || "";
        const lDate = l.eventDetails?.date || "";
        return name === eventName && lVenue === venue && lDate === date;
      });
    }
    // Fallback: match by listingId
    const listingId = parseInt(eventKey);
    if (!isNaN(listingId)) {
      return activeListings.filter((l) => l.listingId === listingId);
    }
    return [];
  }, [activeListings, eventKey]);

  // Extract common event info from the first listing
  const firstListing = eventListings[0];
  const eventName = firstListing?.parsedEvent?.eventName || firstListing?.eventDetails?.title || "Event";
  const eventDescription = firstListing?.parsedEvent?.description || "";
  const eventTerms = firstListing?.parsedEvent?.terms || "";
  const venue = firstListing?.eventDetails?.venue || "—";
  const date = firstListing?.eventDetails?.date || "—";
  const city = firstListing?.eventDetails?.city || "—";
  const category = firstListing?.eventDetails?.category || "—";
  const creator = firstListing?.eventDetails?.creator || firstListing?.seller;

  const handleBuySuccess = () => {
    setSelectedListing(null);
    refetch();
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-white">
      <Navbar />

      <main className="flex-1 pb-24">
        {/* ─── Back Navigation ──────────────────────────── */}
        <div className="section-container pt-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-body hover:text-white transition-colors font-caption-uppercase text-[11px] tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            KEMBALI KE KATALOG
          </Link>
        </div>

        {isLoading ? (
          <div className="section-container py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="font-body-sm text-sm text-body">Memuat detail event dari blockchain...</p>
          </div>
        ) : eventListings.length === 0 ? (
          <div className="section-container py-20 flex flex-col items-center justify-center border border-hairline bg-canvas-elevated mt-8">
            <p className="font-body-sm text-sm text-body">Event tidak ditemukan atau listing sudah ditutup.</p>
            <Link
              href="/events"
              className="mt-4 px-6 py-2 bg-primary text-white font-caption-uppercase text-[11px] tracking-wider hover:bg-primary-active transition-colors"
            >
              JELAJAHI EVENT LAIN
            </Link>
          </div>
        ) : (
          <>
            {/* ─── Hero Banner ──────────────────────────────── */}
            <section className="relative overflow-hidden border-b border-hairline mt-6">
              <div className="absolute inset-0 bg-radial-[circle_at_top_right] from-primary/8 via-neutral-900 to-neutral-950" />
              <div className="section-container relative py-12 sm:py-16 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 border border-primary/20 bg-primary/10 font-caption-uppercase text-[9px] tracking-wider text-primary">
                    {category}
                  </span>
                  {eventListings.length > 1 && (
                    <span className="px-2.5 py-0.5 border border-hairline bg-canvas font-caption-uppercase text-[9px] tracking-wider text-body">
                      {eventListings.length} KELAS TIKET
                    </span>
                  )}
                </div>

                <h1 className="font-display-lg text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-white leading-tight">
                  {eventName}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-[12px] text-body font-body-sm">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    {date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {venue}, {city}
                  </span>
                  {creator && (
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      Organizer: {truncateAddress(creator)}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* ─── Content: Description (Left) + Tickets (Right) ─── */}
            <section className="section-container py-10">
              <div className="grid lg:grid-cols-12 gap-8">

                {/* Left: Description */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="border border-hairline bg-canvas-elevated p-6 sm:p-8 space-y-4">
                    <h2 className="font-display-md text-xl uppercase tracking-tight text-white">
                      DESKRIPSI
                    </h2>
                    {eventDescription ? (
                      <p className="font-body-sm text-[12px] text-body leading-relaxed whitespace-pre-line">
                        {eventDescription}
                      </p>
                    ) : (
                      <p className="font-body-sm text-[12px] text-muted leading-relaxed italic">
                        Penyelenggara belum menambahkan deskripsi untuk event ini.
                      </p>
                    )}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="border border-hairline bg-canvas-elevated p-6 sm:p-8 space-y-3">
                    <h2 className="font-display-md text-xl uppercase tracking-tight text-white">
                      SYARAT & KETENTUAN
                    </h2>
                    {eventTerms ? (
                      <ul className="text-[12px] text-body font-body-sm space-y-2 list-disc list-inside">
                        {eventTerms.split("\n").filter(t => t.trim() !== "").map((term, index) => (
                          <li key={index}>{term}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-body-sm text-[12px] text-muted leading-relaxed italic">
                        Penyelenggara belum menambahkan syarat & ketentuan untuk event ini.
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Ticket Classes */}
                <div className="lg:col-span-5 space-y-4">
                  <h2 className="font-display-md text-xl uppercase tracking-tight text-white">
                    PILIH TIKET
                  </h2>

                  {eventListings.map((listing) => {
                    const ticketClass = listing.parsedEvent?.ticketClass || "Reguler";
                    const remaining = Number(listing.amount);

                    return (
                      <div
                        key={listing.listingId}
                        className="border border-hairline bg-canvas-elevated p-5 space-y-4 hover:border-primary transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-primary" />
                            <span className="font-display font-bold text-base text-white uppercase tracking-tight">
                              {ticketClass}
                            </span>
                          </div>
                          {listing.isResale && (
                            <span className="px-2 py-0.5 border border-hairline bg-canvas text-body font-caption-uppercase text-[8px] tracking-wider">
                              RESALE
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-caption-uppercase text-[9px] text-body tracking-wider">HARGA</p>
                            <p className="font-title-md text-xl text-white">
                              {formatIDRX(listing.pricePerUnit)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-caption-uppercase text-[9px] text-body tracking-wider">SISA</p>
                            <div className="flex items-center gap-1 text-white">
                              <Users className="w-3.5 h-3.5 text-primary" />
                              <span className="font-display font-bold text-lg">{remaining}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedListing(listing);
                          }}
                          disabled={remaining === 0}
                          className="w-full py-3 bg-primary text-white font-caption-uppercase text-[11px] tracking-[1.4px] hover:bg-primary-active transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer border-none rounded-none font-bold"
                        >
                          {remaining === 0 ? "HABIS TERJUAL" : "BELI TIKET"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />

      {/* Buy Ticket Dialog */}
      {selectedListing && (
        <BuyTicketDialog
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onSuccess={handleBuySuccess}
        />
      )}
    </div>
  );
}
