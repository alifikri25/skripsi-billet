"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  Calendar,
  MapPin,
  Volume2,
  AlertCircle
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Grainient } from "@/components/ui/Grainient";
import { useListings, type ListingWithId } from "@/hooks/useListings";
import { formatIDRX } from "@/lib/format";
import { groupListingsByEvent } from "@/lib/groupListings";
import { toast } from "sonner";

// ─── Interfaces ──────────────────────────────────────────────────────────

interface RichEvent {
  key: string;
  title: string;
  category: string;
  city: string;
  date: string;
  venue: string;
  bannerGradient: string;
  lowestPrice: bigint;
  totalRemaining: number;
  classCount: number;
  isResale: boolean;
  listings: ListingWithId[];
}

// ─── Carousel Banners ────────────────────────────────────────────────────

const carouselBanners = [
  {
    id: 1,
    title: "Tulus: Retrospektif Tour 2026",
    tagline: "Hi, Kawan! Mau bernyanyi bersama?",
    desc: "Konser eksklusif merayakan 15 tahun perjalanan musik Tulus di Stadion Utama Gelora Bung Karno.",
    date: "12 Juli 2026",
    venue: "Stadion Utama GBK, Jakarta",
    category: "Musik",
    gradient: "from-red-950 via-neutral-900 to-black",
    badgeText: "TERPOPULER"
  },
  {
    id: 2,
    title: "Base Web3 Hackathon Indonesia",
    tagline: "Bangun dApp Masa Depan di Base L2",
    desc: "Hackathon 3 hari dengan bimbingan developer global. Total hadiah Rp 100 Juta dalam IDRX!",
    date: "15-18 Juni 2026",
    venue: "Gedung Sate IT Hub, Bandung",
    category: "Seminar",
    gradient: "from-blue-950 via-neutral-900 to-black",
    badgeText: "REKOMENDASI"
  },
  {
    id: 3,
    title: "Indonesia Badminton Open 2026",
    tagline: "Kembalinya Kejayaan Bulutangkis",
    desc: "Pertandingan bulutangkis tingkat dunia memperebutkan Piala Billet dan total hadiah Rp 250 Juta.",
    date: "22-26 Juli 2026",
    venue: "Istora Senayan, Jakarta",
    category: "Olahraga",
    gradient: "from-emerald-950 via-neutral-900 to-black",
    badgeText: "TIKET TERBATAS"
  }
];

