// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TicketNFT} from "./TicketNFT.sol";
import {ITicketMarketplace} from "./interfaces/ITicketMarketplace.sol";
import {PriceLib} from "./libraries/PriceLib.sol";

contract TicketMarketplace is
    ITicketMarketplace,
    ERC1155Holder,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    // ─── Constants ───────────────────────────────────────────────────────────

    /// @notice Batas maksimum jumlah tiket yang boleh dibeli dalam satu transaksi.
    ///         Catatan: ini limit per-transaksi (anti-bot dasar), bukan limit kumulatif
    ///         per pembeli — limit kumulatif diterapkan terpisah (lihat F2 pada PRD).
    uint256 public constant MAX_PURCHASE_PER_TX = 5;

    /// @notice Batas KUMULATIF jumlah tiket yang boleh dimiliki satu wallet (dan satu
    ///         identitas/NIK) per kategori tiket — lintas semua transaksi. Ini menutup
    ///         celah Sybil di mana batas per-transaksi (MAX_PURCHASE_PER_TX) dapat
    ///         dilewati dengan memanggil buyTicket berulang kali.
    uint256 public constant MAX_PER_WALLET = 5;

    // ─── State Variables ─────────────────────────────────────────────────────

    TicketNFT public immutable TICKET_NFT;
    IERC20    public immutable PAYMENT_TOKEN; // Koin IDRX Stablecoin

    uint256 private _nextListingId;

    /// @dev listingId => Listing
    mapping(uint256 => Listing) private _listings;

    /// @notice Daftar putih kreator yang diizinkan membuat & me-listing event.
    ///         Mencegah spam event palsu pada platform multi-creator (SaaS).
    mapping(address => bool) public isApprovedCreator;

    /// @dev tokenId => wallet => total tiket yang sudah dibeli (kumulatif).
    mapping(uint256 => mapping(address => uint256)) public purchasedPerWallet;

    /// @dev tokenId => hash(NIK) => total tiket yang sudah dibeli atas identitas tsb.
    mapping(uint256 => mapping(bytes32 => uint256)) public purchasedPerNik;

    // ─── Events ──────────────────────────────────────────────────────────────

    /// @notice Dipancarkan saat owner mengubah status whitelist kreator.
    event CreatorApproved(address indexed creator, bool status);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address ticketNftAddress, address paymentTokenAddress)
        Ownable(msg.sender)
    {
        if (ticketNftAddress == address(0)) revert ZeroAddress();
        if (paymentTokenAddress == address(0)) revert ZeroAddress();

        TICKET_NFT = TicketNFT(ticketNftAddress);
        PAYMENT_TOKEN = IERC20(paymentTokenAddress);
    }

    // ─── Emergency Stop (Admin) ──────────────────────────────────────────────

    /// @notice Hentikan sementara aktivitas jual-beli (emergency stop). Hanya owner.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Lanjutkan kembali aktivitas jual-beli. Hanya owner.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Creator Whitelist (Admin) ───────────────────────────────────────────

    /// @notice Set status whitelist kreator. Hanya owner platform.
    /// @param creator Alamat kreator/agency.
    /// @param status  true = diizinkan membuat event, false = dicabut.
    function setApprovedCreator(address creator, bool status) external onlyOwner {
        isApprovedCreator[creator] = status;
        emit CreatorApproved(creator, status);
    }

    // ─── Event Creation & Listing ────────────────────────────────────────────

    /// @notice Membuat kategori tiket baru on-chain dan langsung mendaftarkannya untuk primary sale.
    /// @dev Fungsi atomic ini hanya dapat dipanggil oleh kreator yang telah di-whitelist
    ///      (atau owner platform), mencegah pembuatan event palsu/spam.
    function createAndListEvent(
        TicketNFT.EventParams calldata params
    )
        external
        override
        whenNotPaused
        returns (uint256)
    {
        if (msg.sender != owner() && !isApprovedCreator[msg.sender]) {
            revert NotApprovedCreator();
        }
        if (params.supply == 0) revert ZeroAmount();

        // 1. Buat kategori tiket dan mint ke marketplace secara atomic
        uint256 tokenId = TICKET_NFT.createTicketCategory(
            msg.sender,
            params
        );

        // 2. Daftarkan primary listing di marketplace
        uint256 listingId = _nextListingId++;
        _listings[listingId] = Listing({
            seller:        msg.sender,
            tokenId:       tokenId,
            amount:        params.supply,
            pricePerUnit:  params.price,
            originalPrice: params.price,
            active:        true,
            isResale:      false
        });

        emit TicketListed(listingId, msg.sender, tokenId, params.supply, params.price, false);

        return listingId;
    }

    // ─── Primary Listing ─────────────────────────────────────────────────────

    /// @notice Organizer mendaftarkan tiket untuk primary sale.
    ///         Tiket sudah harus di-mint ke marketplace sebelum fungsi ini dipanggil.
    /// @param tokenId      ID kategori tiket.
    /// @param amount       Jumlah tiket yang di-listing.
    /// @param pricePerUnit Harga per tiket dalam satuan IDRX (wei).
    function listPrimary(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit
    )
        external
        override
        onlyOwner
        whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();

        // Guard: tiket harus benar-benar sudah di-escrow ke marketplace sebelum di-listing,
        // mencegah listing "kosong" yang melebihi supply ter-mint.
        uint256 escrowBalance = TICKET_NFT.balanceOf(address(this), tokenId);
        if (amount > escrowBalance) {
            revert InsufficientEscrowBalance(escrowBalance, amount);
        }

        uint256 listingId = _nextListingId++;
        _listings[listingId] = Listing({
            seller:        msg.sender,
            tokenId:       tokenId,
            amount:        amount,
            pricePerUnit:  pricePerUnit,
            originalPrice: pricePerUnit,
            active:        true,
            isResale:      false
        });

        emit TicketListed(listingId, msg.sender, tokenId, amount, pricePerUnit, false);
    }

    // ─── Resale Listing ──────────────────────────────────────────────────────

    /// @notice User yang sudah punya tiket mendaftarkan untuk dijual kembali.
    ///         Kontrak menerapkan price ceiling kustom per kategori tiket.
    /// @param tokenId        ID tiket.
    /// @param amount         Jumlah tiket.
    /// @param pricePerUnit   Harga jual per tiket dalam satuan IDRX (wei).
    function listResale(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit
    )
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();

        // 1. Tarik original price yang SAH langsung dari TicketNFT
        uint256 trueOriginalPrice = TICKET_NFT.primaryPrice(tokenId);

        // 2. Terapkan price ceiling kustom dari kontrak NFT menggunakan data sah (Single Source of Truth)
        uint256 ceilingBps = TICKET_NFT.priceCeilingBps(tokenId);
        uint256 maxPrice = PriceLib.maxResalePrice(trueOriginalPrice, ceilingBps);
        if (pricePerUnit > maxPrice) {
            revert PriceCeilingExceeded(pricePerUnit, maxPrice);
        }

        // 3. Validasi bahwa penjual memiliki jumlah unused ticket yang memadai
        uint256 unusedCount = TICKET_NFT.getUnusedTicketCount(msg.sender, tokenId);
        if (amount > unusedCount) {
            revert InsufficientUnusedTickets(unusedCount, amount);
        }

        // Transfer tiket dari seller ke kontrak (escrow)
        TICKET_NFT.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        uint256 listingId = _nextListingId++;
        _listings[listingId] = Listing({
            seller:        msg.sender,
            tokenId:       tokenId,
            amount:        amount,
            pricePerUnit:  pricePerUnit,
            originalPrice: trueOriginalPrice,
            active:        true,
            isResale:      true
        });

        emit TicketListed(listingId, msg.sender, tokenId, amount, pricePerUnit, true);
    }

    // ─── Buy ─────────────────────────────────────────────────────────────────

    /// @notice Pembeli membeli tiket dari listing aktif menggunakan token IDRX.
    ///         Untuk resale: royalti kondisional otomatis dihitung dan ditahan.
    ///         Dana sisa dikirim ke seller. Tiket dikirim ke buyer.
    /// @param listingId ID listing yang ingin dibeli.
    /// @param amount    Jumlah tiket yang ingin dibeli.
    /// @param nikHashes Array hash NIK (keccak256) pemegang tiket baru — di-hash di sisi klien.
    /// @param names     Array nama pemegang tiket baru.
    function buyTicket(
        uint256 listingId,
        uint256 amount,
        bytes32[] calldata nikHashes,
        string[] calldata names
    )
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (amount == 0)                       revert ZeroAmount();
        if (amount > MAX_PURCHASE_PER_TX)      revert ExceedsMaxPurchaseLimit();
        if (nikHashes.length != amount || names.length != amount) revert ArrayLengthMismatch();

        Listing storage listing = _listings[listingId];

        if (!listing.active)     revert ListingNotActive(listingId);

        // Validasi waktu penjualan tiket perdana (Primary Sale Only)
        if (!listing.isResale) {
            (uint256 start, uint256 end) = TICKET_NFT.getSaleWindow(listing.tokenId);
            if (start != 0 && block.timestamp < start) {
                revert SaleNotStarted(start, block.timestamp);
            }
            if (end != 0 && block.timestamp > end) {
                revert SaleEnded(end, block.timestamp);
            }
        }

        uint256 totalPrice = listing.pricePerUnit * amount;

        if (amount > listing.amount) revert InsufficientListingAmount(listing.amount, amount);

        // Limit KUMULATIF per-wallet (anti-Sybil terhadap batas per-transaksi).
        uint256 tokenId = listing.tokenId;
        uint256 newWalletTotal = purchasedPerWallet[tokenId][msg.sender] + amount;
        if (newWalletTotal > MAX_PER_WALLET) {
            revert WalletLimitExceeded(tokenId, newWalletTotal, MAX_PER_WALLET);
        }
        purchasedPerWallet[tokenId][msg.sender] = newWalletTotal;

        // Cek kecukupan saldo & allowance token IDRX pembeli
        uint256 buyerBalance = PAYMENT_TOKEN.balanceOf(msg.sender);
        if (buyerBalance < totalPrice) {
            revert InsufficientPayment(buyerBalance, totalPrice);
        }
        
        uint256 allowance = PAYMENT_TOKEN.allowance(msg.sender, address(this));
        if (allowance < totalPrice) {
            revert InsufficientAllowance(allowance, totalPrice);
        }

        // Update state sebelum transfer (Checks-Effects-Interactions pattern)
        listing.amount -= amount;
        if (listing.amount == 0) listing.active = false;

        // Registrasi data identitas on-chain di NFT + enforce limit KUMULATIF per-NIK.
        // nikHashes sudah berupa hash (di-hash di sisi klien), jadi dipakai langsung.
        for (uint256 i = 0; i < amount; i++) {
            bytes32 nikHash = nikHashes[i];
            uint256 newNikTotal = purchasedPerNik[tokenId][nikHash] + 1;
            if (newNikTotal > MAX_PER_WALLET) {
                revert NikLimitExceeded(tokenId, newNikTotal, MAX_PER_WALLET);
            }
            purchasedPerNik[tokenId][nikHash] = newNikTotal;

            TICKET_NFT.registerHolder(msg.sender, listing.tokenId, names[i], nikHashes[i]);
        }

        // Jika ini adalah resale, hapus data identitas dari seller
        if (listing.isResale) {
            for (uint256 i = 0; i < amount; i++) {
                TICKET_NFT.removeUnusedHolder(listing.seller, listing.tokenId);
            }
        }

        // Hitung distribusi dana
        uint256 royaltyAmount = 0;
        uint256 sellerProceeds = totalPrice;
        address royaltyReceiver;

        if (listing.isResale) {
            if (totalPrice > listing.originalPrice * amount) {
                // Ambil royalti dinamis dari standard ERC-2981 NFT
                (royaltyReceiver, royaltyAmount) = TICKET_NFT.royaltyInfo(listing.tokenId, totalPrice);
            }
            sellerProceeds = totalPrice - royaltyAmount;
        }

        // Eksekusi transfer token IDRX secara atomik DULU (Checks-Effects-Interactions Compliance)
        if (royaltyAmount > 0) {
            bool royaltyPaid = PAYMENT_TOKEN.transferFrom(msg.sender, royaltyReceiver, royaltyAmount);
            require(royaltyPaid, "Royalty transfer failed");
        }
        
        if (sellerProceeds > 0) {
            bool proceedsPaid = PAYMENT_TOKEN.transferFrom(msg.sender, listing.seller, sellerProceeds);
            require(proceedsPaid, "Proceeds transfer failed");
        }

        // Baru setelah itu transfer tiket ke buyer dari escrow
        TICKET_NFT.safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            amount,
            ""
        );

        emit TicketSold(listingId, msg.sender, amount, totalPrice);
    }

    // ─── Cancel Listing ──────────────────────────────────────────────────────

    /// @notice Seller membatalkan listing resale dan mengambil kembali tiketnya.
    function cancelListing(uint256 listingId)
        external
        override
        nonReentrant
    {
        Listing storage listing = _listings[listingId];

        if (!listing.active)             revert ListingNotActive(listingId);
        if (listing.seller != msg.sender) revert NotSeller(listingId, msg.sender);

        listing.active = false;

        // Kembalikan tiket ke seller HANYA jika ini adalah resale
        // (Organisator tidak menerima tiket kembali untuk Primary karena langsung di-mint ke escrow)
        if (listing.isResale) {
            TICKET_NFT.safeTransferFrom(
                address(this),
                msg.sender,
                listing.tokenId,
                listing.amount,
                ""
            );
        }

        emit ListingCancelled(listingId, msg.sender);
    }

    // ─── View ────────────────────────────────────────────────────────────────

    function getListing(uint256 listingId)
        external
        view
        override
        returns (Listing memory)
    {
        return _listings[listingId];
    }
}
