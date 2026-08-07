"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { useBuyTicket } from "@/hooks/useBuyTicket";
import { useHandleContractError } from "@/hooks/useHandleError";
import { formatIDRX } from "@/lib/format";
import type { ListingWithId } from "@/hooks/useListings";
import { formatUnits, keccak256, toBytes } from "viem";

interface BuyTicketDialogProps {
  listing: ListingWithId | null;
  onClose: () => void;
  onSuccess: () => void;
}

const steps = [
  { id: "form", label: "Detail" },
  { id: "approving", label: "Approve" },
  { id: "buying", label: "Beli" },
  { id: "success", label: "Selesai" },
];

export function BuyTicketDialog({ listing, onClose, onSuccess }: BuyTicketDialogProps) {
  const { isConnected } = useAccount();
  const { executePurchase, txState } = useBuyTicket();
  const { handleError } = useHandleContractError();

  const [amount, setAmount] = useState(1);
  const [holderData, setHolderData] = useState<{ name: string; nik: string }[]>([
    { name: "", nik: "" },
  ]);
  const [errorMsg, setErrorMsg] = useState("");
  // Track which fields the user has interacted with for validation UX
  const [touchedNik, setTouchedNik] = useState<Set<number>>(new Set());

  if (!listing) return null;

  const maxAmount = Number(listing.amount);
  const maxPurchase = Math.min(5, maxAmount);
  const totalPriceWei = listing.pricePerUnit * BigInt(amount);
  const totalPriceFormatted = formatIDRX(totalPriceWei);
  const categoryName = listing.parsedEvent?.ticketClass || "Reguler";
  const eventName = listing.parsedEvent?.eventName || listing.eventDetails?.title || "Event";

  // Real-time NIK validation helper
  const isNikValid = (nik: string) => /^\d{16}$/.test(nik);
  const allHoldersValid = holderData.every(
    (h) => h.name.trim().length > 0 && isNikValid(h.nik)
  );

  // Determine current step index
  const currentStepIndex =
    txState === "idle" ? 0 :
      txState === "approving" ? 1 :
        txState === "buying" ? 2 :
          txState === "success" ? 3 : 0;

  // Update holder count when amount changes
  const handleAmountChange = (newAmount: number) => {
    const clamped = Math.max(1, Math.min(newAmount, maxPurchase));
    setAmount(clamped);
    setHolderData((prev) => {
      if (clamped > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: clamped - prev.length }, () => ({ name: "", nik: "" })),
        ];
      }
      return prev.slice(0, clamped);
    });
  };

  const handleHolderChange = (index: number, field: "name" | "nik", value: string) => {
    setHolderData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async () => {
    setErrorMsg("");

    // Final validation guard (button should already be disabled but just in case)
    for (let i = 0; i < holderData.length; i++) {
      if (!holderData[i].name.trim() || !isNikValid(holderData[i].nik)) {
        setErrorMsg(`Lengkapi semua data pemegang tiket #${i + 1}`);
        return;
      }
    }

    try {
      const names = holderData.map((h) => h.name.trim());
      const niks = holderData.map((h) => keccak256(toBytes(h.nik.trim())));

      const totalInWei = listing.pricePerUnit * BigInt(amount);
      const totalEther = formatUnits(totalInWei, 18);

      await executePurchase(
        BigInt(listing.listingId),
        amount,
        totalEther,
        niks,
        names
      );

      onSuccess();
    } catch (err) {
      handleError(err);
      setErrorMsg("Transaksi gagal. Silakan coba lagi.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 text-white"
      id="buy-ticket-dialog"
    >
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-canvas/80 backdrop-blur-xs animate-fade-in"
        onClick={txState === "idle" ? onClose : undefined}
      />

      {/* Dialog container sharp corners */}
      <div className="relative w-full max-w-lg bg-canvas-elevated shadow-2xl animate-fade-in-up overflow-hidden border border-hairline rounded-none">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-hairline">
          <div>
            <h2 className="font-display font-semibold text-lg uppercase tracking-tight text-white">
              BELI TIKET
            </h2>
            <p className="font-body-sm text-[12px] text-body mt-0.5">
              {eventName} — {categoryName}
            </p>
          </div>
          {txState === "idle" && (
            <button
              onClick={onClose}
              className="p-1 border border-hairline hover:border-white text-body hover:text-white transition-colors"
              id="dialog-close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Steps custom box outlines */}
        <div className="px-6 py-4 bg-canvas/40 border-b border-hairline">
          <div className="flex items-center gap-1">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`
                    w-6 h-6 flex items-center justify-center text-[10px] font-bold shrink-0 transition-all rounded-none border
                    ${i < currentStepIndex
                      ? "bg-semantic-success border-semantic-success text-white"
                      : i === currentStepIndex
                        ? "bg-primary border-primary text-white"
                        : "bg-canvas-elevated border-hairline text-body"
                    }
                  `}
                >
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 transition-colors ${i < currentStepIndex ? "bg-semantic-success" : "bg-hairline"
                      }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 font-caption-uppercase text-[8px] tracking-wider text-body">
            {steps.map((step, i) => (
              <span
                key={step.id}
                className={`flex-1 text-center ${i <= currentStepIndex ? "text-white font-bold" : "text-body/30"
                  }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>

        {/* Body content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-6">
          {txState === "success" ? (
            /* Success State */
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 border border-semantic-success/30 bg-semantic-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-semantic-success" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display-md text-xl uppercase tracking-tight text-white">
                  PEMBELIAN SELESAI
                </h3>
                <p className="font-body-sm text-[13px] text-body max-w-xs mx-auto">
                  {amount} tiket {categoryName} berhasil ditransfer ke akun Anda.
                  Dapatkan check-in instan on-chain di halaman "Tiket Saya".
                </p>
              </div>
              <button
                onClick={onClose}
                className="btn-primary h-10 py-0 rounded-none w-fit font-bold"
                id="dialog-done"
              >
                SELESAI
              </button>
            </div>
          ) : txState !== "idle" ? (
            /* Transaction processing */
            <div className="text-center py-10 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <div className="space-y-2">
                <h3 className="font-display-md text-xl uppercase tracking-tight text-white">
                  {txState === "approving"
                    ? "APPROVING STABLECOIN..."
                    : "MENYELESAIKAN PENJUALAN..."}
                </h3>
                <p className="font-body-sm text-[13px] text-body max-w-xs mx-auto">
                  {txState === "approving"
                    ? "Silakan tanda tangani transaksi persetujuan token IDRX di dompet Anda."
                    : "Menghubungi smart contract penjualan tiket Billet L2..."}
                </p>
              </div>
            </div>
          ) : (
            /* Form input state */
            <>
              {!isConnected ? (
                <div className="text-center py-8 space-y-3">
                  <AlertCircle className="w-8 h-8 text-primary mx-auto" />
                  <p className="font-body-sm text-[13px] text-body">
                    Harap hubungkan dompet Web3 Anda untuk memproses transaksi.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Amount Selector custom buttons */}
                  <div className="space-y-2">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">
                      Jumlah Tiket
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleAmountChange(amount - 1)}
                        disabled={amount <= 1}
                        className="w-10 h-10 border border-hairline bg-canvas hover:border-white flex items-center justify-center text-white disabled:opacity-30 transition-all font-bold rounded-none"
                      >
                        −
                      </button>
                      <span className="font-display font-bold text-xl text-white w-12 text-center">
                        {amount}
                      </span>
                      <button
                        onClick={() => handleAmountChange(amount + 1)}
                        disabled={amount >= maxPurchase}
                        className="w-10 h-10 border border-hairline bg-canvas hover:border-white flex items-center justify-center text-white disabled:opacity-30 transition-all font-bold rounded-none"
                      >
                        +
                      </button>
                      <span className="font-caption-uppercase text-[9px] text-muted tracking-wider ml-1">
                        MAKS. {maxPurchase} LBR
                      </span>
                    </div>
                  </div>

                  {/* Holder info registration */}
                  <div className="space-y-3">
                    <label className="font-caption-uppercase text-[10px] text-body block tracking-wider">
                      Registrasi Pemegang Tiket
                    </label>
                    {holderData.map((holder, i) => {
                      const nikLen = holder.nik.length;
                      const nikIsTouched = touchedNik.has(i);
                      const nikIsEmpty = nikLen === 0;
                      const nikIsValid = isNikValid(holder.nik);
                      const showError = nikIsTouched && !nikIsEmpty && !nikIsValid;
                      const showSuccess = nikIsValid;

                      return (
                        <div
                          key={i}
                          className="border border-hairline bg-canvas p-4 space-y-3"
                        >
                          <p className="font-caption-uppercase text-[9px] text-primary tracking-wider font-bold">
                            PEMEGANG TIKET #{i + 1}
                          </p>
                          <input
                            type="text"
                            placeholder="Nama Lengkap"
                            value={holder.name}
                            onChange={(e) =>
                              handleHolderChange(i, "name", e.target.value)
                            }
                            className="w-full input-on-dark"
                            id={`holder-name-${i}`}
                          />
                          <div className="space-y-1">
                            <input
                              type="text"
                              placeholder="NIK (16 Digit)"
                              maxLength={16}
                              value={holder.nik}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                handleHolderChange(i, "nik", val);
                              }}
                              onBlur={() => setTouchedNik((prev) => new Set(prev).add(i))}
                              className={`w-full input-on-dark font-mono text-xs transition-colors ${
                                showSuccess
                                  ? "border-semantic-success! focus:border-semantic-success!"
                                  : showError
                                    ? "border-primary! focus:border-primary!"
                                    : ""
                              }`}
                              id={`holder-nik-${i}`}
                            />
                            {showError && (
                              <p className="text-[11px] text-primary font-body-sm">
                                Wajib tepat 16 digit angka (Sekarang: {nikLen} digit)
                              </p>
                            )}
                            {showSuccess && (
                              <p className="text-[11px] text-semantic-success font-body-sm">
                                ✓ NIK valid (16 digit)
                              </p>
                            )}
                            {nikIsTouched && nikIsEmpty && (
                              <p className="text-[11px] text-muted font-body-sm">
                                Masukkan 16 digit NIK KTP Anda
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Error display */}
                  {errorMsg && (
                    <div className="flex items-center gap-2 font-body-sm text-[13px] text-primary bg-primary/10 border border-primary/20 p-3">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {errorMsg}
                    </div>
                  )}

                  {/* Pricing summary */}
                  <div className="border border-hairline bg-canvas p-4 space-y-2 font-body-sm text-[13px] text-body">
                    <div className="flex justify-between items-center">
                      <span>Harga Satuan</span>
                      <span className="text-white font-medium">
                        {formatIDRX(listing.pricePerUnit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Jumlah Tiket</span>
                      <span className="text-white font-medium">
                        × {amount}
                      </span>
                    </div>
                    <div className="border-t border-hairline my-1.5" />
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white uppercase">TOTAL</span>
                      <span className="font-display font-bold text-lg text-primary">
                        {totalPriceFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!allHoldersValid}
                    className="btn-primary w-full tracking-[1.4px] flex items-center justify-center gap-2 rounded-none font-bold disabled:opacity-40 disabled:pointer-events-none"
                    id="buy-submit"
                  >
                    BELI TIKET SEKARANG
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
