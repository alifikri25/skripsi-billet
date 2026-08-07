#!/bin/bash

# Pastikan script berhenti jika terjadi eror
set -e

# Load environment variables dari .env
if [ -f .env ]; then
  echo "Memuat konfigurasi dari .env..."
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
else
  echo "Berkas .env tidak ditemukan! Buat berkas .env terlebih dahulu."
  exit 1
fi

# Validasi variabel penting
if [ -z "$PRIVATE_KEY" ] || [ -z "$BASE_SEPOLIA_URL" ] || [ -z "$ETHERSCAN_API_KEY" ]; then
  echo "Variabel env tidak lengkap! Pastikan PRIVATE_KEY, BASE_SEPOLIA_URL, dan ETHERSCAN_API_KEY terisi di .env."
  exit 1
fi

echo "Memulai kompilasi, deployment, dan verifikasi Smart Contract ke Base Sepolia..."

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$BASE_SEPOLIA_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --slow \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --legacy

echo "Sukses! Seluruh Smart Contract telah ter-deploy dan terverifikasi secara otomatis on-chain di Base Sepolia!"
