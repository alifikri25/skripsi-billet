"use client";

import { Users, ArrowUpRight, MapPin } from "lucide-react";
import { formatIDRX, truncateAddress } from "@/lib/format";
import type { ListingWithId } from "@/hooks/useListings";
import { useRouter } from "next/navigation";

interface EventCardProps {
  listing: ListingWithId;
  /** All listings that belong to this same event (for grouped display) */
  groupedListings?: ListingWithId[];
  onBuy?: (listing: ListingWithId) => void;
}

export function EventCard({ listing, groupedListings, onBuy }: EventCardProps) {
  const router = useRouter();
  const parsed = listing.parsedEvent;
  const eventName = parsed?.eventName || listing.eventDetails?.title || `Event #${listing.tokenId.toString()}`;
  const ticketClass = parsed?.ticketClass || "Reguler";
  const venue = listing.eventDetails?.venue;
  const date = listing.eventDetails?.date;

  // If grouped, show the lowest price across all classes
  const allListings = groupedListings && groupedListings.length > 0 ? groupedListings : [listing];
  const lowestPrice = allListings.reduce(
    (min, l) => (l.pricePerUnit < min ? l.pricePerUnit : min),
    allListings[0].pricePerUnit
  );
  const totalRemaining = allListings.reduce((sum, l) => sum + Number(l.amount), 0);
  const classCount = allListings.length;
  const isGrouped = classCount > 1;

  // Navigate to event detail page using the first listing's tokenId as group key
  const handleClick = () => {
    if (!listing.active) return;
    // Use parsedEvent's eventName as a URL-friendly key to find group on detail page
    const eventKey = listing.eventDetails?.venue && listing.eventDetails?.date
      ? encodeURIComponent(`${eventName}__${listing.eventDetails.venue}__${listing.eventDetails.date}`)
      : listing.listingId.toString();
    router.push(`/events/${eventKey}`);
  };

  return (
    <div
      className="group relative border border-hairline bg-canvas-elevated overflow-hidden hover:border-primary transition-all duration-300 cursor-pointer flex flex-col justify-between"
      onClick={handleClick}
      id={`event-card-${listing.listingId}`}
    >
      {/* ─── Category Gradient Header ───────── */}
      <div className="h-28 bg-radial-[circle_at_center] from-primary/10 via-neutral-900 to-neutral-950 relative overflow-hidden shrink-0 border-b border-hairline">
        {/* Event Name */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="font-display font-bold text-base text-white truncate leading-tight">
            {eventName}
          </h3>
        </div>

        {/* Resale badge */}
        {listing.isResale && (
          <div className="absolute top-4 right-4">
            <span className="px-2 py-0.5 border border-hairline bg-canvas text-body font-caption-uppercase text-[9px] tracking-wider">
              RESALE
            </span>
          </div>
        )}

        {/* Class count badge */}
        {isGrouped && (
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center px-2.5 py-0.5 border border-primary/20 bg-primary/10 font-caption-uppercase text-[9px] tracking-wider text-primary">
              {classCount} KELAS TIKET
            </span>
          </div>
        )}
        {!isGrouped && (
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center px-2.5 py-0.5 border border-primary/20 bg-primary/10 font-caption-uppercase text-[9px] tracking-wider text-primary">
              {ticketClass}
            </span>
          </div>
        )}
      </div>

      {/* ─── Content Section ───────────────────────────── */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">

        {/* Venue & Date */}
        {(venue || date) && (
          <div className="flex items-center gap-3 text-[11px] text-body font-body-sm">
            {venue && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-primary shrink-0" />
                {venue}
              </span>
            )}
            {date && <span className="text-muted shrink-0">{date}</span>}
          </div>
        )}

        {/* Price display */}
        <div className="space-y-1">
          <p className="font-caption-uppercase text-[9px] text-body tracking-wider">
            {isGrouped ? "MULAI DARI" : "HARGA PER TIKET"}
          </p>
          <p className="font-title-md text-lg text-white">
            {formatIDRX(lowestPrice)}
          </p>
        </div>

        {/* Remaining amount details */}
        <div className="flex items-center gap-4 font-body-sm text-[13px] text-body">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>
              <strong className="text-white">{totalRemaining}</strong> tersisa
            </span>
          </div>
        </div>

        {/* Seller Info + Detail Action CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-hairline">
          <div>
            <p className="font-caption-uppercase text-[8px] text-muted tracking-wider">
              {listing.isResale ? "PENJUAL SEC" : "ORGANIZER"}
            </p>
            <p className="font-mono text-xs text-body">
              {truncateAddress(listing.seller)}
            </p>
          </div>

          {listing.active && (
            <div className="flex items-center gap-1 font-caption-uppercase text-[11px] tracking-wider text-white group-hover:text-primary transition-colors">
              LIHAT
              <ArrowUpRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          )}
        </div>
      </div>

      {/* Inactive state overlay */}
      {!listing.active && (
        <div className="absolute inset-0 bg-canvas/80 flex items-center justify-center">
          <span className="px-4 py-2 border border-hairline bg-canvas-elevated text-body font-caption-uppercase text-[11px] tracking-wider">
            LISTING DITUTUP
          </span>
        </div>
      )}
    </div>
  );
}