export default function Home() {
  const { activeListings, isLoading, refetch } = useListings();
  const router = useRouter();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");

  // ─── Carousel Auto-Play ─────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % carouselBanners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // ─── Group & Filter Events ──────────────────────────────────────────────

  const allEvents = useMemo(() => {
    // Group listings by event identity (name + venue + date)
    const grouped = groupListingsByEvent(activeListings);

    return grouped.map(({ key, listings }): RichEvent => {
      const first = listings[0];
      const details = first.eventDetails;
      const parsed = first.parsedEvent;

      const lowestPrice = listings.reduce(
        (min, l) => (l.pricePerUnit < min ? l.pricePerUnit : min),
        listings[0].pricePerUnit
      );
      const totalRemaining = listings.reduce((sum, l) => sum + Number(l.amount), 0);

      return {
        key,
        title: parsed?.eventName || details?.title || `Tiket Resmi Billet`,
        category: details?.category || "Musik",
        city: details?.city || "Jakarta",
        date: details?.date || "28 Juni 2026",
        venue: details?.venue || "Billet Arena Base L2",
        bannerGradient: "from-red-950 to-neutral-900",
        lowestPrice,
        totalRemaining,
        classCount: listings.length,
        isResale: first.isResale,
        listings,
      };
    });
  }, [activeListings]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      const matchSearch =
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.venue.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory =
        selectedCategory === "Semua" || event.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [allEvents, searchQuery, selectedCategory]);

  // ─── Navigation ───────────────────────────────────────────────────────

  const handleEventClick = (event: RichEvent) => {
    router.push(`/events/${encodeURIComponent(event.key)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-white">
      <Navbar />

      <main className="flex-1 pb-24">
        {/* ─── Hero Section (Full-bleed Cinematic Editorial) ────────────── */}
        <section className="relative w-full overflow-hidden border-b border-hairline">
          {/* Main Visual Cinematic Container */}
          <div className="relative w-full h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] flex flex-col justify-center">

            {/* Background WebGL Grainient */}
            <div className="absolute inset-0 z-0 opacity-80 pointer-events-none">
              <Grainient
                color1="#fc3b10"
                color2="#ff4d4d"
                color3="#0a0202"
                timeSpeed={0.5}
                colorBalance={-0.1}
                warpStrength={3.0}
                warpFrequency={4.0}
                warpSpeed={1.5}
                warpAmplitude={35.0}
                blendAngle={45.0}
                blendSoftness={0.05}
                rotationAmount={500.0}
                noiseScale={2.0}
                grainAmount={0.16}
                grainScale={2.5}
                contrast={1.6}
                saturation={1.3}
                zoom={0.85}
              />
            </div>

            <div className="absolute inset-0 bg-linear-to-t from-canvas via-transparent to-transparent z-10 pointer-events-none" />

            <div className="section-container relative z-20 w-full flex flex-col">
              <span className="self-start font-caption-uppercase text-[12px] md:text-[14px] tracking-[3px] text-white bg-white/5 border border-white/20 px-4 py-1.5 w-fit block mb-4 md:mb-0 font-bold">
                DECENTRALIZED TICKETING PROTOCOL
              </span>

              <div className="max-w-5xl mx-auto flex flex-col items-center text-center mt-4">
                <h1 style={{ fontFamily: 'Roboto, sans-serif' }} className="text-[12vw] sm:text-[100px] md:text-[150px] lg:text-[180px] font-black leading-[0.8] uppercase tracking-[-0.04em] text-transparent bg-clip-text bg-linear-to-b from-white via-white to-white/40 pb-2">
                  BILLET
                </h1>

                <p style={{ fontFamily: 'Roboto, sans-serif' }} className="text-base sm:text-lg md:text-xl text-white/70 leading-relaxed max-w-3xl font-light tracking-wide mt-6">
                  Protokol tiket desentralisasi di jaringan Base. Membatasi ruang gerak pihak ketiga melalui sistem batas harga sekunder otomatis dan memastikan distribusi royalti <span className="text-white font-medium">on-chain</span> yang transparan.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-4 pt-8 mx-auto">
                <button
                  onClick={() => {
                    document.getElementById("events-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="btn-primary text-sm px-8 py-4"
                >
                  JELAJAHI EVENT
                </button>
                <Link
                  href="/creator"
                  className="btn-outline text-sm px-8 py-4"
                >
                  TERBITKAN TIKET
                </Link>
              </div>
            </div>

          </div>
        </section>
        {/* ─── Trackside Specs & Highlights (Ferrari Racing Cell Theme) ─── */}
        <section className="border-b border-hairline py-16 bg-canvas">
          <div className="section-container">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
              {[
                { pos: "01", title: "100% ON-CHAIN SECURE", desc: "Tiket dicetak sebagai NFT ERC-1155 yang tak dapat diduplikasi." },
                { pos: "02", title: "PRICE CEILING PROTECTION", desc: "Membatasi markup harga resale sekunder maksimal 1.1x secara otomatis." },
                { pos: "03", title: "RESALE ROYALTIES", desc: "Royalti mengalir otomatis kembali kepada kreator orisinil." },
                { pos: "04", title: "QR TICKET VERIFICATION", desc: "Sistem verifikasi instan di pintu masuk via scan QR cryptographic." }
              ].map((spec, i) => (
                <div key={i} className="flex flex-col space-y-3 justify-between">
                  <div className="font-number-display text-primary leading-none">
                    {spec.pos}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-caption-uppercase text-[11px] tracking-[1.1px] text-white">
                      {spec.title}
                    </h4>
                    <p className="font-body-sm text-[13px] text-body leading-normal">
                      {spec.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Interactive Carousel Specs Split ───────────────────────── */}
        <section className="section-container py-16">
          <div className="grid lg:grid-cols-12 gap-8 items-stretch">

            {/* Left Column: Carousel Showroom Card */}
            <div className="lg:col-span-8 border border-hairline bg-canvas-elevated flex flex-col justify-between">
              {/* Carousel Head / Status */}
              <div className="border-b border-hairline px-6 py-4 flex items-center justify-between">
                <span className="font-caption-uppercase text-[11px] tracking-[1px] text-white">
                  SPECIFICATION SHOWCASE
                </span>
                <span className="font-caption-uppercase text-[11px] tracking-[1px] text-primary">
                  {carouselBanners[carouselIndex].badgeText}
                </span>
              </div>

              {/* Slider Main View */}
              <div className="p-8 space-y-8 flex-1 flex flex-col justify-center">
                <div className="space-y-4">
                  <h3 className="font-display-lg text-3xl sm:text-5xl font-medium uppercase tracking-tight text-white">
                    {carouselBanners[carouselIndex].title}
                  </h3>
                  <p className="font-body-md text-sm text-body leading-relaxed max-w-xl">
                    {carouselBanners[carouselIndex].desc}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-hairline pt-6 font-body-sm text-[13px] text-body">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>{carouselBanners[carouselIndex].date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{carouselBanners[carouselIndex].venue}</span>
                  </div>
                </div>
              </div>

              {/* Slider Navigation Bar */}
              <div className="border-t border-hairline px-6 py-4 flex items-center justify-between">
                {/* Dots */}
                <div className="flex items-center gap-2">
                  {carouselBanners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCarouselIndex(idx)}
                      className={`w-2.5 h-2.5 transition-all duration-300 ${idx === carouselIndex ? "bg-primary scale-110" : "bg-muted hover:bg-body"
                        }`}
                      aria-label={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    const matchedEvent = allEvents.find(e => e.title.toLowerCase().includes(carouselBanners[carouselIndex].title.toLowerCase()));
                    if (matchedEvent) {
                      handleEventClick(matchedEvent);
                    } else {
                      router.push("/events");
                    }
                  }}
                  className="font-caption-uppercase text-[11px] tracking-[1px] text-white hover:text-primary flex items-center gap-2"
                >
                  LIHAT DETAIL EVENT <ArrowRight className="w-4 h-4 text-primary" />
                </button>
              </div>
            </div>

            {/* Right Column: Mini spec board */}
            <div className="lg:col-span-4 border border-hairline bg-canvas flex flex-col justify-between p-8 space-y-6">
              <span className="font-caption-uppercase text-[11px] tracking-[1.4px] text-primary">
                PROMO HIGHLIGHT
              </span>
              <div className="space-y-4">
                <h3 className="font-display-md text-2xl uppercase tracking-tight text-white leading-tight">
                  ANTI-SCALPER CEILING GUARANTEE
                </h3>
                <p className="font-body-sm text-[13px] text-body leading-relaxed">
                  Semua transaksi tiket terproteksi otomatis oleh kontrak pintar ERC-1155 pada jaringan Base L2.
                  Markup harga tiket sekunder dibatasi secara ketat, menghilangkan calo yang mengeksploitasi penggemar.
                </p>
              </div>
              <div className="pt-2 border-t border-hairline flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-corsa" />
                <span className="font-caption-uppercase text-[10px] text-body tracking-wider">
                  ACTIVATED ON BASE SEPOLIA TESTNET
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ─── Search & Category Selector ───────────────────────────────── */}
        <section id="events-section" className="section-container py-8 scroll-mt-24">
          <div className="border border-hairline bg-canvas-elevated p-6 flex flex-col lg:flex-row gap-6 items-center justify-between">
            {/* Minimal Search Input */}
            <div className="relative w-full lg:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-soft" />
              <input
                type="text"
                placeholder="Cari event musik, seminar, seni..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-5 py-3 border border-hairline bg-canvas focus:outline-hidden text-white placeholder:text-muted-soft font-body-md text-sm transition-all focus:border-primary"
              />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              {["Semua", "Musik", "Seminar", "Olahraga", "Seni"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 border font-caption-uppercase text-[11px] tracking-wider transition-all duration-200 cursor-pointer ${selectedCategory === cat
                    ? "bg-primary text-white border-primary"
                    : "bg-canvas text-body border-hairline hover:text-white hover:border-body"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Active Event List ─────────────────────────────────────────── */}
        <section className="section-container py-8">
          <div className="border-b border-hairline pb-4 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-display-md text-2xl uppercase tracking-tight text-white flex items-center gap-3">
                EVENT TERSEDIA
                <span className="w-2 h-2 bg-primary inline-block shrink-0 animate-pulse-corsa" />
              </h2>
              <p className="font-body-sm text-[13px] text-body mt-1">
                Beli tiket terverifikasi langsung dari organizer resmi secara 100% on-chain.
              </p>
            </div>

            {(selectedCategory !== "Semua" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategory("Semua");
                  setSearchQuery("");
                }}
                className="px-4 py-2 border border-primary text-primary font-caption-uppercase text-[10px] tracking-wider hover:bg-primary hover:text-white transition-all cursor-pointer"
              >
                RESET FILTERS
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 border border-hairline bg-canvas-elevated">
              <div className="w-10 h-10 border-2 border-hairline border-t-primary rounded-full animate-spin mb-4" />
              <p className="font-body-sm text-sm text-body">Menyelaraskan data tiket dari blockchain...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-hairline bg-canvas-elevated p-6">
              <AlertCircle className="w-10 h-10 text-primary mb-4" />
              <h3 className="font-display-md text-2xl uppercase tracking-tight mb-2">
                EVENT TIDAK DITEMUKAN
              </h3>
              <p className="font-body-sm text-[13px] text-body max-w-sm">
                Coba sesuaikan kata kunci pencarian Anda, ganti filter kategori, atau tambahkan tiket simulasi baru.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEvents.map((event) => {
                return (
                  <div
                    key={event.key}
                    onClick={() => handleEventClick(event)}
                    className="group border border-hairline bg-canvas-elevated overflow-hidden hover:border-primary transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Header Image representation */}
                    <div className="h-40 bg-radial-[circle_at_center] from-primary/10 via-neutral-900 to-neutral-950 relative border-b border-hairline overflow-hidden shrink-0">

                      {/* Floating Category tag */}
                      <div className="absolute top-4 left-4">
                        {event.classCount > 1 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 border border-primary/20 bg-primary/10 font-caption-uppercase text-[9px] tracking-wider text-primary">
                            {event.classCount} KELAS TIKET
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 border border-primary/20 bg-primary/10 font-caption-uppercase text-[9px] tracking-wider text-primary">
                            {event.category}
                          </span>
                        )}
                      </div>

                      {/* Blockchain Verified Badge */}
                      <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 border border-primary bg-primary text-white font-caption-uppercase text-[9px] tracking-wider animate-pulse-corsa">
                          ON-CHAIN
                        </span>
                      </div>

                      {/* City Badge Bottom Left */}
                      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-canvas/80 border border-hairline text-white px-2 py-0.5 font-caption-uppercase text-[9px] tracking-wider">
                        <MapPin className="w-3 h-3 text-primary" />
                        {event.city}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                      <div className="space-y-2">
                        <h3 className="font-display-md text-xl uppercase tracking-tight text-white leading-tight group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>

                        <div className="space-y-1 font-body-sm text-[13px] text-body pt-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <span>{event.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            <span className="truncate">{event.venue}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing row */}
                      <div className="pt-4 border-t border-hairline flex items-center justify-between">
                        <div>
                          <p className="font-caption-uppercase text-[9px] text-body tracking-wider mb-0.5">
                            {event.classCount > 1 ? "MULAI DARI" : event.isResale ? "HARGA RESALE" : "HARGA TIKET"}
                          </p>
                          <p className="font-title-md text-lg text-white">
                            {formatIDRX(event.lowestPrice)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-caption-uppercase text-[9px] text-body tracking-wider">
                            <strong className="text-primary">{event.totalRemaining}</strong> TIKET
                          </span>
                          <div className="w-9 h-9 border border-hairline bg-canvas flex items-center justify-center transition-all duration-200 group-hover:bg-primary group-hover:border-primary group-hover:text-white">
                            <ArrowRight className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </div>
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
