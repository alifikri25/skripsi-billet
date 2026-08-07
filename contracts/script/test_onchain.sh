#!/bin/bash
set -e

source "$(dirname "$0")/../.env"

MARKETPLACE="0x44d565b75Ad385c340538DE9d3be348d7F6B48Fb"
NFT="0x2e8e67aA822D8E2c7FAC95D6B142830C7dbe1Ebc"
IDRX="0x4e08cb232D2EbC355B1298109039DCd665fA42f8"
RPC="${BASE_SEPOLIA_URL}"

ADDR1=$(cast wallet address --private-key $USER1_PK)
ADDR2=$(cast wallet address --private-key $USER2_PK)
ADDR3=$(cast wallet address --private-key $USER3_PK)
ORG_ADDR=$(cast wallet address --private-key $ORGANIZER_PK)
GATE_ADDR=$(cast wallet address --private-key $GATEKEEPER_PK)

echo "Addresses:"
echo "ORG: $ORG_ADDR"
echo "GATE: $GATE_ADDR"
echo "USER1: $ADDR1"
echo "USER2: $ADDR2"
echo "USER3: $ADDR3"
echo "---------------------------------"

echo "1. Funding ETH to Users..."
# Send 0.005 ETH to each user
cast send $ADDR1 --value 0.005ether --private-key $ORGANIZER_PK --rpc-url $RPC
cast send $ADDR2 --value 0.005ether --private-key $ORGANIZER_PK --rpc-url $RPC
cast send $ADDR3 --value 0.005ether --private-key $ORGANIZER_PK --rpc-url $RPC
echo "Funding complete."
echo "---------------------------------"

echo "2. Setting up GateKeeper..."
cast send $NFT "setGateKeeper(address,bool)" $GATE_ADDR true --private-key $ORGANIZER_PK --rpc-url $RPC
echo "GateKeeper configured."
echo "---------------------------------"

echo "3. Configuring Ticket Category (Token 1)..."
# configureTicketCategory(uint256 tokenId, uint256 supply, uint256 price, uint256 ceilingBps, uint96 royaltyBps, uint256 start, uint256 end)
# Price: 1000 IDRX (1000 * 10^18), Ceiling: 11000 (110%), Royalty: 500 (5%), Start: 0, End: 0
cast send $NFT "configureTicketCategory(uint256,uint256,uint256,uint256,uint96,uint256,uint256)" 1 100 1000000000000000000000 11000 500 0 0 --private-key $ORGANIZER_PK --rpc-url $RPC
echo "Category configured."
echo "---------------------------------"

echo "4. Minting 10 Tickets to Marketplace..."
cast send $NFT "mintToMarketplace(uint256,uint256)" 1 10 --private-key $ORGANIZER_PK --rpc-url $RPC
echo "Minting complete."
echo "---------------------------------"

echo "5. Organizer listing tickets on Primary Market..."
# listPrimary(uint256 tokenId, uint256 amount, uint256 pricePerUnit)
cast send $MARKETPLACE "listPrimary(uint256,uint256,uint256)" 1 10 1000000000000000000000 --private-key $ORGANIZER_PK --rpc-url $RPC
echo "Primary listing complete."
echo "---------------------------------"

# Since _nextListingId increments, we will just use a script to figure out the listing id or assume the last listed one is what we want.
# We'll just search for Listing events to find the Listing ID, or we can use Node.js to be precise. 
# But let's pause here.
