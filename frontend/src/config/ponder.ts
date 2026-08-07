import { GraphQLClient } from "graphql-request";

// URL Ponder Indexer (development)
const PONDER_URL = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql";

export const ponderClient = new GraphQLClient(PONDER_URL);
