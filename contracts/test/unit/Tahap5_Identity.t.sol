// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {TicketNFT} from "../../src/TicketNFT.sol";

/// @title Tahap 5 — Skalabilitas & Konsistensi Data Identitas (F6 + F7)
/// @notice Counter agregat O(1) (anti gas DoS) + penghapusan holder deterministik (swap-and-pop).
contract Tahap5IdentityTest is TestHelper {

    address gatekeeper = makeAddr("gatekeeper");

    function setUp() public override {
        super.setUp();
        vm.prank(organizer);
        nft.setGateKeeper(gatekeeper, true);
    }

    function _listReguler(uint256 amount) internal returns (uint256 listingId) {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, amount);
        marketplace.listPrimary(TOKEN_REGULER, amount, PRICE_REGULER);
        vm.stopPrank();
        listingId = 0;
    }

    // ── Counter konsisten sepanjang siklus register → check-in → resale ───────
    function test_Counters_RegisterCheckinResale() public {
        uint256 listingId = _listReguler(5);

        _buy(alice, listingId, 3); // alice punya 3 tiket terdaftar
        assertEq(nft.getUnusedTicketCount(alice, TOKEN_REGULER), 3);
        assertEq(nft.getUsedTicketCount(alice, TOKEN_REGULER), 0);

        // Check-in 1 tiket (index 0)
        vm.prank(gatekeeper);
        nft.checkInFromGate(alice, TOKEN_REGULER, 0);
        assertEq(nft.getUsedTicketCount(alice, TOKEN_REGULER), 1);
        assertEq(nft.getUnusedTicketCount(alice, TOKEN_REGULER), 2);

        // Alice resale 1 tiket; Bob membelinya → removeUnusedHolder dipanggil
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();
        _buy(bob, 1, 1);

        // Alice: 1 used + 1 unused tersisa (1 terjual). Tidak ada zombie.
        assertEq(nft.getUsedTicketCount(alice, TOKEN_REGULER), 1);
        assertEq(nft.getUnusedTicketCount(alice, TOKEN_REGULER), 1);
        assertEq(nft.getTicketHolders(alice, TOKEN_REGULER).length, 2, "Array menyusut, tanpa zombie");

        // Holder yang sudah check-in tetap terjaga (memento)
        TicketNFT.TicketHolder[] memory aliceHolders = nft.getTicketHolders(alice, TOKEN_REGULER);
        assertTrue(aliceHolders[0].used, "Holder used (index 0) harus tetap dilestarikan");

        // Bob menerima identitas baru
        assertEq(nft.getUnusedTicketCount(bob, TOKEN_REGULER), 1);
        assertEq(nft.getTicketHolders(bob, TOKEN_REGULER).length, 1);
    }

    // ── removeUnusedHolder deterministik: hapus unused index terkecil ─────────
    function test_RemoveUnused_DeterministicLowestIndex() public {
        uint256 listingId = _listReguler(5);
        _buy(alice, listingId, 2); // holders: [H0, H1] keduanya unused

        // Check-in H1 (index 1) → H1 used, H0 masih unused
        vm.prank(gatekeeper);
        nft.checkInFromGate(alice, TOKEN_REGULER, 1);

        // Resale 1 → removeUnusedHolder harus menghapus H0 (unused index terkecil),
        // bukan H1 yang sudah used.
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();
        _buy(bob, 1, 1);

        TicketNFT.TicketHolder[] memory holders = nft.getTicketHolders(alice, TOKEN_REGULER);
        assertEq(holders.length, 1, "Hanya tersisa 1 holder");
        assertTrue(holders[0].used, "Holder tersisa adalah yang sudah check-in");
        assertEq(nft.getUsedTicketCount(alice, TOKEN_REGULER), 1);
        assertEq(nft.getUnusedTicketCount(alice, TOKEN_REGULER), 0);
    }

    // ── Counter tetap benar saat seluruh tiket di-check-in (banyak holder) ────
    function test_Counters_CheckInAllFive() public {
        uint256 listingId = _listReguler(5);
        _buy(alice, listingId, 5);
        assertEq(nft.getUnusedTicketCount(alice, TOKEN_REGULER), 5);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(gatekeeper);
            nft.checkInFromGate(alice, TOKEN_REGULER, i);
        }

        assertEq(nft.getUsedTicketCount(alice, TOKEN_REGULER), 5);
        assertEq(nft.getUnusedTicketCount(alice, TOKEN_REGULER), 0);
        assertEq(nft.getTicketHolders(alice, TOKEN_REGULER).length, 5, "Semua tiket dilestarikan sebagai memento");
    }
}
