import { type Db } from "../../db.ts";

export async function up(db: Db)
{
    await db.schema
        .alterTable('flags')
        .addColumn('active_at', 'text', (col) => col.notNull())
        .addColumn('active_until', 'text', (col) => col.notNull())
        .execute()

    await db.schema
        .createTable('stats')
        .addColumn('stat_owner_id', 'text', (col) => col.notNull())
        .addColumn('stat_id', 'text', (col) => col.notNull())
        .addColumn('stat_value', 'text', (col) => col.notNull())
        .addColumn('stat_type', 'text', (col) => col.notNull())
        .execute()
}