"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ConnectKitButton } from "connectkit";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { NFT_ABI, NFT_ADDRESS, SUPPORTED_TOKEN_IDS } from "@/config/contracts";
import type { Abi } from "viem";
import { baseSepolia } from "viem/chains";
import { keccak256, toBytes } from "viem";
import { Shield, ScanLine, Loader2, ArrowLeft, Search, User } from "lucide-react";
import { Scanner } from "@/components/gatekeeper/Scanner";
import { getCategoryName } from "@/lib/format";
import type { TicketHolder } from "@/hooks/useMyTickets";

export default function GatekeeperPage() {
  const { address, isConnected } = useAccount();
  const [scannedAddress, setScannedAddress] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [nikInputs, setNikInputs] = useState<Record<string, string>>({});

  // 1. Verify Gatekeeper Role
  const { data: isExplicitGateKeeper, isLoading: checkingExplicitRole } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI as Abi,
    functionName: "isGateKeeper",
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const { data: ownerAddress, isLoading: checkingOwnerRole } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI as Abi,
    functionName: "owner",
    chainId: baseSepolia.id,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // 1b. Check if the user is the creator of any event
  const { data: eventDetailsList } = useReadContracts({
    contracts: SUPPORTED_TOKEN_IDS.map((id) => ({
      address: NFT_ADDRESS,
      abi: NFT_ABI as Abi,
      functionName: "eventDetails",
      args: [BigInt(id)],
      chainId: baseSepolia.id,
    })),
    query: {
      enabled: isConnected && !!address,
    }
  });

  const isCreator = !!address && !!eventDetailsList && eventDetailsList.some((res) => {
    if (res.status === "success" && res.result) {
      const details = res.result as Record<string, unknown>;
      const creatorAddr = details.creator || (Array.isArray(details) ? details[5] : null);
      return typeof creatorAddr === "string" && creatorAddr.toLowerCase() === address.toLowerCase();
    }
    return false;
  });

  const checkingRole = checkingExplicitRole || checkingOwnerRole;
  const isOwner = !!address && !!ownerAddress && address.toLowerCase() === (ownerAddress as string).toLowerCase();
  const isGateKeeper = isExplicitGateKeeper || isOwner || isCreator;

  // 2. Fetch User Tickets
  const contracts = scannedAddress
    ? SUPPORTED_TOKEN_IDS.flatMap((tokenId) => [
      {
        address: NFT_ADDRESS,
        abi: NFT_ABI as Abi,
        functionName: "balanceOf" as const,
        args: [scannedAddress as `0x${string}`, BigInt(tokenId)] as const,
        chainId: baseSepolia.id,
      },
      {
        address: NFT_ADDRESS,
        abi: NFT_ABI as Abi,
        functionName: "getTicketHolders" as const,
        args: [scannedAddress as `0x${string}`, BigInt(tokenId)] as const,
        chainId: baseSepolia.id,
      },
    ])
    : [];

  const { data: userTicketsData, isLoading: fetchingTickets, refetch: refetchTickets } = useReadContracts({
    contracts,
    query: {
      enabled: !!scannedAddress,
    },
  });

  // 3. Process Ticket Data
  const tickets: { tokenId: number; holders: TicketHolder[] }[] = [];
  if (userTicketsData) {
    for (let i = 0; i < SUPPORTED_TOKEN_IDS.length; i++) {
      const balanceResult = userTicketsData[i * 2];
      const holdersResult = userTicketsData[i * 2 + 1];

      const balance = balanceResult?.status === "success" ? (balanceResult.result as bigint) : BigInt(0);
      const holders = holdersResult?.status === "success" ? (holdersResult.result as unknown as TicketHolder[]) : [];

      if (balance > BigInt(0) || holders.length > 0) {
        tickets.push({ tokenId: SUPPORTED_TOKEN_IDS[i], holders });
      }
    }
  }

  // 4. Check-In Transaction
  const { writeContract, data: txHash, isPending: isCheckingIn } = useWriteContract();
  const { isLoading: isWaitingTx, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleCheckIn = (tokenId: number, index: number) => {
    if (!scannedAddress) return;
    writeContract({
      address: NFT_ADDRESS,
      abi: NFT_ABI as Abi,
      functionName: "checkInFromGate",
      args: [scannedAddress as `0x${string}`, BigInt(tokenId), BigInt(index)],
    });
  };

  useEffect(() => {
    if (isTxSuccess) {
      refetchTickets();
    }
  }, [isTxSuccess, refetchTickets]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^0x[a-fA-F0-9]{40}$/.test(manualInput)) {
      setScannedAddress(manualInput);
    } else {
      alert("Format alamat dompet tidak valid.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-white">
      <Navbar />

      <main className="flex-1 flex flex-col items-center py-16 px-4 sm:px-6">
        <div className="w-full max-w-2xl">

          {/* Header Console Box */}
          <div className="border border-hairline bg-canvas-elevated p-8 text-center mb-10 space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary font-caption-uppercase text-[10px] tracking-wider w-fit mx-auto">
              <Shield className="w-4 h-4" />
              TRACK SECURITY CONSOLE
            </span>
            <div className="space-y-1">
              <h1 className="font-display-md text-3xl uppercase tracking-tight text-white">GATEKEEPER SCANNER</h1>
              <p className="font-body-sm text-[13px] text-body">Verifikasi identitas dan status check-in tiket pengunjung secara on-chain.</p>
            </div>
          </div>

          {!isConnected ? (
            /* Locked Block */
            <div className="border border-hairline bg-canvas-elevated p-8 text-center space-y-6">
              <Shield className="w-12 h-12 text-primary mx-auto" />
              <div className="space-y-2">
                <h3 className="font-display-md text-xl uppercase tracking-tight text-white">AKSES DIBATASI</h3>
                <p className="font-body-sm text-[13px] text-body max-w-xs mx-auto">
                  Hubungkan dompet Web3 terdaftar dengan wewenang Panitia Gatekeeper untuk memulai validasi.
                </p>
              </div>
              <div className="flex justify-center">
                <ConnectKitButton />
              </div>
            </div>
          ) : checkingRole ? (
            <div className="flex flex-col items-center py-16 border border-hairline bg-canvas-elevated">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="font-body-sm text-sm text-body">Memverifikasi lisensi gatekeeper...</p>
            </div>
          ) : !isGateKeeper ? (
            /* Rejected Block */
            <div className="border border-primary bg-primary/5 p-8 text-center space-y-6">
              <Shield className="w-12 h-12 text-primary mx-auto" />
              <div className="space-y-2">
                <h3 className="font-display-md text-xl uppercase tracking-tight text-white">OTORISASI DITOLAK</h3>
                <p className="font-body-sm text-[13px] text-body max-w-sm mx-auto">
                  Dompet Anda ({address?.slice(0, 6)}...{address?.slice(-4)}) tidak terdaftar sebagai Gatekeeper di smart contract Billet L2.
                </p>
              </div>
              <div className="flex justify-center">
                <ConnectKitButton />
              </div>
            </div>
          ) : !scannedAddress ? (
            /* Scanning Box */
            <div className="space-y-8 animate-fade-in">
              <div className="border border-hairline bg-canvas-elevated p-6">
                <div className="border-b border-hairline pb-3 mb-6 flex items-center justify-between">
                  <span className="font-caption-uppercase text-[11px] tracking-[1px] text-white">CAMERA VIEWER</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse-corsa" />
                    <span className="font-caption-uppercase text-[9px] text-primary tracking-wider">ACTIVE CAMERA</span>
                  </div>
                </div>
                <div className="border border-hairline overflow-hidden bg-black/40">
                  <Scanner onScan={setScannedAddress} />
                </div>
              </div>

              <div className="relative flex items-center py-2">
                <div className="grow border-t border-hairline"></div>
                <span className="shrink-0 px-4 font-caption-uppercase text-[10px] text-body tracking-widest font-bold">ATAU CARI MANUAL</span>
                <div className="grow border-t border-hairline"></div>
              </div>

              <form onSubmit={handleManualSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-soft" />
                  <input
                    type="text"
                    placeholder="Masukkan alamat dompet 0x..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="w-full input-on-dark font-mono text-xs pl-11"
                  />
                </div>
                <button type="submit" className="btn-primary shrink-0 font-bold h-12 py-0 border-none rounded-none px-6">
                  CARI
                </button>
              </form>
            </div>
          ) : (
            /* Results Panel */
            <div className="animate-fade-in space-y-6">
              <button
                onClick={() => setScannedAddress(null)}
                className="btn-outline flex items-center gap-2 text-xs tracking-wider h-10 border border-hairline hover:border-white py-0 px-4 rounded-none"
              >
                <ArrowLeft className="w-4 h-4 text-primary" />
                KEMBALI KE SCANNER
              </button>

              <div className="border border-hairline bg-canvas-elevated p-6 sm:p-8">

                <div className="border-b border-hairline pb-4 mb-6">
                  <span className="font-caption-uppercase text-[9px] text-body tracking-wider">ALAMAT PENGUNJUNG</span>
                  <p className="font-mono text-xs md:text-sm text-white break-all bg-canvas border border-hairline p-3 mt-1.5 font-bold">{scannedAddress}</p>
                </div>

                {fetchingTickets ? (
                  <div className="flex flex-col items-center py-16">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="font-body-sm text-sm text-body">Membaca saldo tiket...</p>
                  </div>
                ) : tickets.length === 0 || tickets.every(t => t.holders.filter(h => h.registered).length === 0) ? (
                  <div className="border border-hairline bg-canvas p-8 text-center space-y-4">
                    <ScanLine className="w-10 h-10 text-primary mx-auto" />
                    <div className="space-y-1">
                      <h3 className="font-display-md text-xl uppercase tracking-tight text-white">TIDAK ADA TIKET</h3>
                      <p className="font-body-sm text-[13px] text-body">Pengunjung ini belum memiliki tiket aktif terdaftar.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {tickets.map((ticket) => {
                      const registeredHolders = ticket.holders
                        .map((h, i) => ({ ...h, originalIndex: i }))
                        .filter((h) => h.registered);

                      if (registeredHolders.length === 0) return null;

                      return (
                        <div key={ticket.tokenId} className="space-y-4">
                          <h3 className="font-display-md text-lg uppercase tracking-tight text-white border-b border-hairline pb-2">
                            {getCategoryName(ticket.tokenId)}
                          </h3>

                          <div className="grid gap-4">
                            {registeredHolders.map((holder) => {
                              const nikKey = `${ticket.tokenId}-${holder.originalIndex}`;
                              const currentNik = nikInputs[nikKey] || "";
                              const hashedInput = currentNik.trim() ? keccak256(toBytes(currentNik.trim())) : "";
                              const isMatch = hashedInput === holder.nikHash;

                              return (
                                <div key={holder.originalIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-hairline bg-canvas relative overflow-hidden">
                                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary" />

                                  <div className="pl-4 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <User className="w-4 h-4 text-primary shrink-0" />
                                      <p className="font-caption-uppercase text-[11px] text-white tracking-wider font-bold truncate">{holder.name || "—"}</p>
                                    </div>
                                    <p className="font-body-sm text-xs text-body break-all">Hash KTP: {holder.nikHash || "—"} • ID: {ticket.tokenId}-{holder.originalIndex}</p>
                                  </div>

                                  <div className="shrink-0 pl-4 sm:pl-0 sm:w-48 flex flex-col items-end gap-2">
                                    {holder.used ? (
                                      <div className="px-4 py-2 border border-primary/20 bg-primary/10 text-primary font-caption-uppercase text-[10px] tracking-wider text-center w-full">
                                        TELAH MASUK
                                      </div>
                                    ) : (
                                      <>
                                        <input
                                          type="text"
                                          placeholder="Scan/Ketik NIK KTP (16 Digit)"
                                          maxLength={16}
                                          value={currentNik}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "");
                                            setNikInputs(prev => ({ ...prev, [nikKey]: val }));
                                          }}
                                          className={`input-on-dark font-mono text-[10px] w-full h-8 px-2 border ${currentNik && !isMatch ? 'border-primary text-primary focus:border-primary' : isMatch ? 'border-semantic-success text-semantic-success focus:border-semantic-success' : 'border-hairline focus:border-white'}`}
                                        />
                                        <button
                                          onClick={() => handleCheckIn(ticket.tokenId, holder.originalIndex)}
                                          disabled={isCheckingIn || isWaitingTx || !isMatch}
                                          className={`text-[10px] tracking-wider h-8 px-4 py-0 font-bold border-none rounded-none flex items-center justify-center gap-2 w-full transition-colors ${isMatch ? 'bg-semantic-success text-white hover:bg-semantic-success/90 cursor-pointer' : 'bg-primary text-white disabled:opacity-50'
                                            }`}
                                        >
                                          {isCheckingIn || isWaitingTx ? (
                                            <><Loader2 className="w-3.5 h-3.5 animate-spin cursor-pointer" /> PROSES...</>
                                          ) : isMatch ? (
                                            <>CHECK-IN SAH</>
                                          ) : (
                                            <>VERIFIKASI KTP</>
                                          )}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
