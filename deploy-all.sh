#!/usr/bin/env bash
#
# deploy-all.sh - Deploy kontrak baru sekali jalan, lalu sambungkan otomatis
#                 ke frontend dan indexer.
#
# Alur:
#   1. Validasi env (PRIVATE_KEY, BASE_SEPOLIA_URL, ETHERSCAN_API_KEY)
#   2. forge script Deploy.s.sol --broadcast [--verify]
#   3. Baca alamat MockERC20 / TicketNFT / TicketMarketplace + block deploy
#      dari broadcast/run-latest.json
#   4. Sinkronkan ABI ke frontend & indexer (sync-abi.sh)
#   5. Tulis alamat baru ke frontend/.env dan indexer/.env.local (+ .env)
#   6. Hapus cache index Ponder supaya reindex dari block deploy yang baru
#   7. Simpan catatan deployment ke deployments/
#
# Pemakaian:
#   bash ./deploy-all.sh                 # deploy + verify + rewire penuh
#   bash ./deploy-all.sh --no-verify     # lewati verifikasi Etherscan
#   bash ./deploy-all.sh --dry-run       # simulasi saja, tidak broadcast
#   bash ./deploy-all.sh --keep-index    # jangan hapus cache Ponder
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

VERIFY=1
DRY_RUN=0
RESET_INDEX=1
STAMP="$(date +%Y%m%d-%H%M%S)"

while [ $# -gt 0 ]; do
  case "$1" in
    --no-verify)  VERIFY=0 ;;
    --dry-run)    DRY_RUN=1 ;;
    --keep-index) RESET_INDEX=0 ;;
    -h|--help)    awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
    *) echo "Opsi tidak dikenal: $1 (pakai --help)" >&2; exit 1 ;;
  esac
  shift
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
fail() { printf '\n\033[1;31mGAGAL: %s\033[0m\n' "$*" >&2; exit 1; }

# ----------------------------------------------------------------- prasyarat
for bin in forge cast jq git; do
  command -v "$bin" >/dev/null 2>&1 || fail "'$bin' tidak ditemukan di PATH."
done

# Dependensi Foundry (contracts/lib) tidak ikut di-commit - ada di .gitignore.
# Pasang otomatis kalau belum ada supaya script ini benar-benar sekali jalan.
# Versi bisa ditimpa lewat env: FORGE_STD_VERSION / OZ_VERSION.
ensure_dep() {
  local name="$1" repo="$2" tag="$3" dir="contracts/lib/$1"
  [ -d "$dir" ] && return 0
  info "Memasang dependensi $name ($tag) ..."
  if git clone --quiet --depth 1 --branch "$tag" "https://github.com/$repo" "$dir" 2>/dev/null; then
    return 0
  fi
  info "Tag $tag tidak tersedia, memakai branch default $repo ..."
  git clone --quiet --depth 1 "https://github.com/$repo" "$dir" ||
    fail "Gagal memasang $name dari https://github.com/$repo"
}

if [ ! -d "contracts/lib/forge-std" ] || [ ! -d "contracts/lib/openzeppelin-contracts" ]; then
  step "Memasang dependensi Foundry"
  ensure_dep forge-std              foundry-rs/forge-std             "${FORGE_STD_VERSION:-v1.9.7}"
  # Kontrak memakai OpenZeppelin v5 (Ownable(msg.sender), utils/ReentrancyGuard.sol).
  ensure_dep openzeppelin-contracts OpenZeppelin/openzeppelin-contracts "${OZ_VERSION:-v5.4.0}"
  info "Dependensi siap."
fi

# ------------------------------------------------------------------ load env
# Parser manual: tahan terhadap CRLF (Windows) dan tanda kutip.
load_env() {
  local f="$1" line key val
  [ -f "$f" ] || fail "Berkas $f tidak ditemukan."
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    case "$line" in *=*) : ;; *) continue ;; esac
    line="${line#export }"
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in *[!A-Za-z0-9_]*) continue ;; esac
    case "$val" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
    esac
    export "$key=$val"
  done < "$f"
}

step "Memuat konfigurasi dari contracts/.env"
load_env "contracts/.env"
[ -n "${PRIVATE_KEY:-}" ]      || fail "PRIVATE_KEY kosong di contracts/.env"
[ -n "${BASE_SEPOLIA_URL:-}" ] || fail "BASE_SEPOLIA_URL kosong di contracts/.env"
if [ "$VERIFY" -eq 1 ] && [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  fail "ETHERSCAN_API_KEY kosong. Isi di contracts/.env atau jalankan dengan --no-verify."
fi

DEPLOYER="$(cast wallet address --private-key "$PRIVATE_KEY")"
CHAIN_ID="$(cast chain-id --rpc-url "$BASE_SEPOLIA_URL" 2>/dev/null || echo 84532)"
BALANCE="$(cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_URL" --ether 2>/dev/null || echo '?')"
info "Deployer : $DEPLOYER"
info "Chain ID : $CHAIN_ID"
info "Saldo    : $BALANCE ETH"

