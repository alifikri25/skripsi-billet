import { decodeErrorResult, type Hex } from 'viem'
import { MARKETPLACE_ABI } from '@/config/contracts'
import { toast } from "sonner"

interface ContractError {
  data?: unknown;
  cause?: {
    data?: unknown;
    cause?: {
      data?: unknown;
    };
  };
  message?: string;
}

export function useHandleContractError() {
  const handleError = (error: unknown) => {
    try {
      const err = error as ContractError;
      let errorData = err.data || err.cause?.data || err.cause?.cause?.data;
      
      if (errorData && typeof errorData === 'object' && 'data' in errorData) {
        errorData = (errorData as { data: unknown }).data;
      }

      if (!errorData || typeof errorData !== 'string' || !errorData.startsWith('0x')) {
        throw new Error("No valid hex error data found");
      }

      const decodedError = decodeErrorResult({
        abi: MARKETPLACE_ABI,
        data: errorData as Hex,
      })

      if (decodedError.errorName === 'PriceCeilingExceeded') {
        toast.error("Gagal", { description: "Harga jual yang dimasukkan melebihi batas maksimal regulasi." })
      } else if (decodedError.errorName === 'SaleNotStarted') {
        toast.warning("Peringatan", { description: "Waktu penjualan tiket belum dimulai." })
      } else if (decodedError.errorName === 'InsufficientPayment') {
        toast.error("Saldo Kurang", { description: "Saldo IDRX Anda tidak mencukupi untuk transaksi ini." })
      } else if (decodedError.errorName === 'InsufficientAllowance') {
        toast.error("Persetujuan Gagal", { description: "Anda belum menyetujui (Approve) penggunaan IDRX yang cukup." })
      } else {
        toast.error("Transaksi Gagal", { description: "Cek kembali ketentuan transaksi Anda." })
      }
    } catch {
      const err = error as ContractError;
      if (err?.message?.includes('User rejected')) {
        toast.info("Dibatalkan", { description: "Anda membatalkan transaksi di wallet." })
      } else {
        toast.error("Error", { description: "Terjadi kesalahan yang tidak diketahui." })
      }
    }
  }

  return { handleError }
}


