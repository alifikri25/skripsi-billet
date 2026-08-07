// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {TicketNFT} from "../../src/TicketNFT.sol";
import {ITicketMarketplace} from "../../src/interfaces/ITicketMarketplace.sol";

/// @title Tahap 1 — Hardening Tests (F3 event, F4 validasi, F9 guard, F10 konstanta)
/// @notice Test untuk perbaikan Tahap 1 sesuai PRD-PERBAIKAN.md.
contract Tahap1HardeningTest is TestHelper {

    // ════════════════════════════════════════════════════════════════
    //  F4 — VALIDASI PARAMETER KATEGORI
    // ════════════════════════════════════════════════════════════════

    function test_Configure_RevertIfCeilingBelow100Percent() public {
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(TicketNFT.InvalidCeilingBps.selector, 9999)
        );
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 9999, 500, 0, 0);
    }

    function test_Configure_RevertIfRoyaltyTooHigh() public {
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(TicketNFT.InvalidRoyaltyBps.selector, 1001)
        );
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 1001, 0, 0);
    }

    function test_Configure_RevertIfInvalidSaleWindow() public {
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(TicketNFT.InvalidSaleWindow.selector, 20000, 10000)
        );
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, 20000, 10000);
    }

    /// @dev Nilai batas (boundary) harus diterima: ceiling = 100% (10000), royalty = 10% (1000).
    function test_Configure_SuccessBoundaryValues() public {
        // Verifikasi konstanta sesuai ekspektasi boundary.
        assertEq(nft.BPS_DENOMINATOR(), 10000);
        assertEq(nft.MAX_ROYALTY_BPS(), 1000);

        vm.prank(organizer);
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 10000, 1000, 0, 0);

        assertEq(nft.priceCeilingBps(TOKEN_VVIP), 10000);
    }

    function test_Create_RevertIfInvalidParams() public {
        TicketNFT.EventParams memory p = _eventParams(10, PRICE_REGULER, 9999, 500, 0, 0);
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(TicketNFT.InvalidCeilingBps.selector, 9999)
        );
        nft.createTicketCategory(organizer, p);
    }

    // ════════════════════════════════════════════════════════════════
    //  F9 — KUNCI PARAMETER SETELAH MINT (anti perubahan retroaktif)
    // ════════════════════════════════════════════════════════════════

    function test_Configure_RevertIfCategoryLocked() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 1); // totalMinted REGULER > 0

        vm.expectRevert(
            abi.encodeWithSelector(TicketNFT.CategoryLocked.selector, TOKEN_REGULER)
        );
        nft.configureTicketCategory(TOKEN_REGULER, 1000, PRICE_REGULER, 11000, 500, 0, 0);
        vm.stopPrank();
    }

    function test_Configure_SuccessReconfigureBeforeMint() public {
        vm.startPrank(organizer);
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, 0, 0);
        // Belum di-mint → boleh dikonfigurasi ulang
        nft.configureTicketCategory(TOKEN_VVIP, 50, PRICE_VIP, 12000, 300, 0, 0);
        vm.stopPrank();

        assertEq(nft.maxSupply(TOKEN_VVIP), 50);
        assertEq(nft.priceCeilingBps(TOKEN_VVIP), 12000);
    }

    // ════════════════════════════════════════════════════════════════
    //  F9 — GUARD OVER-LIST PADA listPrimary
    // ════════════════════════════════════════════════════════════════

    function test_ListPrimary_RevertIfInsufficientEscrow() public {
        // Belum mint apa pun → saldo escrow marketplace = 0
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(ITicketMarketplace.InsufficientEscrowBalance.selector, 0, 10)
        );
        marketplace.listPrimary(TOKEN_REGULER, 10, PRICE_REGULER);
    }

    function test_ListPrimary_BoundaryEscrow() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 3);

        // List 4 padahal escrow hanya 3 → revert
        vm.expectRevert(
            abi.encodeWithSelector(ITicketMarketplace.InsufficientEscrowBalance.selector, 3, 4)
        );
        marketplace.listPrimary(TOKEN_REGULER, 4, PRICE_REGULER);

        // List tepat 3 → sukses
        marketplace.listPrimary(TOKEN_REGULER, 3, PRICE_REGULER);
        vm.stopPrank();

        assertEq(marketplace.getListing(0).amount, 3);
    }

    // ════════════════════════════════════════════════════════════════
    //  F10 — KONSTANTA MAX_PURCHASE_PER_TX
    // ════════════════════════════════════════════════════════════════

    function test_MaxPurchasePerTx_ConstantValue() public view {
        assertEq(marketplace.MAX_PURCHASE_PER_TX(), 5);
    }

    function test_Buy_RevertIfExceedsMaxPurchasePerTx() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 10);
        marketplace.listPrimary(TOKEN_REGULER, 10, PRICE_REGULER);
        vm.stopPrank();

        bytes32[] memory niks = new bytes32[](6);
        string[] memory names = new string[](6);
        for (uint256 i = 0; i < 6; i++) {
            niks[i] = _hash("1234567890123456");
            names[i] = "Mock Holder";
        }

        vm.prank(alice);
        vm.expectRevert(ITicketMarketplace.ExceedsMaxPurchaseLimit.selector);
        marketplace.buyTicket(0, 6, niks, names);
    }

    function test_Buy_SuccessAtMaxPurchaseLimit() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 10);
        marketplace.listPrimary(TOKEN_REGULER, 10, PRICE_REGULER);
        vm.stopPrank();

        _buy(alice, 0, 5); // tepat di batas
        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 5);
    }

    // ════════════════════════════════════════════════════════════════
    //  F3 — EVENT UNTUK AKSI ADMIN
    // ════════════════════════════════════════════════════════════════

    function test_Event_AuthorizedMarketplaceUpdated() public {
        address newMp = makeAddr("newMarketplace");
        vm.expectEmit(true, true, true, true);
        emit TicketNFT.AuthorizedMarketplaceUpdated(newMp);
        vm.prank(organizer);
        nft.setAuthorizedMarketplace(newMp);
    }

    function test_Event_GateKeeperUpdated() public {
        address gk = makeAddr("gatekeeper");
        vm.expectEmit(true, true, true, true);
        emit TicketNFT.GateKeeperUpdated(gk, true);
        vm.prank(organizer);
        nft.setGateKeeper(gk, true);
    }

    function test_Event_CategoryNameUpdated() public {
        vm.expectEmit(true, true, true, true);
        emit TicketNFT.CategoryNameUpdated(TOKEN_REGULER, "REGULER");
        vm.prank(organizer);
        nft.setTicketCategoryName(TOKEN_REGULER, "REGULER");
    }

    function test_Event_TicketCategoryConfigured() public {
        vm.expectEmit(true, true, true, true);
        emit TicketNFT.TicketCategoryConfigured(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, 0, 0);
        vm.prank(organizer);
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, 0, 0);
    }

    function test_Event_TicketCategoryCreated() public {
        TicketNFT.EventParams memory p = _eventParams(10, PRICE_REGULER, 11000, 500, 0, 0);
        // _nextTokenId mulai dari 1 dan hanya createTicketCategory yang menaikkannya.
        vm.expectEmit(true, true, true, true);
        emit TicketNFT.TicketCategoryCreated(1, organizer, 10, PRICE_REGULER, 11000, 500);
        vm.prank(organizer);
        nft.createTicketCategory(organizer, p);
    }

    // ════════════════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════════════════

    function _eventParams(
        uint256 supply,
        uint256 price,
        uint256 ceilingBps,
        uint96 royaltyBps,
        uint256 start,
        uint256 end
    ) internal pure returns (TicketNFT.EventParams memory) {
        return TicketNFT.EventParams({
            supply:     supply,
            price:      price,
            ceilingBps: ceilingBps,
            royaltyBps: royaltyBps,
            start:      start,
            end:        end,
            title:      "Konser Skripsi",
            venue:      "GBK",
            date:       "2026-07-01",
            city:       "Jakarta",
            category:   "Musik"
        });
    }
}