# --------------------------------------------------------------------- deploy
step "Deploy kontrak ke chain $CHAIN_ID"
FORGE_ARGS=(script script/Deploy.s.sol:DeployScript
            --rpc-url "$BASE_SEPOLIA_URL"
            --private-key "$PRIVATE_KEY"
            --legacy)

if [ "$DRY_RUN" -eq 1 ]; then
  info "Mode --dry-run: hanya simulasi, tidak ada transaksi yang dikirim."
else
  FORGE_ARGS+=(--broadcast --slow)
  if [ "$VERIFY" -eq 1 ]; then
    FORGE_ARGS+=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
  else
    info "Verifikasi Etherscan dilewati (--no-verify)."
  fi
fi

( cd contracts && forge "${FORGE_ARGS[@]}" ) || fail "forge script gagal. Tidak ada berkas yang diubah."

if [ "$DRY_RUN" -eq 1 ]; then
  step "Simulasi selesai"
  info "Jalankan tanpa --dry-run untuk benar-benar deploy."
  exit 0
fi

# ---------------------------------------------------------- baca broadcast
BROADCAST="contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
[ -f "$BROADCAST" ] || fail "Berkas broadcast tidak ditemukan: $BROADCAST"

addr_of() {
  jq -r --arg n "$1" \
    '[.transactions[] | select(.transactionType == "CREATE" and .contractName == $n) | .contractAddress] | last // empty' \
    "$BROADCAST"
}

# blockNumber bisa hex ("0x...") atau desimal, tergantung versi Foundry.
to_dec() { printf '%d' "$1" 2>/dev/null || echo ""; }

first_block() {
  local b d min=""
  for b in $(jq -r '.receipts[]?.blockNumber // empty' "$BROADCAST"); do
    d="$(to_dec "$b")"
    [ -n "$d" ] || continue
    if [ -z "$min" ] || [ "$d" -lt "$min" ]; then min="$d"; fi
  done
  printf '%s' "$min"
}

# Foundry menulis alamat dalam huruf kecil; ubah ke bentuk checksum EIP-55.
checksum() { [ -n "$1" ] && cast to-check-sum-address "$1" 2>/dev/null || printf '%s' "$1"; }

IDRX_ADDR="$(checksum "$(addr_of MockERC20)")"
NFT_ADDR="$(checksum "$(addr_of TicketNFT)")"
MARKET_ADDR="$(checksum "$(addr_of TicketMarketplace)")"
START_BLOCK="$(first_block)"

# Cadangan: kalau receipts kosong, ambil block dari receipt transaksi pertama.
if [ -z "$START_BLOCK" ]; then
  TX_HASH="$(jq -r '[.transactions[]?.hash // empty] | first // empty' "$BROADCAST")"
  if [ -n "$TX_HASH" ]; then
    START_BLOCK="$(to_dec "$(cast receipt "$TX_HASH" blockNumber --rpc-url "$BASE_SEPOLIA_URL" 2>/dev/null || echo '')")"
  fi
fi

[ -n "$NFT_ADDR" ]    || fail "Alamat TicketNFT tidak terbaca dari $BROADCAST"
[ -n "$MARKET_ADDR" ] || fail "Alamat TicketMarketplace tidak terbaca dari $BROADCAST"
[ -n "$START_BLOCK" ] || fail "Block deploy tidak terbaca dari $BROADCAST"

step "Alamat kontrak baru"
info "MockERC20 (IDRX)  : $IDRX_ADDR"
info "TicketNFT         : $NFT_ADDR"
info "TicketMarketplace : $MARKET_ADDR"
info "Start block       : $START_BLOCK"

# ------------------------------------------------------------------ sync ABI
step "Sinkronisasi ABI ke frontend & indexer"
bash ./sync-abi.sh

# --------------------------------------------------------- tulis ulang .env
backup() {
  [ -f "$1" ] || return 0
  cp "$1" "$1.bak-$STAMP"
  info "Cadangan: $1.bak-$STAMP"
}

