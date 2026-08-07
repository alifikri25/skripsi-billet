// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {TicketNFT} from "../../src/TicketNFT.sol";
import {ITicketMarketplace} from "../../src/interfaces/ITicketMarketplace.sol";

contract TicketNFTTest is TestHelper {

    // ════════════════════════════════════════════════════════════════
    //  MINTING
    // ════════════════════════════════════════════════════════════════

    function test_MintToMarketplace_Success() public {
        vm.prank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 100);

        assertEq(
            nft.balanceOf(address(marketplace), TOKEN_REGULER),
            100,
            "Marketplace harus menerima 100 tiket"
        );
        assertEq(nft.totalMinted(TOKEN_REGULER), 100);
    }

    function test_MintToMarketplace_RevertIfExceedsMaxSupply() public {
        vm.prank(organizer);
        // Max supply REGULER = 1000, coba mint 1001
        vm.expectRevert(
            abi.encodeWithSelector(
                TicketNFT.ExceedsMaxSupply.selector,
                TOKEN_REGULER,
                1001,
                1000
            )
        );
        nft.mintToMarketplace(TOKEN_REGULER, 1001);
    }

    function test_MintToMarketplace_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        nft.mintToMarketplace(TOKEN_REGULER, 10);
    }

    function test_MintToMarketplace_RevertIfMarketplaceNotSet() public {
        // Deploy NFT baru tanpa set marketplace
        vm.startPrank(organizer);
        TicketNFT freshNft = new TicketNFT("uri");
        freshNft.configureTicketCategory(TOKEN_REGULER, 100, PRICE_REGULER, 11000, 500, 0, 0);

        vm.expectRevert(TicketNFT.MarketplaceNotSet.selector);
        freshNft.mintToMarketplace(TOKEN_REGULER, 10);
        vm.stopPrank();
    }

    // ════════════════════════════════════════════════════════════════
    //  TRANSFER GATING
    // ════════════════════════════════════════════════════════════════

    function test_TransferGating_RevertIfDirectUserToUser() public {
        // Mint dulu ke marketplace, lalu beli ke alice
        vm.prank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 1);

        // Simulasi alice punya tiket (bypass via cheat code untuk setup)
        // Dalam sistem nyata alice dapat tiket hanya lewat marketplace
        // Kita test: alice TIDAK BISA transfer langsung ke bob
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_VIP, 1);
        vm.stopPrank();

        // Transfer marketplace -> alice (valid, marketplace adalah authorized)
        vm.prank(address(marketplace));
        nft.safeTransferFrom(address(marketplace), alice, TOKEN_VIP, 1, "");

        // Sekarang alice coba transfer ke bob langsung — HARUS REVERT
        vm.prank(alice);
        vm.expectRevert(TicketNFT.UnauthorizedTransfer.selector);
        nft.safeTransferFrom(alice, bob, TOKEN_VIP, 1, "");
    }

    function test_TransferGating_AllowMarketplaceTransfer() public {
        vm.prank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 5);

        // Marketplace transfer ke alice — harus berhasil
        vm.prank(address(marketplace));
        nft.safeTransferFrom(address(marketplace), alice, TOKEN_REGULER, 5, "");

        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 5);
    }

    function test_TransferGating_AllowMintBurn() public {
        // Mint (from == address(0)) harus selalu lolos
        vm.prank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 10); // tidak revert
        assertEq(nft.totalMinted(TOKEN_REGULER), 10);
    }

    // ════════════════════════════════════════════════════════════════
    //  ROYALTI ERC-2981
    // ════════════════════════════════════════════════════════════════

    function test_RoyaltyInfo_CorrectAmount() public view {
        (address receiver, uint256 amount) = nft.royaltyInfo(TOKEN_REGULER, 1 ether);
        assertEq(receiver, organizer, "Royalti harus ke organizer");
        assertEq(amount, 0.05 ether,  "5% dari 1 ether = 0.05 ether");
    }

    function test_SupportsInterface_ERC2981() public view {
        // bytes4(keccak256("royaltyInfo(uint256,uint256)"))
        assertTrue(nft.supportsInterface(0x2a55205a));
    }

    // ════════════════════════════════════════════════════════════════
    //  SALE WINDOW & PRICE CEILING CONFIG
    // ════════════════════════════════════════════════════════════════

    function test_ConfigureTicketCategory_CorrectStorage() public {
        vm.startPrank(organizer);
        nft.configureTicketCategory(TOKEN_VVIP, 100, 2 ether, 12000, 1000, 10000, 20000);
        vm.stopPrank();

        assertEq(nft.priceCeilingBps(TOKEN_VVIP), 12000);
        (uint256 start, uint256 end) = nft.getSaleWindow(TOKEN_VVIP);
        assertEq(start, 10000);
        assertEq(end, 20000);
    }

    // ════════════════════════════════════════════════════════════════
    //  ON-CHAIN IDENTITY & GATEKEEPER CHECK-IN
    // ════════════════════════════════════════════════════════════════

    function test_Admin_ConfigureGateKeeperAndCategoryNames() public {
        address gatekeeper = makeAddr("gatekeeper");

        vm.startPrank(organizer);
        nft.setGateKeeper(gatekeeper, true);
        nft.setTicketCategoryName(TOKEN_REGULER, "REGULER");
        vm.stopPrank();

        assertTrue(nft.isGateKeeper(gatekeeper), "Gatekeeper harus aktif");
        assertEq(nft.ticketCategoryName(TOKEN_REGULER), "REGULER", "Nama kategori harus sesuai");

        // Non-owner tidak boleh mengubah setting
        vm.startPrank(alice);
        vm.expectRevert();
        nft.setGateKeeper(gatekeeper, false);
        vm.expectRevert();
        nft.setTicketCategoryName(TOKEN_REGULER, "VIP");
        vm.stopPrank();
    }

    function test_IdentityRegistration_OnlyMarketplace() public {
        // Hanya authorizedMarketplace yang bisa registrasi atau menghapus data holder
        vm.startPrank(alice);
        
        vm.expectRevert(TicketNFT.UnauthorizedTransfer.selector);
        nft.registerHolder(alice, TOKEN_REGULER, "Alice", _hash("1234567890123456"));

        vm.expectRevert(TicketNFT.UnauthorizedTransfer.selector);
        nft.removeUnusedHolder(alice, TOKEN_REGULER);
        
        vm.stopPrank();
    }

    function test_GateCheckIn_Success() public {
        address gatekeeper = makeAddr("gatekeeper");

        // 1. Setup Gatekeeper dan Marketplace
        vm.startPrank(organizer);
        nft.setGateKeeper(gatekeeper, true);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        vm.stopPrank();

        // 2. Simulasi registrasi oleh authorizedMarketplace
        vm.prank(address(marketplace));
        nft.registerHolder(alice, TOKEN_REGULER, "Alice", _hash("1234567890123456"));

        // Mint tiket dari marketplace ke Alice untuk simulasi kepemilikan
        vm.prank(address(marketplace));
        nft.safeTransferFrom(address(marketplace), alice, TOKEN_REGULER, 1, "");

        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 1);
        TicketNFT.TicketHolder[] memory holdersBefore = nft.getTicketHolders(alice, TOKEN_REGULER);
        assertEq(holdersBefore.length, 1);
        assertEq(holdersBefore[0].name, "Alice");
        assertFalse(holdersBefore[0].used, "Tiket awal harus belum digunakan");

        // Ekspektasi emit TicketCheckedIn
        vm.expectEmit(true, true, true, true);
        emit TicketNFT.TicketCheckedIn(alice, TOKEN_REGULER, 0);

        // 3. Gatekeeper melakukan check-in tiket
        vm.prank(gatekeeper);
        nft.checkInFromGate(alice, TOKEN_REGULER, 0);

        // Verifikasi kepemilikan token utuh pasca check-in (tidak dibakar)
        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 1, "Tiket Alice tidak boleh terbakar");
        TicketNFT.TicketHolder[] memory holdersAfter = nft.getTicketHolders(alice, TOKEN_REGULER);
        assertEq(holdersAfter.length, 1, "Data identitas harus tetap di blockchain");
        assertTrue(holdersAfter[0].used, "Status tiket harus terpakai");
    }

    function test_GateCheckIn_RevertIfNotGateKeeper() public {
        address gatekeeper = makeAddr("gatekeeper");

        vm.startPrank(organizer);
        nft.setGateKeeper(gatekeeper, true);
        vm.stopPrank();

        // Simulasi registrasi
        vm.prank(address(marketplace));
        nft.registerHolder(alice, TOKEN_REGULER, "Alice", _hash("1234567890123456"));

        // Alice mencoba check-in tiketnya sendiri (bukan gatekeeper) -> HARUS REVERT
        vm.prank(alice);
        vm.expectRevert(TicketNFT.NotGateKeeper.selector);
        nft.checkInFromGate(alice, TOKEN_REGULER, 0);
    }

    // ════════════════════════════════════════════════════════════════
    //  NEW TESTS: USED STATUS & CHECK-IN EDGE CASES
    // ════════════════════════════════════════════════════════════════

    function test_GateCheckIn_RevertIfAlreadyUsed() public {
        address gatekeeper = makeAddr("gatekeeper");

        vm.startPrank(organizer);
        nft.setGateKeeper(gatekeeper, true);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        vm.stopPrank();

        vm.prank(address(marketplace));
        nft.registerHolder(alice, TOKEN_REGULER, "Alice", _hash("1234567890123456"));

        vm.prank(address(marketplace));
        nft.safeTransferFrom(address(marketplace), alice, TOKEN_REGULER, 1, "");

        // Check-in pertama -> sukses
        vm.prank(gatekeeper);
        nft.checkInFromGate(alice, TOKEN_REGULER, 0);

        // Check-in kedua kalinya pada index yang sama -> HARUS REVERT
        vm.prank(gatekeeper);
        vm.expectRevert("Ticket already used");
        nft.checkInFromGate(alice, TOKEN_REGULER, 0);
    }

    function test_GateCheckIn_RevertIfTicketListed() public {
        address gatekeeper = makeAddr("gatekeeper");

        vm.startPrank(organizer);
        nft.setGateKeeper(gatekeeper, true);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        vm.stopPrank();

        vm.prank(address(marketplace));
        nft.registerHolder(alice, TOKEN_REGULER, "Alice", _hash("1234567890123456"));

        vm.prank(address(marketplace));
        nft.safeTransferFrom(address(marketplace), alice, TOKEN_REGULER, 1, "");

        // Alice mendaftarkan tiketnya untuk dijual kembali (resale) di marketplace
        // Ini akan mentransfer tiket ke escrow marketplace, mengurangi saldo Alice menjadi 0
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();

        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 0);

        // Gatekeeper mencoba check-in tiket Alice yang sedang terdaftar di marketplace -> HARUS REVERT karena saldo 0
        vm.prank(gatekeeper);
        vm.expectRevert("Insufficient ticket balance in wallet");
        nft.checkInFromGate(alice, TOKEN_REGULER, 0);
    }

    function test_Resale_RevertIfInsufficientUnusedTickets() public {
        address gatekeeper = makeAddr("gatekeeper");

        vm.startPrank(organizer);
        nft.setGateKeeper(gatekeeper, true);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        vm.stopPrank();

        vm.prank(address(marketplace));
        nft.registerHolder(alice, TOKEN_REGULER, "Alice", _hash("1234567890123456"));

        vm.prank(address(marketplace));
        nft.safeTransferFrom(address(marketplace), alice, TOKEN_REGULER, 1, "");

        // Check-in tiket sehingga berstatus terpakai (used = true)
        vm.prank(gatekeeper);
        nft.checkInFromGate(alice, TOKEN_REGULER, 0);

        // Alice mencoba mendaftarkan tiket terpakai tersebut ke marketplace sekunder -> HARUS REVERT
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.InsufficientUnusedTickets.selector,
                0, // available unused
                1  // requested
            )
        );
        marketplace.listResale(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();
    }
}
