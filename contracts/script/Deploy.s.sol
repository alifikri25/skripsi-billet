// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TicketNFT} from "../src/TicketNFT.sol";
import {TicketMarketplace} from "../src/TicketMarketplace.sol";
import {MockERC20} from "../src/mock/MockERC20.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy Mock IDRX Stablecoin (untuk simulasi / testing)
        // NOTE: Untuk produksi di Base Mainnet, gunakan alamat IDRX resmi (0x87aC32B870... atau yang setara)
        // dan lewati tahap deploy mock ini.
        MockERC20 idrx = new MockERC20("Rupiah Digital", "IDRX");

        // 2. Deploy TicketNFT
        TicketNFT nft = new TicketNFT("https://api.smartticket.io/metadata/{id}");

        // 3. Deploy Marketplace dengan reference ke NFT dan IDRX
        // NOTE: Untuk produksi, pass alamat IDRX resmi sebagai parameter ke-2 constructor TicketMarketplace.
        TicketMarketplace marketplace = new TicketMarketplace(address(nft), address(idrx));

        // 4. Autorisasi marketplace di NFT contract
        nft.setAuthorizedMarketplace(address(marketplace));

        // 4b. Whitelist deployer sebagai kreator agar bisa membuat event via createAndListEvent.
        //     Pada produksi, owner menambahkan kreator/agency tepercaya lainnya melalui fungsi ini.
        marketplace.setApprovedCreator(deployer, true);

        // 5. Setup kategori tiket (IDRX decimal = 18)
        //    configureTicketCategory(tokenId, maxSupply, price, ceilingBps, royaltyBps, start, end)
        nft.configureTicketCategory(1, 1000, 100_000 * 10**18, 11000, 500, 0, 0);  // REGULER (Rp100.000, ceiling 110%, royalty 5%, tanpa batas waktu)
        nft.setTicketCategoryName(1, "REGULER");
        
        nft.configureTicketCategory(2, 200,  500_000 * 10**18, 11000, 500, 0, 0);  // VIP (Rp500.000)
        nft.setTicketCategoryName(2, "VIP");
        
        nft.configureTicketCategory(3, 50,   1_000_000 * 10**18, 11000, 500, 0, 0); // VVIP (Rp1.000.000)
        nft.setTicketCategoryName(3, "VVIP");

        vm.stopBroadcast();

        console.log("Mock IDRX deployed at:         ", address(idrx));
        console.log("TicketNFT deployed at:         ", address(nft));
        console.log("TicketMarketplace deployed at: ", address(marketplace));
        console.log("Deployer:                      ", deployer);
    }
}
