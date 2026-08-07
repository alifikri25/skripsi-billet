import type { ListingWithId } from "@/hooks/useListings";

/**
 * Group listings by event identity (name + venue + date).
 * Returns an array of grouped entries, each containing all listings for that event.
 */
export function groupListingsByEvent(listings: ListingWithId[]): { key: string; listings: ListingWithId[] }[] {
  const groups = new Map<string, ListingWithId[]>();

  for (const listing of listings) {
    const parsed = listing.parsedEvent;
    const eventName = parsed?.eventName || listing.eventDetails?.title || `Event-${listing.tokenId.toString()}`;
    const venue = listing.eventDetails?.venue || "";
    const date = listing.eventDetails?.date || "";
    const groupKey = `${eventName}__${venue}__${date}`;

    const group = groups.get(groupKey);
    if (!group) {
      groups.set(groupKey, [listing]);
    } else {
      group.push(listing);
    }
  }

  return Array.from(groups.entries()).map(([key, listings]) => ({ key, listings }));
}
