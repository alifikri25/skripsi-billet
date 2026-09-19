"use client";

import { useState } from "react";
import { CheckCircle2, Clock, User, X, Tag, ArrowUpRight, ShieldAlert, Loader2 } from "lucide-react";
import { getCategoryName } from "@/lib/format";
import type { TicketHolder } from "@/hooks/useMyTickets";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, NFT_ADDRESS, NFT_ABI } from "@/config/contracts";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";

interface TicketCardProps {
  tokenId: number;
  holder: TicketHolder;
  index: number;
  balance?: bigint;
  unusedIndex?: number;
  /** Kelas tiket dari metadata on-chain; menimpa peta statis berbasis tokenId. */
  categoryName?: string;
}

export function TicketCard({ tokenId, holder, index, balance, unusedIndex, categoryName: categoryNameProp }: TicketCardProps) {
  const categoryName = getCategoryName(tokenId, categoryNameProp);
  const isUsed = holder.used;
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Modal & price state
  const [isResellModalOpen, setIsResellModalOpen] = useState(false);
  const [resalePrice, setResalePrice] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Read Marketplace approval status
  const { data: isApproved } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isApprovedForAll",
    args: address ? [address as `0x${string}`, MARKETPLACE_ADDRESS] : undefined,
  });

  // 2. Read event parameters for calculations
  const { data: primaryPriceData } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "primaryPrice",
    args: [BigInt(tokenId)],
  });

  const { data: priceCeilingBpsData } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "priceCeilingBps",
    args: [BigInt(tokenId)],
  });

  const primaryPrice = primaryPriceData ? BigInt(primaryPriceData.toString()) : 0n;
  const priceCeilingBps = priceCeilingBpsData ? BigInt(priceCeilingBpsData.toString()) : 0n;

  // Real-time values
  const formattedOriginal = primaryPrice ? Number(formatUnits(primaryPrice, 18)) : 0;
  const maxResale = primaryPrice && priceCeilingBps
    ? (primaryPrice * priceCeilingBps) / 10000n
    : 0n;
  const formattedMax = maxResale ? Number(formatUnits(maxResale, 18)) : 0;

  // Tampilkan hash NIK (bytes32) tersamar: 4 awal + 4 akhir.
  const maskedNik =
    holder.nikHash && holder.nikHash.length > 8
      ? `${holder.nikHash.slice(0, 4)}••••••${holder.nikHash.slice(-4)}`
      : holder.nikHash;

  // Validation
  const inputPriceWei = resalePrice ? parseUnits(resalePrice.toString(), 18) : 0n;
  const isExceedingCeiling = inputPriceWei > maxResale;

  const handleListResale = async () => {
    if (!resalePrice || Number(resalePrice) <= 0) {
      toast.error("Harga tidak valid!", {
        description: "Masukkan harga jual di atas 0 IDRX."
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedPrice = parseUnits(resalePrice.toString(), 18);
      if (parsedPrice > maxResale) {
        toast.error("Harga melebihi Price Ceiling!", {
          description: `Maksimal harga jual kembali adalah ${formattedMax.toLocaleString("id-ID")} IDRX.`
        });
        setIsSubmitting(false);
        return;
      }

      // 1. Approve Marketplace if not already approved
      if (!isApproved) {
        toast.info("Menyetujui otorisasi marketplace...", {
          description: "Harap setujui transaksi persetujuan di wallet MetaMask Anda."
        });
        const approveTx = await writeContractAsync({
          address: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true]
        });

        toast.info("Menunggu konfirmasi otorisasi di blockchain...", {
          description: "Harap tunggu sesaat hingga transaksi masuk blok..."
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        toast.success("Otorisasi disetujui di blockchain!", {
          description: "Memulai proses listing penjualan kembali..."
        });
      }

      // 2. Call listResale
      toast.info("Mengirimkan listing penjualan kembali...", {
        description: "Harap konfirmasi transaksi listing di wallet Anda."
      });
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "listResale",
        args: [BigInt(tokenId), 1n, parsedPrice]
      });

      toast.success("Tiket Berhasil Terdaftar di Pasar Sekunder!", {
        description: "Tiket Anda kini aktif dipromosikan di Beranda Prasasti!",
        duration: 5000
      });
      setIsResellModalOpen(false);
      setResalePrice("");
      // Reload page to refresh state
      // REVIEW: anti-pattern — sebaiknya gunakan router.refresh() dari next/navigation atau update state lokal secara reaktif.
      window.location.reload();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Gagal mengirimkan transaksi on-chain.";
      toast.error("Transaksi Gagal!", {
        description: message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReselling = !isUsed && balance !== undefined && unusedIndex !== undefined && unusedIndex >= Number(balance);

  return (
    <>
      <div
        className={`
          group relative border overflow-hidden transition-all duration-300 rounded-none flex flex-col justify-between h-full
          ${isUsed
            ? "border-hairline bg-canvas-elevated/40 opacity-60"
            : isReselling
              ? "border-orange-500/30 bg-canvas-elevated/80 opacity-90"
              : "border-hairline bg-canvas-elevated hover:border-primary"
          }
        `}
        id={`ticket-card-${tokenId}-${index}`}
      >
        <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
          {/* ─── Top Row: Category + Status ────────────────── */}
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-lg uppercase tracking-tight text-white">
              {categoryName}
            </span>
            {isUsed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-semantic-success/20 bg-semantic-success/10 text-semantic-success font-caption-uppercase text-[9px] tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                TERPAKAI
              </span>
            ) : isReselling ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-orange-500/20 bg-orange-500/10 text-orange-500 font-caption-uppercase text-[9px] tracking-wider">
                <Tag className="w-3.5 h-3.5" />
                DIJUAL (RESALE)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-primary/20 bg-primary/10 text-primary font-caption-uppercase text-[9px] tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                AKTIF
              </span>
            )}
          </div>

          {/* ─── Holder Info ───────────────────────────────── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 px-4 py-3 border border-hairline bg-canvas">
              <User className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-caption-uppercase text-[8px] text-body tracking-wider">PEMEGANG</p>
                <p className="font-display font-bold text-sm text-white truncate">
                  {holder.name || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 border border-hairline bg-canvas">
              <div className="w-4 h-4 flex items-center justify-center text-primary shrink-0 text-[10px] font-bold">
                ID
              </div>
              <div className="min-w-0">
                <p className="font-caption-uppercase text-[8px] text-body tracking-wider">NOMOR INDUK KEPENDUDUKAN</p>
                <p className="text-sm font-mono text-white">
                  {maskedNik || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Resell Action Button ─────────────────────── */}
          {!isUsed && !isReselling && (
            <button
              onClick={() => setIsResellModalOpen(true)}
              className="w-full mt-4 py-2 border border-primary/40 text-primary font-caption-uppercase text-[10px] tracking-wider hover:bg-primary hover:text-white transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 h-10 font-bold"
            >
              <Tag className="w-3.5 h-3.5" /> JUAL KEMBALI TIKET
            </button>
          )}

        </div>
      </div>

      {/* ─── Resell Modal Overlay ────────────────────────── */}
      {isResellModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md border border-hairline bg-canvas-elevated p-8 relative space-y-6">
            
            {/* Close Button */}
            <button
              onClick={() => setIsResellModalOpen(false)}
              className="absolute right-4 top-4 text-body hover:text-white cursor-pointer border-none bg-transparent"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1.5">
              <span className="font-caption-uppercase text-[10px] text-primary tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> RESALE TICKET LISTING
              </span>
              <h2 className="font-display-md text-2xl uppercase tracking-tight text-white leading-none">
                Jual Kembali Tiket
              </h2>
              <p className="font-body-sm text-[12px] text-body">
                Daftarkan tiket {categoryName} Anda di pasar sekunder secara aman.
              </p>
            </div>

            {/* Price Ceiling Information Box */}
            <div className="p-4 border border-hairline bg-canvas space-y-3 font-body-sm text-[12px]">
              <div className="flex justify-between">
                <span className="text-body">Harga Beli Awal:</span>
                <span className="font-mono text-white">{formattedOriginal.toLocaleString("id-ID")} IDRX</span>
              </div>
              <div className="flex justify-between">
                <span className="text-body">Price Ceiling Bps:</span>
                <span className="font-mono text-white">{(Number(priceCeilingBps) / 100).toFixed(0)}% (1.10x)</span>
              </div>
              <div className="flex justify-between border-t border-hairline pt-2">
                <span className="text-body font-bold">Harga Jual Maksimum:</span>
                <span className="font-mono font-bold text-primary">{formattedMax.toLocaleString("id-ID")} IDRX</span>
              </div>
            </div>

            {/* Pricing Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">
                  Harga Jual Baru (IDRX)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Contoh: 160000"
                  value={resalePrice}
                  onChange={(e) => setResalePrice(e.target.value)}
                  className={`w-full input-on-dark font-mono ${isExceedingCeiling ? "border-semantic-error focus:border-semantic-error" : ""}`}
                />
                
                {isExceedingCeiling && (
                  <p className="text-semantic-error text-[10px] flex items-center gap-1 mt-1 font-caption-uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5" /> Batas atas harga terlampaui! (Maks: {formattedMax.toLocaleString("id-ID")} IDRX)
                  </p>
                )}
              </div>

              {/* Fee and Royalties Preview */}
              {resalePrice && !isExceedingCeiling && Number(resalePrice) > 0 && (
                <div className="p-3 border border-hairline bg-canvas/40 space-y-2 text-[11px] font-body-sm text-body">
                  <div className="flex justify-between">
                    <span>Platform Fee (0% Promo):</span>
                    <span className="text-white">0 IDRX</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Royalti Kreator (5%):</span>
                    <span className="font-mono text-white">{(Number(resalePrice) * 0.05).toLocaleString("id-ID")} IDRX</span>
                  </div>
                  <div className="flex justify-between border-t border-hairline pt-1.5 font-bold">
                    <span>Perkiraan Pendapatan Bersih:</span>
                    <span className="font-mono text-white">{(Number(resalePrice) * 0.95).toLocaleString("id-ID")} IDRX</span>
                  </div>
                </div>
              )}

              {/* Submit Listing Button */}
              <button
                onClick={handleListResale}
                disabled={isSubmitting || isExceedingCeiling || !resalePrice || Number(resalePrice) <= 0}
                className="w-full py-4 bg-primary text-white font-caption-uppercase text-[12px] tracking-[1.4px] hover:bg-primary-active transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer border-none rounded-none h-12 font-bold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> MEMPROSES ON-CHAIN...
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" /> DAFTARKAN PENJUALAN
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
