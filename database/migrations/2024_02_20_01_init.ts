import { type Db } from "../../db.ts";

export async function up(db: Db)
{
    await db.schema
        .alterTable('cloudstorage')
        .addColumn('uploaded', 'text', (col) => col.notNull())
        .execute()
}