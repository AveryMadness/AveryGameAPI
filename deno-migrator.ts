// https://github.com/CodingGarden/fresh-spots/blob/main/app/db/migrate-utils.ts
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { Db } from "./db.ts";
import * as kysely from "kysely";

export type FreshDb = kysely.Kysely<Db>;

export function createTableWithDefaults<T extends string>(
    schema: FreshDb["schema"],
    tableName: T,
    hasId = true,
) {
    const notNullNow = (col: kysely.ColumnDefinitionBuilder) => col.notNull().defaultTo(kysely.sql`NOW()`);

    const schemaWithDates = schema
        .createTable(tableName)
        .addColumn("created_at", "timestamptz", notNullNow)
        .addColumn("updated_at", "timestamptz", notNullNow);

    if (hasId) {
        return schemaWithDates.addColumn(
            "id",
            "serial",
            (col) => col.primaryKey(),
        );
    }

    return schemaWithDates;
}

export class DenoFileMigrationProvider extends kysely.FileMigrationProvider {
    folder: string;

    constructor() {
        super({
            fs: {
                readdir(path) {
                    return Promise.resolve(
                        [...Deno.readDirSync(path)].map((file) => file.name),
                    );
                },
            },
            path: {
                join,
            },
            migrationFolder: "./database/migrations",
        });

        this.folder = "./database/migrations";
    }

    async getMigrations(): Promise<Record<string, kysely.Migration>> {
        const migrations: Record<string, kysely.Migration> = {};
        const files = await Deno.readDir(this.folder);

        for await (const file of files) {
            migrations[file.name] = await import(
                ["./database/migrations", file.name].join("/")
            );
        }

        return migrations;
    }
}
