// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Tahap 6 — Emergency Stop / Pausable (F8)
/// @notice Owner dapat menghentikan sementara aktivitas jual-beli saat insiden.
contract Tahap6PausableTest is TestHelper {

    function _listReguler(uint256 amount) internal returns (uint256 listingId) {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, amount);
        marketplace.listPrimary(TOKEN_REGULER, amount, PRICE_REGULER);
        vm.stopPrank();
        listingId = 0;
    }

    // ── Saat paused, buyTicket harus revert ───────────────────────────────────
    function test_Pause_BlocksBuy() public {
        uint256 listingId = _listReguler(5);

        vm.prank(organizer);
        marketplace.pause();
        assertTrue(marketplace.paused());

        bytes32[] memory niks = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("111"); names[0] = "A";

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        marketplace.buyTicket(listingId, 1, niks, names);
    }

    // ── Unpause memulihkan aktivitas jual-beli ────────────────────────────────
    function test_Unpause_RestoresBuy() public {
        uint256 listingId = _listReguler(5);

        vm.prank(organizer);
        marketplace.pause();
        vm.prank(organizer);
        marketplace.unpause();
        assertFalse(marketplace.paused());

        _buy(alice, listingId, 1);
        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 1);
    }

    // ── Saat paused, listResale juga harus revert ─────────────────────────────
    function test_Pause_BlocksResale() public {
        uint256 listingId = _listReguler(5);
        _buy(alice, listingId, 1);

        vm.prank(organizer);
        marketplace.pause();

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        marketplace.listResale(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();
    }

    // ── cancelListing TETAP bisa saat paused (seller bisa tarik tiket escrow) ──
    function test_Pause_AllowsCancelListing() public {
        uint256 listingId = _listReguler(5);
        _buy(alice, listingId, 1);

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PRICE_REGULER); // listing id 1
        vm.stopPrank();

        // Owner pause sistem
        vm.prank(organizer);
        marketplace.pause();

        // Alice tetap bisa membatalkan & menarik tiketnya kembali
        vm.prank(alice);
        marketplace.cancelListing(1);
        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 1, "Tiket harus kembali ke Alice");
    }

    // ── Hanya owner yang boleh pause/unpause ──────────────────────────────────
    function test_Pause_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        marketplace.pause();
    }
}
