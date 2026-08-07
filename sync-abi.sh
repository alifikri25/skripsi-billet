#!/bin/bash
set -euo pipefail

echo "Memulai kompilasi Smart Contract..."
cd contracts && forge build
cd ..

echo "Menyinkronkan ABI ke Frontend..."
mkdir -p frontend/src/config/abi

# Verifikasi keberadaan file sebelum menyalin
if [ -f "contracts/out/TicketMarketplace.sol/TicketMarketplace.json" ]; then
  jq '.abi' contracts/out/TicketMarketplace.sol/TicketMarketplace.json > frontend/src/config/abi/TicketMarketplace.json
  echo "TicketMarketplace ABI disinkronkan ke Frontend."
else
  echo "TicketMarketplace.json belum ditemukan. Tulis kontraknya terlebih dahulu."
fi

if [ -f "contracts/out/TicketNFT.sol/TicketNFT.json" ]; then
  jq '.abi' contracts/out/TicketNFT.sol/TicketNFT.json > frontend/src/config/abi/TicketNFT.json
  echo "TicketNFT ABI disinkronkan ke Frontend."
else
  echo "TicketNFT.json belum ditemukan. Tulis kontraknya terlebih dahulu."
fi

echo "Menyinkronkan ABI ke Indexer..."
mkdir -p indexer/abis

if [ -f "contracts/out/TicketMarketplace.sol/TicketMarketplace.json" ]; then
  cp contracts/out/TicketMarketplace.sol/TicketMarketplace.json indexer/abis/
  printf 'export const abi = %s as const;\n' "$(jq '.abi' indexer/abis/TicketMarketplace.json)" > indexer/abis/TicketMarketplace.ts
  echo "TicketMarketplace ABI disinkronkan ke Indexer."
fi

if [ -f "contracts/out/TicketNFT.sol/TicketNFT.json" ]; then
  cp contracts/out/TicketNFT.sol/TicketNFT.json indexer/abis/
  printf 'export const abi = %s as const;\n' "$(jq '.abi' indexer/abis/TicketNFT.json)" > indexer/abis/TicketNFT.ts
  echo "TicketNFT ABI disinkronkan ke Indexer."
fi


echo "Sinkronisasi ABI selesai!"

