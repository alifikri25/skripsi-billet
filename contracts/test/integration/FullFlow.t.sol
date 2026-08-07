// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {TicketNFT} from "../../src/TicketNFT.sol";
import {ITicketMarketplace} from "../../src/interfaces/ITicketMarketplace.sol";
import {PriceLib} from "../../src/libraries/PriceLib.sol";

contract FullFlowTest is TestHelper {

    /// @dev Skenario lengkap:
    ///      Organizer mint → Alice beli primary → Alice resale → Bob beli resale →
    ///      Organizer tarik royalti.
    function test_FullFlow_PrimaryToResaleToRoyaltyWithdrawal() public {
        // ── Step 1: Organizer mint dan list primary ──────────────────────────
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 50);
        marketplace.listPrimary(TOKEN_REGULER, 50, PRICE_REGULER);
        vm.stopPrank();

        // ── Step 2: Alice beli 1 tiket primary ──────────────────────────────
        _buy(alice, 0, 1);

        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 1, "Alice harus punya 1 tiket");

        // ── Step 3: Alice resale dengan harga 110% ───────────────────────────
        uint256 resalePrice = PriceLib.maxResalePrice(PRICE_REGULER, 11000); // Rp110.000

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, resalePrice);
        vm.stopPrank();

        // Tiket sekarang ada di escrow (marketplace)
        assertEq(nft.balanceOf(alice, TOKEN_REGULER),          0);
        assertEq(nft.balanceOf(address(marketplace), TOKEN_REGULER), 50);

        // ── Step 4: Bob beli dari resale (Dengan Royalti Direct Routing) ─────
        (, uint256 royaltyExpected) = nft.royaltyInfo(TOKEN_REGULER, resalePrice);
        uint256 aliceProceeds   = resalePrice - royaltyExpected;

        uint256 aliceBalanceBefore = idrx.balanceOf(alice);
        uint256 organizerBalanceBefore = idrx.balanceOf(organizer);

        _buy(bob, 1, 1);

        // Bob punya tiket
        assertEq(nft.balanceOf(bob, TOKEN_REGULER), 1, "Bob harus punya tiket");
        // Alice dapat proceeds
        assertEq(idrx.balanceOf(alice), aliceBalanceBefore + aliceProceeds);
        // Organizer langsung menerima royalti secara otomatis (direct routing)
        assertEq(
            idrx.balanceOf(organizer),
            organizerBalanceBefore + royaltyExpected,
            "Organizer harus menerima royalti langsung secara real-time"
        );
    }

    /// @dev Skenario anti-scalping: calo tidak bisa listing di atas ceiling.
    function test_FullFlow_AntiScalping_CeilingEnforced() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 10);
        marketplace.listPrimary(TOKEN_REGULER, 10, PRICE_REGULER);
        vm.stopPrank();

        // Calo (alice) beli tiket
        _buy(alice, 0, 1);

        // Calo coba jual 5x harga asal
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);

        uint256 scalpingPrice = PRICE_REGULER * 5;
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.PriceCeilingExceeded.selector,
                scalpingPrice,
                PriceLib.maxResalePrice(PRICE_REGULER, 11000)
            )
        );
        marketplace.listResale(TOKEN_REGULER, 1, scalpingPrice);
        vm.stopPrank();
    }

    /// @dev Skenario transfer gating: tiket tidak bisa bypass ke wallet langsung.
    function test_FullFlow_TransferGating_NoBypassing() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        marketplace.listPrimary(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();

        _buy(alice, 0, 1);

        // Alice coba transfer ke carol langsung (bypass marketplace)
        vm.prank(alice);
        vm.expectRevert(TicketNFT.UnauthorizedTransfer.selector);
        nft.safeTransferFrom(alice, carol, TOKEN_REGULER, 1, "");
    }
}
