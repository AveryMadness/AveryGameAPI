import { Migrator } from "kysely";
import { db } from "./db.ts";
import { DenoFileMigrationProvider } from "./deno-migrator.ts";
import { logger } from "./util.ts";

const provider = new DenoFileMigrationProvider();

const migrator = new Migrator({ db, provider });

const { error, results } = await migrator.migrateToLatest();

results?.forEach((it) => {
    if (it.status === "Success") {
        console.info(
            `Migration "${it.migrationName}" was executed successfully`,
        );
    } else if (it.status === "Error") {
        console.error(`Failed to execute migration "${it.migrationName}"`);
    }
});

if (error) {
    throw error;
}
