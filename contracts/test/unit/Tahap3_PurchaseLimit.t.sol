// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {ITicketMarketplace} from "../../src/interfaces/ITicketMarketplace.sol";

/// @title Tahap 3 — Limit Pembelian Kumulatif (F2)
/// @notice Menutup celah Sybil: batas per-transaksi tidak cukup, perlu batas kumulatif
///         per-wallet dan per-identitas (NIK) untuk tiap kategori tiket.
contract Tahap3PurchaseLimitTest is TestHelper {

    function _listPrimaryReguler(uint256 amount) internal returns (uint256 listingId) {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, amount);
        marketplace.listPrimary(TOKEN_REGULER, amount, PRICE_REGULER);
        vm.stopPrank();
        listingId = 0; // listing pertama pada setUp yang fresh
    }

    /// @dev Beli `amount` tiket dengan NIK berbeda-beda (tidak memicu limit per-NIK).
    function _buyDistinct(address actor, uint256 listingId, uint256 amount, string memory seed) internal {
        bytes32[] memory niks  = new bytes32[](amount);
        string[] memory names = new string[](amount);
        for (uint256 i = 0; i < amount; i++) {
            niks[i]  = _hash(string.concat(seed, vm.toString(i)));
            names[i] = "Holder";
        }
        vm.prank(actor);
        marketplace.buyTicket(listingId, amount, niks, names);
    }

    /// @dev Beli `amount` tiket dengan NIK identik (untuk menguji limit per-NIK).
    function _buySameNik(address actor, uint256 listingId, uint256 amount, string memory nik) internal {
        bytes32[] memory niks  = new bytes32[](amount);
        string[] memory names = new string[](amount);
        for (uint256 i = 0; i < amount; i++) {
            niks[i]  = _hash(nik);
            names[i] = "Holder";
        }
        vm.prank(actor);
        marketplace.buyTicket(listingId, amount, niks, names);
    }

    // ── Positif: total pembelian ≤ MAX_PER_WALLET lewat beberapa transaksi ─────
    function test_WalletLimit_SuccessUpToMax() public {
        uint256 listingId = _listPrimaryReguler(10);

        _buyDistinct(alice, listingId, 3, "AAA"); // total 3
        _buyDistinct(alice, listingId, 2, "BBB"); // total 5 (tepat di batas)

        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 5);
        assertEq(marketplace.purchasedPerWallet(TOKEN_REGULER, alice), 5);
    }

    // ── Negatif: akumulasi melebihi batas per-wallet ──────────────────────────
    function test_WalletLimit_RevertWhenExceeded() public {
        uint256 listingId = _listPrimaryReguler(10);

        _buyDistinct(alice, listingId, 5, "AAA"); // total 5

        // Transaksi ke-6 (kumulatif) harus gagal walau per-transaksi hanya 1
        bytes32[] memory niks  = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("ZZZ"); names[0] = "Holder";

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ITicketMarketplace.WalletLimitExceeded.selector, TOKEN_REGULER, 6, 5)
        );
        marketplace.buyTicket(listingId, 1, niks, names);
    }

    // ── Negatif: NIK sama dipakai melebihi batas, lintas wallet ───────────────
    function test_NikLimit_RevertAcrossWallets() public {
        uint256 listingId = _listPrimaryReguler(10);

        // Alice memborong 5 tiket dengan NIK identik (per-wallet=5, per-NIK=5; masih sah)
        _buySameNik(alice, listingId, 5, "5555555555555555");
        assertEq(marketplace.purchasedPerNik(TOKEN_REGULER, _hash("5555555555555555")), 5);

        // Bob (wallet berbeda) mencoba memakai NIK yang sama → per-NIK jadi 6 → revert
        bytes32[] memory niks  = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("5555555555555555"); names[0] = "Bob";

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(ITicketMarketplace.NikLimitExceeded.selector, TOKEN_REGULER, 6, 5)
        );
        marketplace.buyTicket(listingId, 1, niks, names);
    }

    // ── Konstanta limit terekspos dengan benar ────────────────────────────────
    function test_MaxPerWallet_ConstantValue() public view {
        assertEq(marketplace.MAX_PER_WALLET(), 5);
    }
}