# Ganti nilai kunci yang sudah ada, atau tambahkan di akhir berkas.
set_env() {
  local file="$1" key="$2" val="$3" tmp
  [ -f "$file" ] || : > "$file"
  if grep -qE "^[[:space:]]*(export[[:space:]]+)?$key=" "$file"; then
    tmp="$file.tmp-$$"
    awk -v k="$key" -v v="$val" \
      '$0 ~ "^[[:space:]]*(export[[:space:]]+)?" k "=" { print k "=" v; next } { print }' \
      "$file" > "$tmp" && mv "$tmp" "$file"
  else
    # pastikan berkas diakhiri newline sebelum menambah baris baru
    if [ -s "$file" ] && [ -n "$(tail -c 1 "$file")" ]; then printf '\n' >> "$file"; fi
    printf '%s=%s\n' "$key" "$val" >> "$file"
  fi
}

step "Memperbarui berkas .env"

for f in "frontend/.env" "frontend/.env.local"; do
  [ -f "$f" ] || continue
  backup "$f"
  set_env "$f" NEXT_PUBLIC_MARKETPLACE_ADDRESS "$MARKET_ADDR"
  set_env "$f" NEXT_PUBLIC_NFT_ADDRESS         "$NFT_ADDR"
  if [ -n "$IDRX_ADDR" ]; then
    set_env "$f" NEXT_PUBLIC_IDRX_ADDRESS "$IDRX_ADDR"
  fi
  info "$f diperbarui."
done

# Ponder HANYA membaca .env.local; indexer/.env ikut diperbarui agar konsisten.
for f in "indexer/.env.local" "indexer/.env"; do
  [ -f "$f" ] || continue
  backup "$f"
  set_env "$f" PONDER_TICKET_MARKETPLACE_ADDRESS     "$MARKET_ADDR"
  set_env "$f" PONDER_TICKET_NFT_ADDRESS             "$NFT_ADDR"
  set_env "$f" PONDER_TICKET_MARKETPLACE_START_BLOCK "$START_BLOCK"
  set_env "$f" PONDER_TICKET_NFT_START_BLOCK         "$START_BLOCK"
  info "$f diperbarui."
done

# ------------------------------------------------------ reset cache indexer
if [ -d "indexer/.ponder" ]; then
  if [ "$RESET_INDEX" -eq 1 ]; then
    step "Menghapus cache index Ponder"
    info "Data lama menunjuk kontrak lama, jadi harus diindeks ulang dari block $START_BLOCK."
    rm -rf "indexer/.ponder"
    info "indexer/.ponder dihapus (dibangun ulang otomatis saat 'ponder dev')."
  else
    info "Cache Ponder dipertahankan (--keep-index) - data lama masih memakai alamat lama."
  fi
fi

# ------------------------------------------------------- catatan deployment
mkdir -p deployments
RECORD="deployments/$CHAIN_ID-$STAMP.json"
if [ "$VERIFY" -eq 1 ]; then VERIFIED_JSON=true; else VERIFIED_JSON=false; fi
jq -n \
  --arg chainId    "$CHAIN_ID" \
  --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg deployer   "$DEPLOYER" \
  --arg idrx       "$IDRX_ADDR" \
  --arg nft        "$NFT_ADDR" \
  --arg market     "$MARKET_ADDR" \
  --arg block      "$START_BLOCK" \
  --arg commit     "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)" \
  --argjson verified "$VERIFIED_JSON" \
  '{chainId: ($chainId | tonumber), deployedAt: $deployedAt, gitCommit: $commit,
    deployer: $deployer, startBlock: ($block | tonumber), verified: $verified,
    contracts: {MockERC20_IDRX: $idrx, TicketNFT: $nft, TicketMarketplace: $market}}' \
  > "$RECORD"
cp "$RECORD" "deployments/latest.json"

step "Selesai"
info "Catatan deployment: $RECORD"

printf '\n'
printf 'Langkah berikutnya:\n'
printf '  1. Indexer  : cd indexer  && npm run dev   (reindex dari block %s)\n' "$START_BLOCK"
printf '  2. Frontend : cd frontend && npm run dev\n'
printf '  3. Produksi : perbarui env di dashboard hosting (Netlify/Railway) -\n'
printf '                NEXT_PUBLIC_MARKETPLACE_ADDRESS, NEXT_PUBLIC_NFT_ADDRESS,\n'
printf '                NEXT_PUBLIC_IDRX_ADDRESS, PONDER_TICKET_*_ADDRESS/START_BLOCK.\n'
printf '\n'
printf 'Deployer %s sudah otomatis jadi approved creator, dan kategori\n' "$DEPLOYER"
printf 'tiket 1/2/3 (REGULER/VIP/VVIP) sudah dikonfigurasi oleh Deploy.s.sol.\n'
