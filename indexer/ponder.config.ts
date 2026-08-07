import { createConfig } from "ponder";
import { http } from "viem";

import { abi as TicketMarketplaceAbi } from "./abis/TicketMarketplace.js";
import { abi as TicketNFTAbi } from "./abis/TicketNFT.js";

export default createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: http(process.env.PONDER_RPC_URL_84532),
    },
  },
  contracts: {
    TicketMarketplace: {
      abi: TicketMarketplaceAbi,
      chain: "baseSepolia",
      address: (process.env.PONDER_TICKET_MARKETPLACE_ADDRESS || "0x2f8C649BaC946ad54eB191971787EF118B7ce350") as `0x${string}`,
      startBlock: Number(process.env.PONDER_TICKET_MARKETPLACE_START_BLOCK || 43559420),
    },
    TicketNFT: {
      abi: TicketNFTAbi,
      chain: "baseSepolia",
      address: (process.env.PONDER_TICKET_NFT_ADDRESS || "0x72bE03CD0683F501f68AF4a633E648cAbF9d364D") as `0x${string}`,
      startBlock: Number(process.env.PONDER_TICKET_NFT_START_BLOCK || 43559420),
    },
  },
});
