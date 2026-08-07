// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

contract TicketNFT is ERC1155, ERC2981, Ownable {
    // ─── Structs ─────────────────────────────────────────────────────────────

    struct TicketHolder {
        string name;
        bytes32 nikHash; // Hash NIK (keccak256) — NIK asli TIDAK PERNAH disimpan on-chain demi privasi.
        bool registered;
        bool used;
    }

    // ─── Constants ───────────────────────────────────────────────────────────

    /// @notice Penyebut basis points (10000 = 100%).
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Batas atas royalti yang boleh diset penyelenggara (1000 bps = 10%).
    ///         Mencegah konfigurasi royalti absurd yang merugikan pasar sekunder.
    uint96 public constant MAX_ROYALTY_BPS = 1000;

    // ─── State Variables ─────────────────────────────────────────────────────

    /// @notice Address marketplace yang diizinkan melakukan transfer.
    address public authorizedMarketplace;

    /// @notice Alamat gatekeeper yang diizinkan melakukan check-in tiket.
    mapping(address => bool) public isGateKeeper;

    /// @dev tokenId => Nama Kategori Tiket (VVIP, VIP, Reguler)
    mapping(uint256 => string) public ticketCategoryName;

    /// @dev owner => tokenId => TicketHolder[]
    mapping(address => mapping(uint256 => TicketHolder[]))
        private _ticketHolders;

    /// @dev owner => tokenId => jumlah holder terdaftar yang BELUM check-in.
    ///      Counter agregat agar perhitungan O(1) (hindari loop array — anti gas DoS).
    mapping(address => mapping(uint256 => uint256)) private _unusedCount;

    /// @dev owner => tokenId => jumlah holder yang SUDAH check-in.
    mapping(address => mapping(uint256 => uint256)) private _usedCount;

    /// @dev tokenId => harga primary sale dalam wei (untuk referensi ceiling).
    mapping(uint256 => uint256) public primaryPrice;

    /// @dev tokenId => supply maksimum tiket per kategori.
    mapping(uint256 => uint256) public maxSupply;

    /// @dev tokenId => berapa sudah di-mint.
    mapping(uint256 => uint256) public totalMinted;

    /// @dev tokenId => price ceiling kustom dalam basis points (misal 11000 = 110%).
    mapping(uint256 => uint256) public priceCeilingBps;

    /// @dev tokenId => timestamp mulai penjualan.
    mapping(uint256 => uint256) public saleStart;

    /// @dev tokenId => timestamp selesai penjualan.
    mapping(uint256 => uint256) public saleEnd;

    // ─── Event Metadata & Dynamic IDs (Multi-Creator SaaS Platform) ──────────

    struct EventDetails {
        string title;
        string venue;
        string date;
        string city;
        string category;
        address creator;
    }

    struct EventParams {
        uint256 supply;
        uint256 price;
        uint256 ceilingBps;
        uint96 royaltyBps;
        uint256 start;
        uint256 end;
        string title;
        string venue;
        string date;
        string city;
        string category;
    }

    /// @notice Metadata on-chain untuk setiap kategori tiket (Token ID)
    mapping(uint256 => EventDetails) public eventDetails;

    uint256 private _nextTokenId;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TicketCheckedIn(
        address indexed from,
        uint256 indexed tokenId,
        uint256 index
    );

    /// @notice Dipancarkan saat alamat marketplace resmi diubah oleh owner.
    event AuthorizedMarketplaceUpdated(address indexed marketplace);

    /// @notice Dipancarkan saat status gatekeeper diubah oleh owner.
    event GateKeeperUpdated(address indexed gateKeeper, bool status);

    /// @notice Dipancarkan saat nama kategori tiket diset/diubah.
    event CategoryNameUpdated(uint256 indexed tokenId, string name);

    /// @notice Dipancarkan saat kategori tiket dikonfigurasi via configureTicketCategory.
    event TicketCategoryConfigured(
        uint256 indexed tokenId,
        uint256 supply,
        uint256 price,
        uint256 ceilingBps,
        uint96 royaltyBps,
        uint256 start,
        uint256 end
    );

    /// @notice Dipancarkan saat kategori tiket dinamis dibuat via createTicketCategory.
    event TicketCategoryCreated(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 supply,
        uint256 price,
        uint256 ceilingBps,
        uint96 royaltyBps
    );

    // ─── Errors ──────────────────────────────────────────────────────────────

    error UnauthorizedTransfer();
    error ExceedsMaxSupply(
        uint256 tokenId,
        uint256 requested,
        uint256 remaining
    );
    error MarketplaceNotSet();
    error NotGateKeeper();
    /// @dev Ceiling tidak boleh di bawah 100% (akan memblokir resale at-cost).
    error InvalidCeilingBps(uint256 provided);
    /// @dev Royalti melebihi batas maksimum (MAX_ROYALTY_BPS).
    error InvalidRoyaltyBps(uint256 provided);
    /// @dev Sale window tidak valid (start harus lebih kecil dari end bila keduanya diisi).
    error InvalidSaleWindow(uint256 start, uint256 end);
    /// @dev Kategori sudah memiliki tiket ter-mint; parameter tidak boleh diubah retroaktif.
    error CategoryLocked(uint256 tokenId);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────

    /// @notice Set alamat marketplace yang diizinkan melakukan transfer.
    ///         Dipanggil setelah TicketMarketplace di-deploy.
    function setAuthorizedMarketplace(address marketplace) external onlyOwner {
        authorizedMarketplace = marketplace;
        emit AuthorizedMarketplaceUpdated(marketplace);
    }

    /// @notice Set status alamat gatekeeper yang diizinkan membakar tiket di gerbang.
    function setGateKeeper(address gateKeeper, bool status) external onlyOwner {
        isGateKeeper[gateKeeper] = status;
        emit GateKeeperUpdated(gateKeeper, status);
    }

    /// @notice Set nama kategori tiket.
    function setTicketCategoryName(
        uint256 tokenId,
        string calldata name
    ) external onlyOwner {
        ticketCategoryName[tokenId] = name;
        emit CategoryNameUpdated(tokenId, name);
    }

    /// @notice Konfigurasi kategori tiket baru.
    /// @param tokenId    ID kategori tiket.
    /// @param supply     Jumlah maksimum tiket.
    /// @param price      Harga primary sale dalam wei.
    /// @param ceilingBps Batas atas harga kustom dalam basis points (misal 11000 = 110%).
    /// @param royaltyBps Persentase royalti dalam basis points (500 = 5%).
    /// @param start      Timestamp mulai penjualan (0 jika tidak dibatasi).
    /// @param end        Timestamp selesai penjualan (0 jika tidak dibatasi).
    function configureTicketCategory(
        uint256 tokenId,
        uint256 supply,
        uint256 price,
        uint256 ceilingBps,
        uint96 royaltyBps,
        uint256 start,
        uint256 end
    ) external onlyOwner {
        // Kunci parameter setelah ada tiket ter-mint untuk mencegah perubahan
        // harga/ceiling/royalti secara retroaktif yang merugikan pembeli.
        if (totalMinted[tokenId] > 0) revert CategoryLocked(tokenId);
        _validateCategoryParams(ceilingBps, royaltyBps, start, end);

        maxSupply[tokenId] = supply;
        primaryPrice[tokenId] = price;
        priceCeilingBps[tokenId] = ceilingBps;
        saleStart[tokenId] = start;
        saleEnd[tokenId] = end;
        _setTokenRoyalty(tokenId, owner(), royaltyBps);

        emit TicketCategoryConfigured(
            tokenId,
            supply,
            price,
            ceilingBps,
            royaltyBps,
            start,
            end
        );
    }

    /// @dev Validasi parameter konfigurasi kategori agar tidak merusak invarian ekonomi.
    ///      - ceilingBps minimal 100% (10000) agar resale at-cost tetap mungkin.
    ///      - royaltyBps maksimal MAX_ROYALTY_BPS (10%).
    ///      - start harus lebih kecil dari end bila keduanya non-zero.
    function _validateCategoryParams(
        uint256 ceilingBps,
        uint96 royaltyBps,
        uint256 start,
        uint256 end
    ) private pure {
        if (ceilingBps < BPS_DENOMINATOR) revert InvalidCeilingBps(ceilingBps);
        if (royaltyBps > MAX_ROYALTY_BPS) revert InvalidRoyaltyBps(royaltyBps);
        if (start != 0 && end != 0 && start >= end) {
            revert InvalidSaleWindow(start, end);
        }
    }

    /// @notice Mint tiket ke address marketplace (escrow awal).
    ///         Marketplace yang kemudian mendistribusikan ke pembeli.
    function mintToMarketplace(
        uint256 tokenId,
        uint256 amount
    ) external onlyOwner {
        if (authorizedMarketplace == address(0)) revert MarketplaceNotSet();
        if (totalMinted[tokenId] + amount > maxSupply[tokenId]) {
            revert ExceedsMaxSupply(
                tokenId,
                amount,
                maxSupply[tokenId] - totalMinted[tokenId]
            );
        }
        totalMinted[tokenId] += amount;
        _mint(authorizedMarketplace, tokenId, amount, "");
    }

    /// @notice Membuat kategori tiket baru secara dinamis.
    /// @dev LIMITASI PoC: Fungsi ini terbuka bagi publik untuk menyederhanakan demonstrasi platform.
    ///      Pada sistem produksi komersial, pencegahan spam token ID kosong diselesaikan menggunakan
    ///      mekanisme staking deposit token, whitelist kreator, atau pembuatan berbayar (creation fee).
    function createTicketCategory(
        address creator,
        EventParams calldata params
    ) external returns (uint256) {
        if (msg.sender != authorizedMarketplace && msg.sender != owner())
            revert UnauthorizedTransfer();

        _validateCategoryParams(
            params.ceilingBps,
            params.royaltyBps,
            params.start,
            params.end
        );

        uint256 tokenId = _nextTokenId++;

        maxSupply[tokenId] = params.supply;
        primaryPrice[tokenId] = params.price;
        priceCeilingBps[tokenId] = params.ceilingBps;
        saleStart[tokenId] = params.start;
        saleEnd[tokenId] = params.end;

        // Set royalti ERC-2981 langsung mengalir ke dompet creator (bukan owner platform)
        _setTokenRoyalty(tokenId, creator, params.royaltyBps);

        // Simpan metadata di blockchain
        eventDetails[tokenId] = EventDetails({
            title: params.title,
            venue: params.venue,
            date: params.date,
            city: params.city,
            category: params.category,
            creator: creator
        });

        totalMinted[tokenId] += params.supply;
        _mint(authorizedMarketplace, tokenId, params.supply, "");

        emit TicketCategoryCreated(
            tokenId,
            creator,
            params.supply,
            params.price,
            params.ceilingBps,
            params.royaltyBps
        );

        return tokenId;
    }

    /// @notice Dapatkan rentang waktu penjualan tiket.
    function getSaleWindow(
        uint256 tokenId
    ) external view returns (uint256, uint256) {
        return (saleStart[tokenId], saleEnd[tokenId]);
    }

    // ─── Identity & Check-in Functions ───────────────────────────────────────

    /// @notice Registrasi data pembeli tiket. Hanya bisa dipanggil oleh Marketplace resmi.
    /// @dev `nikHash` adalah keccak256 dari NIK yang dihitung di sisi klien (frontend),
    ///      sehingga NIK plaintext tidak pernah tercatat di ledger publik.
    function registerHolder(
        address owner,
        uint256 tokenId,
        string calldata name,
        bytes32 nikHash
    ) external {
        if (msg.sender != authorizedMarketplace) revert UnauthorizedTransfer();
        _ticketHolders[owner][tokenId].push(
            TicketHolder({name: name, nikHash: nikHash, registered: true, used: false})
        );
        _unusedCount[owner][tokenId] += 1;
    }

    /// @notice Dapatkan jumlah tiket yang sudah digunakan (di-check-in). O(1).
    function getUsedTicketCount(
        address owner,
        uint256 tokenId
    ) public view returns (uint256) {
        return _usedCount[owner][tokenId];
    }

    /// @notice Dapatkan jumlah tiket yang belum digunakan. O(1).
    function getUnusedTicketCount(
        address owner,
        uint256 tokenId
    ) public view returns (uint256) {
        return _unusedCount[owner][tokenId];
    }

    /// @notice Hapus data holder yang belum digunakan (saat resale terjual). Hanya bisa dipanggil oleh Marketplace resmi.
    /// @dev Menghapus holder unused dengan index TERKECIL secara deterministik menggunakan
    ///      swap-and-pop, sehingga array benar-benar menyusut (tidak menyisakan "zombie"
    ///      seperti `delete`) — mencegah pembengkakan array & gas DoS.
    function removeUnusedHolder(address owner, uint256 tokenId) external {
        if (msg.sender != authorizedMarketplace) revert UnauthorizedTransfer();
        TicketHolder[] storage holders = _ticketHolders[owner][tokenId];
        uint256 length = holders.length;
        for (uint256 i = 0; i < length; i++) {
            if (holders[i].registered && !holders[i].used) {
                uint256 last = length - 1;
                if (i != last) {
                    holders[i] = holders[last];
                }
                holders.pop();
                _unusedCount[owner][tokenId] -= 1;
                return;
            }
        }
        revert("No unused ticket holder found");
    }

    /// @notice Melakukan check-in tiket penonton di gerbang masuk oleh gatekeeper resmi.
    ///         Membatalkan pembakaran NFT, melestarikan tiket sebagai kenang-kenangan dengan menandai properti used = true.
    function checkInFromGate(
        address from,
        uint256 tokenId,
        uint256 index
    ) external {
        address creator = eventDetails[tokenId].creator;
        if (
            !isGateKeeper[msg.sender] &&
            msg.sender != owner() &&
            msg.sender != creator
        ) revert NotGateKeeper();

        uint256 length = _ticketHolders[from][tokenId].length;
        require(index < length, "Index out of bounds");
        require(
            _ticketHolders[from][tokenId][index].registered,
            "Ticket not registered"
        );
        require(
            !_ticketHolders[from][tokenId][index].used,
            "Ticket already used"
        );

        // Invarian: saldo token user tidak boleh kurang dari jumlah unused ticket yang tersisa
        // Mencegah check-in tiket yang sedang di-escrow/listing di marketplace
        uint256 usedCount = getUsedTicketCount(from, tokenId);
        require(
            balanceOf(from, tokenId) > usedCount,
            "Insufficient ticket balance in wallet"
        );

        _ticketHolders[from][tokenId][index].used = true;
        _usedCount[from][tokenId] += 1;
        _unusedCount[from][tokenId] -= 1;

        emit TicketCheckedIn(from, tokenId, index);
    }

    /// @notice Dapatkan data pembeli tiket terdaftar (read-only untuk panel panitia)
    function getTicketHolders(
        address owner,
        uint256 tokenId
    ) external view returns (TicketHolder[] memory) {
        return _ticketHolders[owner][tokenId];
    }

    // ─── Transfer Gating ─────────────────────────────────────────────────────

    /// @dev Override _update (OZ v5) — titik kontrol semua transfer ERC-1155.
    ///      Transfer diizinkan hanya jika:
    ///      - Ini adalah operasi mint (from == address(0)), ATAU
    ///      - Ini adalah operasi burn (to == address(0)), ATAU
    ///      - Salah satu pihak (from atau to) adalah authorizedMarketplace.
    ///
    ///      Dengan ini, user tidak bisa transfer langsung ke sesama wallet.
    ///      Semua transaksi HARUS melalui marketplace resmi.
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        bool isMint = (from == address(0));
        bool isBurn = (to == address(0));
        bool isAuthorized = (from == authorizedMarketplace ||
            to == authorizedMarketplace);

        if (!isMint && !isBurn && !isAuthorized) {
            revert UnauthorizedTransfer();
        }

        super._update(from, to, ids, values);
    }

    // ─── Interface Support ───────────────────────────────────────────────────

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
