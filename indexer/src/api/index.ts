import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

// Register the GraphQL middleware
app.use("/graphql", graphql({ db, schema }));

// Optional: Also serve at the root if preferred
app.use("/", graphql({ db, schema }));

export default app;
