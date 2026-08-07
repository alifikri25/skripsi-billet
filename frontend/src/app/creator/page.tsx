"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { ConnectKitButton } from "connectkit";
import {
  Sparkles,
  Calculator,
  Ticket,
  Percent,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Activity,
  PlusCircle,
  Coins,
  Layers,
  ChevronDown,
  Info,
  Zap
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "@/config/contracts";
import { parseUnits } from "viem";
import { toast } from "sonner";

// ─── Calculator Presets ──────────────────────────────────────────────────

const eventCategories = [
  { name: "Konser Musik", defaultPrice: 250000, royaltyRate: 0.05, resaleRate: 0.15 },
  { name: "Seminar & Kelas", defaultPrice: 100000, royaltyRate: 0.02, resaleRate: 0.05 },
  { name: "Pertandingan Olahraga", defaultPrice: 150000, royaltyRate: 0.03, resaleRate: 0.10 },
  { name: "Pertunjukan Seni", defaultPrice: 80000, royaltyRate: 0.04, resaleRate: 0.08 }
];

// ─── Feature list ────────────────────────────────────────────────────────

const features = [
  {
    icon: ShieldCheck,
    title: "NFT Ticketing (ERC-1155)",
    desc: "Tiket di-mint sebagai token ERC-1155 di Base L2. Nol pemalsuan."
  },
  {
    icon: Percent,
    title: "Price Ceiling Otomatis",
    desc: "Harga resale dibatasi smart contract. Calo tak bisa markup berlebihan."
  },
  {
    icon: Coins,
    title: "Resale Royalty (ERC-2981)",
    desc: "Terima royalti otomatis setiap tiket berpindah tangan di pasar sekunder."
  },
  {
    icon: Zap,
    title: "Check-in Gasless",
    desc: "Verifikasi tiket di pintu masuk secara instan via tanda tangan cryptographic."
  },
  {
    icon: Activity,
    title: "Laporan Real-Time",
    desc: "Data penjualan tiket dan mutasi resale langsung dari blockchain."
  },
  {
    icon: Layers,
    title: "Multi-Kategori",
    desc: "Format tiket Reguler, VIP, hingga VVIP dengan metadata eksklusif."
  }
];

export default function CreatorPage() {
  const { isConnected, address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // ─── Calculator State ───────────────────────────────────────────────────

  const [selectedCat, setSelectedCat] = useState(eventCategories[0]);
  const [ticketPrice, setTicketPrice] = useState<number>(250000);
  const [ticketVolume, setTicketVolume] = useState<number>(1000);

  // ─── Form State ────────────────────────────────────────────────────────

  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventTerms, setEventTerms] = useState("");
  const [eventCategory, setEventCategory] = useState("Musik");
  const [eventCity, setEventCity] = useState("Jakarta");
  const [eventVenue, setEventVenue] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [priceCeilingMarkup, setPriceCeilingMarkup] = useState<number>(10); // 10%
  const [isLaunching, setIsLaunching] = useState(false);

  // Multi-category ticket classes
  interface TicketClass {
    name: string;
    enabled: boolean;
    price: number;
    supply: number;
  }
  const [ticketClasses, setTicketClasses] = useState<TicketClass[]>([
    { name: "Reguler", enabled: true, price: 100000, supply: 500 },
    { name: "VIP", enabled: false, price: 350000, supply: 100 },
    { name: "VVIP", enabled: false, price: 750000, supply: 50 },
  ]);

  const updateTicketClass = (index: number, updates: Partial<TicketClass>) => {
    setTicketClasses((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const enabledClasses = ticketClasses.filter((tc) => tc.enabled);

  // ─── Read Contract Owner (OnlyOwner listPrimary checks) ──────────────────

  const { data: contractOwner } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "owner"
  });

  const isOwner = !!(contractOwner && address && contractOwner.toString().toLowerCase() === address.toLowerCase());

  // ─── Real-time Calculator Math ──────────────────────────────────────────

  const grossSales = ticketPrice * ticketVolume;
  const platformFee = 0; // 0% PROMO

  // Secondary market resale simulation
  const resaleVolume = Math.round(ticketVolume * selectedCat.resaleRate);
  const avgResalePrice = ticketPrice * 1.10; // Assuming 10% average markup
  const resaleRoyalties = Math.round(resaleVolume * avgResalePrice * selectedCat.royaltyRate);

  const netEarnings = grossSales - platformFee + resaleRoyalties;

  // Percentage calculations for graphics
  const primaryPercentage = Math.min(100, Math.round((grossSales / netEarnings) * 100));
  const royaltyPercentage = Math.min(100, Math.round((resaleRoyalties / netEarnings) * 100));

  // ─── Handle Launch Event (Multi-Category On-Chain) ─────────────────────────

  const handleLaunchEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || !eventVenue || !eventDate) {
      toast.error("Formulir tidak lengkap!", {
        description: "Harap isi Nama Event, Lokasi, dan Tanggal Acara."
      });
      return;
    }

    if (enabledClasses.length === 0) {
      toast.error("Pilih minimal 1 kategori tiket!", {
        description: "Centang minimal satu kelas tiket (Reguler/VIP/VVIP)."
      });
      return;
    }

    setIsLaunching(true);

    try {
      toast.info(`Memulai ${enabledClasses.length} transaksi on-chain ke Base Sepolia...`, {
        description: "Harap setujui setiap permintaan tanda tangan di wallet Anda."
      });

      for (let i = 0; i < enabledClasses.length; i++) {
        const tc = enabledClasses[i];
        const priceInWei = parseUnits(tc.price.toString(), 18);
        // Structured title: "Event Name | Ticket Class | Description | Terms"
        const structuredTitle = `${eventName} | ${tc.name} | ${eventDescription.trim() || "—"} | ${eventTerms.trim() || "—"}`;

        toast.info(`Mengirim transaksi ${i + 1}/${enabledClasses.length}: Tiket ${tc.name}...`, {
          description: `Supply: ${tc.supply} | Harga: ${tc.price.toLocaleString("id-ID")} IDRX`
        });

        const tx = await writeContractAsync({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "createAndListEvent",
          args: [{
            supply: BigInt(tc.supply),
            price: priceInWei,
            ceilingBps: BigInt(10000 + priceCeilingMarkup * 100),
            royaltyBps: 500n, // 5% royalty to creator
            start: 0n,
            end: 0n,
            title: structuredTitle,
            venue: eventVenue,
            date: eventDate,
            city: eventCity,
            category: eventCategory
          }]
        });

        toast.success(`Tiket ${tc.name} berhasil diluncurkan!`, {
          description: `Tx Hash: ${tx.slice(0, 10)}...`
        });
      }

      toast.success("Semua Kategori Tiket Berhasil Diluncurkan On-Chain!", {
        description: `${enabledClasses.length} kategori tiket terdaftar untuk event "${eventName}".`,
        duration: 5000
      });

      setEventName("");
      setEventDescription("");
      setEventTerms("");
      setEventVenue("");
      setEventDate("");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(err);
      toast.error("Transaksi Gagal!", {
        description: err.message || "Gagal mengirimkan transaksi on-chain."
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-white">
      <Navbar />

      <main className="flex-1 pb-24">
        {/* ─── Hero section ────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24" id="hero-creator">
          <div className="section-container">
            <div className="grid lg:grid-cols-12 gap-10 items-center">

              {/* Text Editorial Split */}
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 text-primary font-caption-uppercase text-[11px] tracking-wider w-fit">
                    <Sparkles className="w-3.5 h-3.5" />
                    Billet Creator Portal
                  </span>
                  <h1 className="font-display-xl text-3xl sm:text-5xl font-medium uppercase tracking-tight text-white leading-tight">
                    Luncurkan Tiket <span className="text-primary">On-Chain</span> dengan Batas Resale Otomatis.
                  </h1>
                  <p className="font-body-md text-sm text-body leading-relaxed">
                    Terbitkan tiket digital NFT ERC-1155 pada jaringan Base L2 dalam hitungan menit.
                    Lindungi penggemar dari calo secara instan dengan markup maksimum terikat smart contract,
                    dan peroleh royalti sekunder otomatis yang mengalir langsung ke dompet digital Anda.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <a href="#calculator-section" className="btn-outline">
                    KALKULATOR PENJUALAN
                  </a>
                  <a href="#launcher-section" className="btn-primary">
                    MULAI LAUNCH EVENT
                  </a>
                </div>

                {/* Spec Counters */}
                <div className="border border-hairline bg-canvas-elevated p-6 grid grid-cols-3 gap-4 text-center">
                  {[
                    { value: "30.000+", label: "TIKET TERJUAL" },
                    { value: "RP 0", label: "COMMISSION FEE" },
                    { value: "RP 5 M+", label: "VOLUME RESALE" }
                  ].map((stat, i) => (
                    <div key={i} className="space-y-1">
                      <h3 className="font-display-md text-xl md:text-2xl font-bold text-white uppercase leading-none">{stat.value}</h3>
                      <p className="font-caption-uppercase text-[9px] text-body tracking-wider">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Minimal Dashboard Mockup widget */}
              <div className="lg:col-span-5 relative">
                <div className="border border-hairline bg-canvas-elevated">
                  {/* Title Bar */}
                  <div className="border-b border-hairline px-6 py-4 flex items-center justify-between">
                    <span className="font-caption-uppercase text-[11px] tracking-[1px] text-white">
                      BILLET MONITOR
                    </span>
                    <span className="font-caption-uppercase text-[9px] tracking-[1px] text-primary flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-corsa" />
                      LIVE BLOCKCHAIN
                    </span>
                  </div>
                  {/* Stats Body */}
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-hairline bg-canvas p-4">
                        <p className="font-caption-uppercase text-[9px] text-body tracking-wider">Tiket Terjual</p>
                        <h4 className="font-display-md text-lg text-white font-bold mt-1">1.482 / 1.500</h4>
                        <div className="w-full bg-canvas-elevated h-2 mt-3 relative overflow-hidden">
                          <div className="bg-primary h-full w-[92%]" />
                        </div>
                      </div>
                      <div className="border border-hairline bg-canvas p-4">
                        <p className="font-caption-uppercase text-[9px] text-body tracking-wider">Royalti Resale</p>
                        <h4 className="font-display-md text-lg text-primary font-bold mt-1">+ Rp 7.4jt</h4>
                        <p className="font-caption-uppercase text-[8px] text-body mt-3 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-primary" /> 148 RESALE TRANS
                        </p>
                      </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="space-y-3">
                      <p className="font-caption-uppercase text-[10px] text-white tracking-wider">AKTIVITAS TERBARU</p>
                      <div className="divide-y divide-hairline border border-hairline">
                        {[
                          { type: "PRIMARY BUY", desc: "Membeli 2 Tiket VIP", val: "Rp 700.000" },
                          { type: "RESALE ROYALTY", desc: "Royalti Terbuka 5%", val: "+ Rp 55.000" }
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-canvas/30 text-[12px]">
                            <div className="space-y-0.5">
                              <p className="font-caption-uppercase text-[10px] text-white tracking-wider">{item.type}</p>
                              <p className="text-[11px] text-body">{item.desc}</p>
                            </div>
                            <span className="font-bold text-white">{item.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── Revenue Calculator Section ─────────────────────────────── */}
        <section className="py-16 border-y border-hairline bg-canvas-elevated" id="calculator-section">
          <div className="section-container">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="font-display-md text-3xl uppercase tracking-tight text-white flex items-center justify-center gap-3">
                KALKULATOR ROYALTI
                <Calculator className="w-6 h-6 text-primary" />
              </h2>
              <p className="font-body-sm text-[13px] text-body mt-2">
                Simulasikan perbandingan laba kotor penjualan utama serta kompensasi royalti di pasar sekunder.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Input Control Box */}
              <div className="lg:col-span-5 border border-hairline bg-canvas p-6 space-y-6">
                <h3 className="font-caption-uppercase text-[12px] tracking-[1.4px] text-white border-b border-hairline pb-3">
                  KONFIGURASI EVENT
                </h3>

                {/* Event Category Select */}
                <div className="space-y-2">
                  <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Jenis Event</label>
                  <div className="relative">
                    <select
                      value={selectedCat.name}
                      onChange={(e) => {
                        const cat = eventCategories.find((c) => c.name === e.target.value);
                        if (cat) {
                          setSelectedCat(cat);
                          setTicketPrice(cat.defaultPrice);
                        }
                      }}
                      className="w-full pl-4 pr-10 py-3 border border-hairline bg-canvas-elevated text-white font-body-sm text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary"
                    >
                      {eventCategories.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                  </div>
                </div>

                {/* Ticket Price Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center font-caption-uppercase text-[10px]">
                    <span className="text-body">Harga Per Tiket</span>
                    <span className="text-primary font-bold">Rp {ticketPrice.toLocaleString("id-ID")}</span>
                  </div>
                  <input
                    type="range"
                    min="30000"
                    max="2000000"
                    step="10000"
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))}
                    className="w-full accent-primary bg-canvas-elevated cursor-pointer"
                  />
                  <div className="flex justify-between font-caption-uppercase text-[8px] text-muted">
                    <span>Rp 30rb</span>
                    <span>Rp 2jt</span>
                  </div>
                </div>

                {/* Ticket Volume Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center font-caption-uppercase text-[10px]">
                    <span className="text-body">Jumlah Tiket</span>
                    <span className="text-primary font-bold">{ticketVolume.toLocaleString("id-ID")} LBR</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="25000"
                    step="50"
                    value={ticketVolume}
                    onChange={(e) => setTicketVolume(Number(e.target.value))}
                    className="w-full accent-primary bg-canvas-elevated cursor-pointer"
                  />
                  <div className="flex justify-between font-caption-uppercase text-[8px] text-muted">
                    <span>50</span>
                    <span>25.000</span>
                  </div>
                </div>
              </div>

              {/* Output Display Box */}
              <div className="lg:col-span-7 border border-hairline bg-canvas p-6 sm:p-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary font-caption-uppercase text-[10px] tracking-wider w-fit">
                    <Coins className="w-3.5 h-3.5" />
                    0% PLATFORM COMMISSION — PROMO ACTIVE
                  </span>

                  <h3 className="font-display-md text-2xl uppercase tracking-tight text-white">PROYEKSI PENDAPATAN</h3>

                  {/* Profit breakdown cards */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="border border-hairline bg-canvas-elevated p-4">
                      <p className="font-caption-uppercase text-[9px] text-body tracking-wider">Penjualan Utama</p>
                      <h4 className="font-display-md text-xl text-white font-bold mt-1">
                        Rp {grossSales.toLocaleString("id-ID")}
                      </h4>
                    </div>
                    <div className="border border-hairline bg-canvas-elevated p-4">
                      <p className="font-caption-uppercase text-[9px] text-body tracking-wider">Simulasi Royalti</p>
                      <h4 className="font-display-md text-xl text-primary font-bold mt-1">
                        + Rp {resaleRoyalties.toLocaleString("id-ID")}
                      </h4>
                    </div>
                    <div className="border border-primary/30 bg-primary/5 p-4">
                      <p className="font-caption-uppercase text-[9px] text-primary tracking-wider">Potongan Komisi</p>
                      <h4 className="font-display-md text-xl text-primary font-bold mt-1">
                        Rp 0
                      </h4>
                    </div>
                  </div>

                  {/* Proportion gauge */}
                  <div className="space-y-2">
                    <p className="font-caption-uppercase text-[10px] text-white tracking-wider">PROPORSI LABA:</p>
                    <div className="w-full bg-canvas-elevated h-4 flex overflow-hidden">
                      <div className="bg-white h-full" style={{ width: `${primaryPercentage}%` }} />
                      <div className="bg-primary h-full" style={{ width: `${royaltyPercentage}%` }} />
                    </div>
                    <div className="flex gap-4 font-caption-uppercase text-[9px] text-body">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white" /> PRIMER ({primaryPercentage}%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary" /> ROYALTI SEC ({royaltyPercentage}%)</span>
                    </div>
                  </div>
                </div>

                {/* Net Earnings footer summary */}
                <div className="pt-6 mt-6 border-t border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-caption-uppercase text-[9px] text-body tracking-wider font-bold">ESTIMASI TOTAL LABA BERSIH</p>
                    <h2 className="font-display-lg text-3xl sm:text-4xl text-white font-bold leading-none mt-1">
                      Rp {netEarnings.toLocaleString("id-ID")}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 font-caption-uppercase text-[9px] text-body bg-canvas-elevated border border-hairline p-3">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>Laba mengalir langsung ke Dompet Anda</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Fitted Features Panel ──────────────────────────────────── */}
        <section className="py-16 section-container border-b border-hairline">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="font-display-md text-3xl uppercase tracking-tight text-white">
              SISTEM PROTEKSI TERPADU
            </h2>
            <p className="font-body-sm text-[13px] text-body mt-2">
              Billet mengoptimalkan kenyamanan kreator dan keamanan penonton lewat smart contracts.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="group border border-hairline bg-canvas-elevated p-6 hover:border-primary transition-all duration-300 flex gap-4 items-start"
              >
                <div className="w-10 h-10 border border-white/10 bg-canvas flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  <feat.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-caption-uppercase text-[11px] tracking-[1.1px] text-white">{feat.title}</h3>
                  <p className="font-body-sm text-[13px] text-body leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Event Launch Form ────────────────────────────────────────── */}
        <section className="py-16 section-container max-w-3xl" id="launcher-section">
          <div className="border border-hairline bg-canvas-elevated p-6 sm:p-10">

            {/* Header */}
            <div className="text-center max-w-md mx-auto mb-8 space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary font-caption-uppercase text-[10px] tracking-wider mb-2">
                <PlusCircle className="w-3.5 h-3.5" />
                CREATOR LAUNCHPAD
              </span>
              <h2 className="font-display-md text-3xl uppercase tracking-tight text-white">
                RILIS TIKET BARU
              </h2>
              <p className="font-body-sm text-[13px] text-body">
                Luncurkan tiket digital on-chain resmi atau daftarkan event simulasi baru.
              </p>
            </div>

            {!isConnected ? (
              /* Wallet Lock UI block */
              <div className="flex flex-col items-center justify-center py-12 text-center border border-hairline bg-canvas p-6">
                <div className="w-12 h-12 border border-white/10 bg-canvas-elevated flex items-center justify-center mb-4">
                  <Ticket className="w-5 h-5 text-primary -rotate-45" />
                </div>
                <h4 className="font-caption-uppercase text-[12px] tracking-[1.4px] text-white mb-2">
                  DOMPET BELUM TERHUBUNG
                </h4>
                <p className="font-body-sm text-[13px] text-body max-w-xs mb-6">
                  Hubungkan dompet web3 Anda untuk memverifikasi lisensi penerbitan tiket Billet L2.
                </p>
                <div className="flex justify-center">
                  <ConnectKitButton />
                </div>
              </div>
            ) : (
              /* launch Form */
              <form onSubmit={handleLaunchEvent} className="space-y-6">
                {/* Mode status indicator */}
                <div className="p-4 border text-xs flex gap-3 bg-semantic-success/10 border-semantic-success/30 text-white">
                  <CheckCircle2 className="w-5 h-5 text-semantic-success shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-caption-uppercase text-[11px] tracking-[1.1px] font-bold">
                      MODE: ON-CHAIN SECURE (BASE SEPOLIA)
                    </p>
                    <p className="font-body-sm text-[13px] text-body leading-relaxed">
                      Sistem Multi-Creator aktif. Tiket Anda akan dicetak sebagai NFT ERC-1155 dan didaftarkan langsung ke smart contract secara real-time.
                    </p>
                  </div>
                </div>

                {/* Form fields grid layout */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Nama Event</label>
                    <input
                      type="text"
                      placeholder="Contoh: Retrospektif Tour"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      required
                      className="w-full input-on-dark"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Kategori NFT</label>
                    <div className="relative">
                      <select
                        value={eventCategory}
                        onChange={(e) => setEventCategory(e.target.value)}
                        className="w-full pl-4 pr-10 py-3 border border-hairline bg-canvas text-white font-body-sm text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary"
                      >
                        <option value="Musik">Musik</option>
                        <option value="Seminar">Seminar</option>
                        <option value="Olahraga">Olahraga</option>
                        <option value="Seni">Seni</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Kota</label>
                    <div className="relative">
                      <select
                        value={eventCity}
                        onChange={(e) => setEventCity(e.target.value)}
                        className="w-full pl-4 pr-10 py-3 border border-hairline bg-canvas text-white font-body-sm text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary"
                      >
                        <option value="Jakarta">Jakarta</option>
                        <option value="Bandung">Bandung</option>
                        <option value="Yogyakarta">Yogyakarta</option>
                        <option value="Surabaya">Surabaya</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Nama Gedung / Venue</label>
                    <input
                      type="text"
                      placeholder="Contoh: Stadion Utama GBK"
                      value={eventVenue}
                      onChange={(e) => setEventVenue(e.target.value)}
                      required
                      className="w-full input-on-dark"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Tanggal Acara</label>
                    <input
                      type="text"
                      placeholder="Contoh: 12 Juli 2026"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                      className="w-full input-on-dark"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Price Ceiling Markup</label>
                    <div className="relative">
                      <select
                        value={priceCeilingMarkup}
                        onChange={(e) => setPriceCeilingMarkup(Number(e.target.value))}
                        className="w-full pl-4 pr-10 py-3 border border-hairline bg-canvas text-white font-body-sm text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary"
                      >
                        <option value="0">0% (Sama Harga)</option>
                        <option value="5">5% (Markup 1.05x)</option>
                        <option value="10">10% (Markup 1.10x)</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Description field */}
                <div className="space-y-2">
                  <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Deskripsi Event</label>
                  <textarea
                    placeholder="Deskripsikan acara Anda: agenda, informasi penting bagi pengunjung..."
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    rows={3}
                    className="w-full input-on-dark resize-none font-body-sm text-sm"
                  />
                  <p className="text-[10px] text-muted font-body-sm">Deskripsi ini akan tersimpan permanen di blockchain dan terlihat oleh semua pengunjung.</p>
                </div>

                {/* Terms field */}
                <div className="space-y-2">
                  <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Syarat & Ketentuan</label>
                  <textarea
                    placeholder="Tuliskan syarat & ketentuan kustom (pisahkan dengan baris baru untuk daftar bullet). Kosongkan untuk menggunakan syarat bawaan..."
                    value={eventTerms}
                    onChange={(e) => setEventTerms(e.target.value)}
                    rows={3}
                    className="w-full input-on-dark resize-none font-body-sm text-sm"
                  />
                  <p className="text-[10px] text-muted font-body-sm">Syarat & ketentuan kustom ini akan disimpan di blockchain. Jika kosong, sistem otomatis menampilkan syarat standar.</p>
                </div>

                {/* Multi-Category Ticket Classes */}
                <div className="space-y-3">
                  <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">Kategori Tiket</label>
                  <p className="text-[11px] text-muted font-body-sm -mt-1">Centang kelas tiket yang ingin diluncurkan dan atur harga serta kuota masing-masing.</p>

                  {ticketClasses.map((tc, idx) => (
                    <div
                      key={tc.name}
                      className={`border p-4 space-y-3 transition-colors ${
                        tc.enabled
                          ? "border-primary/40 bg-primary/5"
                          : "border-hairline bg-canvas opacity-60"
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tc.enabled}
                          onChange={(e) => updateTicketClass(idx, { enabled: e.target.checked })}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                        <span className="font-caption-uppercase text-[11px] tracking-wider text-white font-bold">
                          {tc.name}
                        </span>
                      </label>

                      {tc.enabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="font-caption-uppercase text-[9px] text-muted block tracking-wider">Harga (IDRX)</label>
                            <input
                              type="number"
                              min="1000"
                              value={tc.price}
                              onChange={(e) => updateTicketClass(idx, { price: Number(e.target.value) })}
                              className="w-full input-on-dark font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-caption-uppercase text-[9px] text-muted block tracking-wider">Jumlah Tiket</label>
                            <input
                              type="number"
                              min="1"
                              value={tc.supply}
                              onChange={(e) => updateTicketClass(idx, { supply: Number(e.target.value) })}
                              className="w-full input-on-dark font-mono text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit button sharp corners */}
                <button
                  type="submit"
                  disabled={isLaunching}
                  className="w-full py-4 bg-primary text-white font-caption-uppercase text-[12px] tracking-[1.4px] hover:bg-primary-active transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer border-none rounded-none h-12 font-bold"
                >
                  {isLaunching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      MEMPROSES...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      LUNCURKAN TIKET ON-CHAIN
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
