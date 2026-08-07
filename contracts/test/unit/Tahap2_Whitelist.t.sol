// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {TicketNFT} from "../../src/TicketNFT.sol";
import {TicketMarketplace} from "../../src/TicketMarketplace.sol";
import {ITicketMarketplace} from "../../src/interfaces/ITicketMarketplace.sol";

/// @title Tahap 2 — Whitelist Creator (F1)
/// @notice Memastikan hanya kreator ter-whitelist (atau owner) yang dapat membuat event.
contract Tahap2WhitelistTest is TestHelper {

    function _params() internal pure returns (TicketNFT.EventParams memory) {
        return TicketNFT.EventParams({
            supply:     100,
            price:      PRICE_REGULER,
            ceilingBps: 11000,
            royaltyBps: 500,
            start:      0,
            end:        0,
            title:      "Konser Skripsi",
            venue:      "GBK",
            date:       "2026-07-01",
            city:       "Jakarta",
            category:   "Musik"
        });
    }

    // ── Negatif: kreator non-whitelist tidak boleh membuat event ──────────────
    function test_CreateAndList_RevertIfNotApprovedCreator() public {
        vm.prank(bob); // bob bukan owner & belum di-whitelist
        vm.expectRevert(ITicketMarketplace.NotApprovedCreator.selector);
        marketplace.createAndListEvent(_params());
    }

    // ── Positif: kreator yang di-approve owner bisa membuat event ─────────────
    function test_CreateAndList_SuccessAfterApproval() public {
        vm.prank(organizer); // organizer = owner marketplace (deploy di setUp)
        marketplace.setApprovedCreator(bob, true);

        vm.prank(bob);
        uint256 listingId = marketplace.createAndListEvent(_params());

        ITicketMarketplace.Listing memory l = marketplace.getListing(listingId);
        assertEq(l.seller, bob, "Seller harus kreator yang di-approve");
        assertEq(l.amount, 100);
        assertTrue(l.active);
    }

    // ── Positif: owner platform bisa membuat event tanpa perlu di-whitelist ───
    function test_CreateAndList_OwnerBypassesWhitelist() public {
        vm.prank(organizer); // owner
        uint256 listingId = marketplace.createAndListEvent(_params());

        assertEq(marketplace.getListing(listingId).seller, organizer);
    }

    // ── setApprovedCreator: hanya owner ───────────────────────────────────────
    function test_SetApprovedCreator_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        marketplace.setApprovedCreator(bob, true);
    }

    // ── setApprovedCreator: memancarkan event & menyimpan status ──────────────
    function test_SetApprovedCreator_EmitsEventAndStores() public {
        vm.expectEmit(true, true, true, true);
        emit TicketMarketplace.CreatorApproved(bob, true);
        vm.prank(organizer);
        marketplace.setApprovedCreator(bob, true);

        assertTrue(marketplace.isApprovedCreator(bob));

        // Cabut kembali
        vm.prank(organizer);
        marketplace.setApprovedCreator(bob, false);
        assertFalse(marketplace.isApprovedCreator(bob));
    }
}
