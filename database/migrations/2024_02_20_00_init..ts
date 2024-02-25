import { type Db } from "../../db.ts";

export async function up(db: Db)
{
    await db.schema
        .createTable('cloudstorage')
        .addColumn('owner_user_id', 'text', (col) => col.notNull())
        .addColumn('data', 'text', (col) => col.notNull())
        .addColumn('file_name', 'text', (col) => col.notNull())
        .execute()
}