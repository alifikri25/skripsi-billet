"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isCreatorMode = pathname.startsWith("/creator");
  const isGatekeeperMode = pathname.startsWith("/gatekeeper");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // navLinks dibiarkan utuh. Jika panitia mengetik manual /gatekeeper, 
  // menu navigasi akan tetap menyesuaikan dengan menu khusus panitia.
  const navLinks = isCreatorMode
    ? [
      { href: "/creator", label: "Portal Creator" },
      { href: "/", label: "Halaman Pembeli" },
    ]
    : isGatekeeperMode
      ? [
        { href: "/gatekeeper", label: "Scanner Area" },
        { href: "/", label: "Halaman Pembeli" },
      ]
      : [
        { href: "/", label: "Beranda" },
        { href: "/events", label: "Event" },
        { href: "/my-tickets", label: "Tiket Saya" },
      ];

  return (
    <nav
      id="main-navbar"
      className={`sticky z-50 w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex justify-center ${scrolled ? "top-4 px-4" : "top-0"
        }`}
    >
      <div
        className={`relative w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled
          ? "max-w-5xl bg-canvas/75 backdrop-blur-xl border border-hairline h-16 px-4 md:px-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)]"
          : "bg-canvas border-b border-hairline h-16 md:h-20"
          }`}
      >
        <div className={`h-full flex items-center justify-between gap-4 mx-auto ${scrolled ? "w-full" : "w-full max-w-7xl px-6 md:px-12"}`}>

          {/* ─── Logo & Brand Mark ─────────────────────────────────── */}
          <Link
            href={isCreatorMode ? "/creator" : "/"}
            className={`flex items-center group shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled ? "gap-0" : "gap-3"
              }`}
            id="navbar-logo"
          >
            <img
              src="/icon.png"
              alt="Billet Logo"
              className="w-10 h-10 shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
            />

            <div
              className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled ? "max-w-0 opacity-0" : "max-w-50 opacity-100"
                }`}
            >
              <span className="font-display font-bold text-xl md:text-2xl tracking-tight text-white leading-none">
                Billet
              </span>
              {isCreatorMode && (
                <span className="font-caption-uppercase text-[9px] text-primary mt-1 tracking-wider">
                  CREATOR SYSTEM
                </span>
              )}
              {isGatekeeperMode && (
                <span className="font-caption-uppercase text-[9px] text-semantic-info mt-1 tracking-wider">
                  GATEKEEPER SCAN
                </span>
              )}
            </div>
          </Link>

          {/* ─── Desktop Navigation ───────────────────────────── */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 items-center gap-6">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    font-nav-link text-[13px] tracking-[0.65px] transition-all duration-200 py-2 relative
                    ${isActive
                      ? "text-primary font-bold after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary"
                      : "text-body hover:text-white"
                    }
                  `}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* ─── Right Side Utilities ───────────────────────────────────── */}
          <div className="flex items-center gap-4">

            {/* Opsi Panitia dihapus dari Desktop Switcher */}
            <div className="hidden sm:flex border border-hairline bg-canvas/50 items-center p-0.5">
              <Link href="/" className={`px-3 py-1 font-caption-uppercase text-[9px] tracking-wider transition-all duration-200 ${!isCreatorMode && !isGatekeeperMode ? "bg-primary text-white" : "text-body hover:text-white"}`}>Pembeli</Link>
              <Link href="/creator" className={`px-3 py-1 font-caption-uppercase text-[9px] tracking-wider transition-all duration-200 ${isCreatorMode ? "bg-primary text-white" : "text-body hover:text-white"}`}>Kreator</Link>
            </div>

            <div className="hidden sm:block">
              <ConnectKitButton />
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 border border-hairline bg-canvas text-white transition-all duration-200 hover:text-primary"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ─── Mobile Navigation Menu ─────────────────────────────── */}
        {mobileOpen && (
          <div
            className={`md:hidden absolute left-0 right-0 bg-canvas/95 backdrop-blur-xl border border-hairline p-6 animate-slide-up space-y-6 z-50 shadow-2xl transition-all ${scrolled ? "top-18" : "top-20"
              }`}
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      font-nav-link text-sm py-3 text-center border border-hairline transition-all duration-200
                      ${isActive
                        ? "bg-primary text-white border-primary"
                        : "text-body hover:text-white bg-canvas/50"
                      }
                    `}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Opsi Panitia dihapus dari Mobile Switcher */}
            <div className="pt-4 border-t border-hairline space-y-3">
              <p className="text-[10px] text-body uppercase font-display tracking-wider pl-1 text-center">Akses Halaman</p>
              <div className="flex flex-col border border-hairline bg-canvas/30 p-1 gap-1">
                <Link href="/" onClick={() => setMobileOpen(false)} className={`text-center py-2 font-caption-uppercase text-[10px] tracking-wider transition-all duration-200 ${!isCreatorMode && !isGatekeeperMode ? "bg-primary text-white" : "text-body hover:text-white"}`}>Pembeli</Link>
                <Link href="/creator" onClick={() => setMobileOpen(false)} className={`text-center py-2 font-caption-uppercase text-[10px] tracking-wider transition-all duration-200 ${isCreatorMode ? "bg-primary text-white" : "text-body hover:text-white"}`}>Kreator</Link>
              </div>
            </div>

            <div className="pt-2 sm:hidden flex justify-center w-full">
              <ConnectKitButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}