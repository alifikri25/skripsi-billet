// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TicketNFT} from "../TicketNFT.sol";

interface ITicketMarketplace {

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 amount;
        uint256 pricePerUnit;   // harga per 1 tiket, dalam satuan IDRX (wei)
        uint256 originalPrice;  // harga primary sale, digunakan untuk ceiling & royalti
        bool    active;
        bool    isResale;
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    event TicketListed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256         amount,
        uint256         pricePerUnit,
        bool            isResale
    );

    event TicketSold(
        uint256 indexed listingId,
        address indexed buyer,
        uint256         amount,
        uint256         totalPrice
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller
    );

    // ─── Custom Errors ───────────────────────────────────────────────────────

    error PriceCeilingExceeded(uint256 asked, uint256 maxAllowed);
    error InsufficientPayment(uint256 sent, uint256 required);
    error InsufficientAllowance(uint256 current, uint256 required);
    error ListingNotActive(uint256 listingId);
    error NotSeller(uint256 listingId, address caller);
    error ZeroAmount();
    error UnauthorizedTransfer();
    error SaleNotStarted(uint256 start, uint256 current);
    error SaleEnded(uint256 end, uint256 current);
    error ArrayLengthMismatch();
    error InsufficientUnusedTickets(uint256 available, uint256 requested);
    error ZeroAddress();
    error InsufficientListingAmount(uint256 available, uint256 requested);
    error ExceedsMaxPurchaseLimit();
    error InsufficientEscrowBalance(uint256 available, uint256 requested);
    error NotApprovedCreator();
    error WalletLimitExceeded(uint256 tokenId, uint256 attempted, uint256 max);
    error NikLimitExceeded(uint256 tokenId, uint256 attempted, uint256 max);

    // ─── Functions ───────────────────────────────────────────────────────────

    function createAndListEvent(
        TicketNFT.EventParams calldata params
    ) external returns (uint256);

    function listPrimary(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit
    ) external;

    function listResale(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit
    ) external;

    function buyTicket(
        uint256 listingId,
        uint256 amount,
        bytes32[] calldata nikHashes,
        string[] calldata names
    ) external;

    function cancelListing(uint256 listingId) external;

    function getListing(uint256 listingId)
        external
        view
        returns (Listing memory);
}
