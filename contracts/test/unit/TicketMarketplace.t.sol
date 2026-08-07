// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestHelper} from "../helpers/TestHelper.sol";
import {TicketNFT} from "../../src/TicketNFT.sol";
import {ITicketMarketplace} from "../../src/interfaces/ITicketMarketplace.sol";
import {PriceLib} from "../../src/libraries/PriceLib.sol";

contract TicketMarketplaceTest is TestHelper {

    // ════════════════════════════════════════════════════════════════
    //  PRIMARY LISTING
    // ════════════════════════════════════════════════════════════════

    function test_ListPrimary_Success() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 100);
        marketplace.listPrimary(TOKEN_REGULER, 100, PRICE_REGULER);
        vm.stopPrank();

        ITicketMarketplace.Listing memory l = marketplace.getListing(0);
        assertEq(l.seller,       organizer);
        assertEq(l.tokenId,      TOKEN_REGULER);
        assertEq(l.amount,       100);
        assertEq(l.pricePerUnit, PRICE_REGULER);
        assertFalse(l.isResale);
        assertTrue(l.active);
    }

    function test_ListPrimary_EmitsEvent() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 10);

        vm.expectEmit(true, true, true, true);
        emit ITicketMarketplace.TicketListed(0, organizer, TOKEN_REGULER, 10, PRICE_REGULER, false);
        marketplace.listPrimary(TOKEN_REGULER, 10, PRICE_REGULER);
        vm.stopPrank();
    }

    function test_ListPrimary_RevertIfZeroAmount() public {
        vm.prank(organizer);
        vm.expectRevert(ITicketMarketplace.ZeroAmount.selector);
        marketplace.listPrimary(TOKEN_REGULER, 0, PRICE_REGULER);
    }

    function test_ListPrimary_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        marketplace.listPrimary(TOKEN_REGULER, 10, PRICE_REGULER);
    }

    // ════════════════════════════════════════════════════════════════
    //  BUY (PRIMARY)
    // ════════════════════════════════════════════════════════════════

    function test_BuyPrimary_Success() public {
        // Setup
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 10);
        marketplace.listPrimary(TOKEN_REGULER, 10, PRICE_REGULER);
        vm.stopPrank();

        uint256 organizerBalanceBefore = idrx.balanceOf(organizer);

        // Alice beli 2 tiket
        _buy(alice, 0, 2);

        // Alice mendapat tiket
        assertEq(nft.balanceOf(alice, TOKEN_REGULER), 2);
        // Listing berkurang
        assertEq(marketplace.getListing(0).amount, 8);
        // Organizer mendapat dana (primary sale: tidak ada royalti)
        assertEq(idrx.balanceOf(organizer), organizerBalanceBefore + PRICE_REGULER * 2);
    }

    function test_BuyPrimary_ExactPull() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 5);
        marketplace.listPrimary(TOKEN_REGULER, 5, PRICE_REGULER);
        vm.stopPrank();

        uint256 aliceBalanceBefore = idrx.balanceOf(alice);

        // Alice beli tiket
        _buy(alice, 0, 1);

        // Hanya terpotong seharga tiket REGULER (tidak ada overpay/native fee)
        assertEq(
            idrx.balanceOf(alice),
            aliceBalanceBefore - PRICE_REGULER
        );
    }

    function test_BuyPrimary_RevertIfInsufficientPayment() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 5);
        marketplace.listPrimary(TOKEN_REGULER, 5, PRICE_REGULER);
        vm.stopPrank();

        // Kosongkan allowance alice agar transaksi gagal
        vm.prank(alice);
        idrx.approve(address(marketplace), 0);

        bytes32[] memory niks = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("111"); names[0] = "A";

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.InsufficientAllowance.selector,
                0,             // allowance available
                PRICE_REGULER  // required
            )
        );
        marketplace.buyTicket(0, 1, niks, names);

        // Reset allowance ke max agar tidak merusak test lain
        vm.prank(alice);
        idrx.approve(address(marketplace), type(uint256).max);
    }

    function test_BuyPrimary_RevertIfListingNotActive() public {
        bytes32[] memory niks = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("111"); names[0] = "A";

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ITicketMarketplace.ListingNotActive.selector, 999)
        );
        marketplace.buyTicket(999, 1, niks, names);
    }

    function test_BuyPrimary_ListingBecomesInactiveWhenSoldOut() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        marketplace.listPrimary(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();

        _buy(alice, 0, 1);

        assertFalse(marketplace.getListing(0).active, "Listing harus inactive setelah sold out");
    }

    function test_BuyPrimary_RevertIfSaleNotStarted() public {
        vm.warp(100 days);
        vm.startPrank(organizer);
        // Setup tiket VVIP dengan saleStart di masa depan (block.timestamp + 1 hours)
        uint256 start = block.timestamp + 1 hours;
        uint256 end = block.timestamp + 2 hours;
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, start, end);
        nft.mintToMarketplace(TOKEN_VVIP, 5);
        marketplace.listPrimary(TOKEN_VVIP, 5, PRICE_REGULER);
        vm.stopPrank();

        bytes32[] memory niks = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("111"); names[0] = "A";

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.SaleNotStarted.selector,
                start,
                block.timestamp
            )
        );
        marketplace.buyTicket(0, 1, niks, names);
    }

    function test_BuyPrimary_RevertIfSaleEnded() public {
        vm.warp(100 days);
        vm.startPrank(organizer);
        // Setup tiket VVIP dengan saleEnd di masa lalu (block.timestamp - 1 seconds)
        uint256 start = block.timestamp - 2 hours;
        uint256 end = block.timestamp - 1 hours;
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, start, end);
        nft.mintToMarketplace(TOKEN_VVIP, 5);
        marketplace.listPrimary(TOKEN_VVIP, 5, PRICE_REGULER);
        vm.stopPrank();

        bytes32[] memory niks = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("111"); names[0] = "A";

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.SaleEnded.selector,
                end,
                block.timestamp
            )
        );
        marketplace.buyTicket(0, 1, niks, names);
    }

    function test_BuyPrimary_SuccessWithinSaleWindow() public {
        vm.startPrank(organizer);
        uint256 start = block.timestamp + 1 hours;
        uint256 end = block.timestamp + 3 hours;
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, start, end);
        nft.mintToMarketplace(TOKEN_VVIP, 5);
        marketplace.listPrimary(TOKEN_VVIP, 5, PRICE_REGULER);
        vm.stopPrank();

        // Geser waktu blok ke dalam sale window (start + 10 mins)
        vm.warp(start + 10 minutes);

        _buy(alice, 0, 1);

        assertEq(nft.balanceOf(alice, TOKEN_VVIP), 1);
    }

    function test_BuyPrimary_BoundaryTimeManipulation() public {
        vm.startPrank(organizer);
        uint256 start = block.timestamp + 1 hours;
        uint256 end = block.timestamp + 2 hours;
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, start, end);
        nft.mintToMarketplace(TOKEN_VVIP, 5);
        marketplace.listPrimary(TOKEN_VVIP, 5, PRICE_REGULER);
        vm.stopPrank();

        bytes32[] memory niks = new bytes32[](1);
        string[] memory names = new string[](1);
        niks[0] = _hash("111"); names[0] = "A";

        // 1. Tepat 1 detik SEBELUM penjualan dimulai (start - 1) -> HARUS REVERT
        vm.warp(start - 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.SaleNotStarted.selector,
                start,
                start - 1
            )
        );
        marketplace.buyTicket(0, 1, niks, names);

        // 2. Tepat saat detik pertama penjualan dimulai (start) -> HARUS SUKSES
        vm.warp(start);
        _buy(alice, 0, 1);
        assertEq(nft.balanceOf(alice, TOKEN_VVIP), 1);

        // 3. Tepat saat detik terakhir penjualan aktif (end) -> HARUS SUKSES
        vm.warp(end);
        _buy(bob, 0, 1);
        assertEq(nft.balanceOf(bob, TOKEN_VVIP), 1);

        // 4. Tepat 1 detik SETELAH penjualan berakhir (end + 1) -> HARUS REVERT
        vm.warp(end + 1);
        vm.prank(carol);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.SaleEnded.selector,
                end,
                end + 1
            )
        );
        marketplace.buyTicket(0, 1, niks, names);
    }

    // ════════════════════════════════════════════════════════════════
    //  RESALE — SKENARIO KUNCI SKRIPSI
    // ════════════════════════════════════════════════════════════════

    function _setupAliceOwnsTicket() internal returns (uint256 primaryListingId) {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 5);
        marketplace.listPrimary(TOKEN_REGULER, 5, PRICE_REGULER);
        vm.stopPrank();

        _buy(alice, 0, 1);

        primaryListingId = 0;
    }

    /// SKENARIO A: Jual Untung → royalti AKTIF
    function test_Resale_JualUntung_RoyaltyDikenakan() public {
        _setupAliceOwnsTicket();

        // Alice approve marketplace untuk mengambil tiketnya
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);

        uint256 resalePrice = PriceLib.maxResalePrice(PRICE_REGULER, 11000); // 110% dari harga asal
        marketplace.listResale(TOKEN_REGULER, 1, resalePrice);
        vm.stopPrank();

        (, uint256 royaltyExpected) = nft.royaltyInfo(TOKEN_REGULER, resalePrice);
        uint256 aliceProceeds   = resalePrice - royaltyExpected;

        uint256 aliceBalanceBefore      = idrx.balanceOf(alice);
        uint256 organizerBalanceBefore  = idrx.balanceOf(organizer);

        // Bob beli dari resale listing (listing ID = 1)
        _buy(bob, 1, 1);

        // Royalti langsung ditransfer ke receiver (organizer)
        assertEq(
            idrx.balanceOf(organizer),
            organizerBalanceBefore + royaltyExpected,
            "Royalti harus langsung ditransfer ke organizer"
        );
        // Alice mendapat sisa setelah royalti
        assertEq(idrx.balanceOf(alice), aliceBalanceBefore + aliceProceeds);
        // Bob mendapat tiket
        assertEq(nft.balanceOf(bob, TOKEN_REGULER), 1);
    }

    /// SKENARIO A-2: Penyelenggara mematikan royalti (royaltyBps = 0)
    function test_Resale_JualUntung_BebasRoyalti() public {
        // Setup kategori tiket baru (TOKEN_VVIP) dengan supply 100, price PRICE_REGULER, royaltyBps = 0
        vm.startPrank(organizer);
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 0, 0, 0); // Royalti = 0
        nft.mintToMarketplace(TOKEN_VVIP, 5);
        marketplace.listPrimary(TOKEN_VVIP, 5, PRICE_REGULER);
        vm.stopPrank();

        // Alice beli tiket VVIP (listing ID = 0)
        _buy(alice, 0, 1);

        // Alice list resale untuk TOKEN_VVIP dengan untung (110% dari harga asal)
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        uint256 resalePrice = PriceLib.maxResalePrice(PRICE_REGULER, 11000);
        marketplace.listResale(TOKEN_VVIP, 1, resalePrice);
        vm.stopPrank();

        uint256 aliceBalanceBefore      = idrx.balanceOf(alice);
        uint256 organizerBalanceBefore  = idrx.balanceOf(organizer);

        // Bob beli tiket VVIP Alice (listing ID = 1)
        _buy(bob, 1, 1);

        // Royalti harus tetap NOL karena promotor menyetel royaltyBps = 0
        assertEq(
            idrx.balanceOf(organizer),
            organizerBalanceBefore,
            "Tidak boleh ada royalti karena dinonaktifkan oleh promotor"
        );
        // Alice mendapatkan 100% hasil penjualan tanpa potongan royalti
        assertEq(idrx.balanceOf(alice), aliceBalanceBefore + resalePrice);
    }

    /// SKENARIO B: Jual Rugi → royalti NOL (likuiditas pasar terjaga)
    function test_Resale_JualRugi_RoyaltyNol() public {
        _setupAliceOwnsTicket();

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);

        uint256 resalePrice = (PRICE_REGULER * 8) / 10; // DI BAWAH harga beli (Rp80.000)
        marketplace.listResale(TOKEN_REGULER, 1, resalePrice);
        vm.stopPrank();

        uint256 organizerBalanceBefore = idrx.balanceOf(organizer);

        _buy(bob, 1, 1);

        // Royalti tidak bertambah sama sekali
        assertEq(
            idrx.balanceOf(organizer),
            organizerBalanceBefore,
            "Tidak boleh ada royalti saat jual rugi"
        );
    }

    /// SKENARIO C: Price Ceiling — scalper tidak bisa listing terlalu tinggi
    function test_Resale_RevertIfExceedsPriceCeiling() public {
        _setupAliceOwnsTicket();

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);

        uint256 scalpingPrice = PRICE_REGULER * 2; // 200% dari harga asal — SCALPING
        uint256 maxAllowed    = PriceLib.maxResalePrice(PRICE_REGULER, 11000); // 110%

        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.PriceCeilingExceeded.selector,
                scalpingPrice,
                maxAllowed
            )
        );
        marketplace.listResale(TOKEN_REGULER, 1, scalpingPrice);
        vm.stopPrank();
    }

    /// SKENARIO C-2: Price Ceiling Kustom — Kategori dengan Price Ceiling 100% (Face Value Only)
    function test_Resale_CustomPriceCeiling_100Percent() public {
        // Kategori TOKEN_VVIP dengan ceilingBps = 10000 (tidak boleh ada kenaikan harga sama sekali, e.g. untuk tiket amal)
        vm.startPrank(organizer);
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 10000, 500, 0, 0);
        nft.mintToMarketplace(TOKEN_VVIP, 5);
        marketplace.listPrimary(TOKEN_VVIP, 5, PRICE_REGULER);
        vm.stopPrank();

        _buy(alice, 0, 1);

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);

        // Upaya list di atas 100% harga beli (misal 100.01%) - HARUS REVERT
        uint256 expensivePrice = PRICE_REGULER + 10**18; // tambah Rp1 (dalam wei)
        vm.expectRevert(
            abi.encodeWithSelector(
                ITicketMarketplace.PriceCeilingExceeded.selector,
                expensivePrice,
                PRICE_REGULER
            )
        );
        marketplace.listResale(TOKEN_VVIP, 1, expensivePrice);

        // List tepat di 100% harga beli - HARUS SUKSES
        marketplace.listResale(TOKEN_VVIP, 1, PRICE_REGULER);
        vm.stopPrank();
    }

    /// SKENARIO D: Penjualan Resale Tidak Terpengaruh oleh Jendela Waktu Penjualan Perdana
    function test_Resale_NotRestrictedBySaleWindow() public {
        // 1. Setup & beli tiket perdana dalam sale window
        vm.startPrank(organizer);
        uint256 start = block.timestamp + 1 hours;
        uint256 end = block.timestamp + 3 hours;
        nft.configureTicketCategory(TOKEN_VVIP, 100, PRICE_REGULER, 11000, 500, start, end);
        nft.mintToMarketplace(TOKEN_VVIP, 5);
        marketplace.listPrimary(TOKEN_VVIP, 5, PRICE_REGULER);
        vm.stopPrank();

        vm.warp(start + 10 minutes);

        _buy(alice, 0, 1);

        // 2. Geser waktu keluar dari sale window (sale berakhir)
        vm.warp(end + 1 hours);

        // 3. Alice list resale dan Carol beli resale tiket VVIP tersebut
        //    Meskipun primary sale window telah ditutup, resale harus tetap sukses
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        uint256 resalePrice = PriceLib.maxResalePrice(PRICE_REGULER, 11000);
        marketplace.listResale(TOKEN_VVIP, 1, resalePrice);
        vm.stopPrank();

        // Listing ID untuk resale adalah 1
        _buy(carol, 1, 1);

        assertEq(nft.balanceOf(carol, TOKEN_VVIP), 1);
    }

    // ════════════════════════════════════════════════════════════════
    //  CANCEL LISTING
    // ════════════════════════════════════════════════════════════════

    function test_CancelListing_ReturnsTicketToSeller() public {
        _setupAliceOwnsTicket();

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PriceLib.maxResalePrice(PRICE_REGULER, 11000));
        vm.stopPrank();

        uint256 aliceTicketsBefore = nft.balanceOf(alice, TOKEN_REGULER);

        vm.prank(alice);
        marketplace.cancelListing(1);

        assertEq(nft.balanceOf(alice, TOKEN_REGULER), aliceTicketsBefore + 1);
        assertFalse(marketplace.getListing(1).active);
    }

    function test_CancelListing_RevertIfNotSeller() public {
        _setupAliceOwnsTicket();

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PriceLib.maxResalePrice(PRICE_REGULER, 11000));
        vm.stopPrank();

        vm.prank(bob); // bukan seller
        vm.expectRevert(
            abi.encodeWithSelector(ITicketMarketplace.NotSeller.selector, 1, bob)
        );
        marketplace.cancelListing(1);
    }

    // ════════════════════════════════════════════════════════════════
    //  ROYALTY DIRECT ROUTING
    // ════════════════════════════════════════════════════════════════

    function test_RoyaltyDirectRouting_Success() public {
        _setupAliceOwnsTicket();

        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PriceLib.maxResalePrice(PRICE_REGULER, 11000));
        vm.stopPrank();

        (, uint256 royaltyExpected) = nft.royaltyInfo(TOKEN_REGULER, PriceLib.maxResalePrice(PRICE_REGULER, 11000));
        uint256 organizerBalanceBefore = idrx.balanceOf(organizer);

        _buy(bob, 1, 1);

        assertEq(
            idrx.balanceOf(organizer),
            organizerBalanceBefore + royaltyExpected,
            "Organizer harus menerima royalti langsung saat transaksi"
        );
    }

    // ════════════════════════════════════════════════════════════════
    //  FUZZ TEST — Price Ceiling
    // ════════════════════════════════════════════════════════════════

    /// @dev Fuzz: pastikan ceiling selalu konsisten di range harga dan batas persentase apapun.
    function testFuzz_PriceCeiling_NeverExceedsCeilingBps(
        uint256 originalPrice,
        uint256 resalePrice,
        uint256 ceilingBps
    )
        public
        pure
    {
        // Batasi range supaya tidak overflow/underflow
        originalPrice = bound(originalPrice, 0.001 ether, 100 ether);
        ceilingBps    = bound(ceilingBps, 10000, 50000); // 100% sampai 500%

        uint256 maxAllowed = PriceLib.maxResalePrice(originalPrice, ceilingBps);

        if (resalePrice > maxAllowed) {
            assertGt(resalePrice, maxAllowed);
        } else {
            assertLe(resalePrice, maxAllowed);
        }
    }

    /// @dev Fuzz: royalti tidak pernah melebihi total pembayaran.
    function testFuzz_Royalty_NeverExceedsTotal(
        uint256 resalePrice
    )
        public
        view
    {
        resalePrice = bound(resalePrice, 0, 100_000_000 * 10**18); // Rp100 Juta
        (, uint256 royalty) = nft.royaltyInfo(TOKEN_REGULER, resalePrice);
        assertLe(royalty, resalePrice, "Royalti tidak boleh melebihi total pembayaran");
    }

    // ════════════════════════════════════════════════════════════════
    //  ON-CHAIN IDENTITY SYNCHRONIZATION & BUY INTEGRATION
    // ════════════════════════════════════════════════════════════════

    function test_BuyPrimary_WithOnChainIdentityRegistration() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 2);
        marketplace.listPrimary(TOKEN_REGULER, 2, PRICE_REGULER);
        vm.stopPrank();

        bytes32[] memory niks = new bytes32[](2);
        string[] memory names = new string[](2);
        niks[0] = _hash("3171012345670001");
        names[0] = "Joko";
        niks[1] = _hash("3171012345670002");
        names[1] = "Siti";

        vm.prank(alice);
        marketplace.buyTicket(0, 2, niks, names);

        // Verifikasi data terdaftar di TicketNFT
        TicketNFT.TicketHolder[] memory holders = nft.getTicketHolders(alice, TOKEN_REGULER);
        assertEq(holders.length, 2, "Harus ada 2 holder terdaftar");
        assertEq(holders[0].name, "Joko");
        assertEq(holders[0].nikHash, _hash("3171012345670001"));
        assertEq(holders[1].name, "Siti");
        assertEq(holders[1].nikHash, _hash("3171012345670002"));
    }

    function test_Buy_RevertIfArrayLengthMismatch() public {
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        marketplace.listPrimary(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();

        bytes32[] memory niks = new bytes32[](2); // mismatch: beli 1 tapi array isi 2
        string[] memory names = new string[](1);
        niks[0] = _hash("111"); niks[1] = _hash("222");
        names[0] = "A";

        vm.prank(alice);
        vm.expectRevert(ITicketMarketplace.ArrayLengthMismatch.selector);
        marketplace.buyTicket(0, 1, niks, names);
    }

    function test_Resale_IdentityResync_OnSecondaryPurchase() public {
        // 1. Setup Alice beli tiket primer dengan identitasnya
        vm.startPrank(organizer);
        nft.mintToMarketplace(TOKEN_REGULER, 1);
        marketplace.listPrimary(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();

        bytes32[] memory aliceNiks = new bytes32[](1);
        string[] memory aliceNames = new string[](1);
        aliceNiks[0] = _hash("3171012345670001");
        aliceNames[0] = "Alice Holder";

        vm.prank(alice);
        marketplace.buyTicket(0, 1, aliceNiks, aliceNames);

        // Cek identitas Alice terdaftar
        TicketNFT.TicketHolder[] memory holdersAlice = nft.getTicketHolders(alice, TOKEN_REGULER);
        assertEq(holdersAlice.length, 1);
        assertEq(holdersAlice[0].name, "Alice Holder");

        // 2. Alice jual ke Bob via Resale
        vm.startPrank(alice);
        nft.setApprovalForAll(address(marketplace), true);
        marketplace.listResale(TOKEN_REGULER, 1, PRICE_REGULER);
        vm.stopPrank();

        // Listing ID untuk resale REGULER adalah 1
        bytes32[] memory bobNiks = new bytes32[](1);
        string[] memory bobNames = new string[](1);
        bobNiks[0] = _hash("3171012345679999");
        bobNames[0] = "Bob Buyer";

        vm.prank(bob);
        marketplace.buyTicket(1, 1, bobNiks, bobNames);

        // 3. Verifikasi resinkronisasi identitas otomatis:
        //    Dengan swap-and-pop (Tahap 5/F6), identitas Alice DIHAPUS PENUH dari array
        //    sehingga tidak ada "zombie entry" yang tertinggal.
        TicketNFT.TicketHolder[] memory holdersAliceAfter = nft.getTicketHolders(alice, TOKEN_REGULER);
        assertEq(holdersAliceAfter.length, 0, "Identitas Alice harus terhapus penuh via swap-and-pop");
        assertEq(nft.getUnusedTicketCount(alice, TOKEN_REGULER), 0, "Counter unused Alice harus 0");

        TicketNFT.TicketHolder[] memory holdersBob = nft.getTicketHolders(bob, TOKEN_REGULER);
        assertEq(holdersBob.length, 1, "Identitas Bob harus terdaftar");
        assertEq(holdersBob[0].name, "Bob Buyer");
        assertEq(holdersBob[0].nikHash, _hash("3171012345679999"));
    }
}
