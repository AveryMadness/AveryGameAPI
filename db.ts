import postgres from "postgres";
import { Kysely } from "kysely";
import { PostgresDialect } from "kysely-postgres-js";
import { Database } from "./tables.ts";
import {logger} from "./util.ts"
import "https://deno.land/std@0.204.0/dotenv/load.ts";


export const db = new Kysely<Database>({
    dialect: new PostgresDialect({
        hostname: Deno.env.get("PG_HOST") ?? "localhost",
        port: parseInt(Deno.env.get("PG_PORT") ?? "5432"),
        database: Deno.env.get("PG_DATABASE") ?? "averygameapi",
        user: Deno.env.get("PG_USER") ?? "postgres",
        password: Deno.env.get("PG_PASSWORD") ?? "password"
    }),
});

export type Db = typeof db;
