"use client";

import { ExternalLink } from "lucide-react"; // Ticket dihapus
import Link from "next/link";
import Image from "next/image"; // Tambahkan import Image

const platformLinks = [
  { href: "/events", label: "Jelajahi Event" },
  { href: "/my-tickets", label: "Tiket Saya" },
  { href: "/creator", label: "Portal Kreator" },
];

const techLinks = [
  { href: "https://base.org", label: "Base", external: true },
  { href: "https://idrx.co", label: "IDRX Stablecoin", external: true },
  { href: "https://eips.ethereum.org/EIPS/eip-1155", label: "ERC-1155", external: true },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-hairline bg-canvas text-body py-12 md:py-16">
      <div className="section-container">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">

          {/* ─── Column 1: Branding ──────────────────────────────────── */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              {/* Box dihapus, Image digunakan dengan ukuran yang sedikit lebih kecil dari Navbar (32px) */}
              <Image
                src="/icon.png"
                alt="Billet Logo"
                width={32}
                height={32}
                className="transition-transform duration-300 group-hover:scale-105"
              />
              <span className="font-display font-bold text-lg tracking-tight text-white uppercase">
                BILLET
              </span>
            </Link>
            <p className="font-body-sm text-[13px] text-body max-w-xs leading-relaxed">
              Platform tiket acara terdesentralisasi on-chain. Aman, adil, dan transparan
              di jaringan Base.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-hairline bg-canvas-elevated text-white font-caption-uppercase text-[10px] tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-corsa" />
                BUILT ON BASE
              </span>
            </div>
          </div>

          {/* ─── Column 2: Platform Links ────────────────────────────── */}
          <div className="md:col-span-3">
            <h4 className="font-display font-semibold text-white text-xs uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-body-sm text-[13px] text-body hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ─── Column 3: Tech Links ────────────────────────────────── */}
          <div className="md:col-span-4">
            <h4 className="font-display font-semibold text-white text-xs uppercase tracking-wider mb-4">
              Teknologi
            </h4>
            <ul className="space-y-2.5">
              {techLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-body-sm text-[13px] text-body hover:text-white transition-colors group"
                  >
                    {link.label}
                    <ExternalLink className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── Bottom Copyright Bar ───────────────────────────────── */}
        <div className="mt-12 pt-6 border-t border-hairline flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-body-sm text-xs text-muted-soft">
            © {new Date().getFullYear()} Billet. Dibangun di atas Base
          </p>
          <p className="font-body-sm text-xs text-muted-soft">
            Smart Contracts terverifikasi di BaseScan Sepolia
          </p>
        </div>
      </div>
    </footer>
  );
}