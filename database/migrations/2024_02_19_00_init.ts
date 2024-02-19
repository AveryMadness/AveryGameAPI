import { type Db } from "../../db.ts";

export async function up(db: Db)
{
    await db.schema
        .createTable('flags')
        .addColumn('flag_id', 'text', (col) => col.notNull())
        .addColumn('flag_value', 'text', (col) => col.notNull())
        .execute()

    await db.schema
        .createTable('news')
        .addColumn('news_id', 'text', (col) => col.notNull())
        .addColumn('news_author', 'text', (col) => col.notNull())
        .addColumn('news_content', 'text', (col) => col.notNull())
        .addColumn('news_creation_date', 'text', (col) => col.notNull())
        .addColumn('news_icon', 'text', (col) => col.notNull())
        .addColumn('news_title', 'text', (col) => col.notNull())
        .execute()

    await db.schema
        .createTable('users')
        .addColumn('user_name', 'text', (col) => col.notNull())
        .addColumn('user_mtx', 'integer', (col) => col.notNull())
        .addColumn('user_id', 'text', (col) => col.notNull())
        .addColumn('user_token', 'text', (col) => col.notNull())
        .addColumn('user_password', 'text', (col) => col.notNull())
        .addColumn('user_role', 'integer', (col) => col.notNull())
        .addColumn('user_status', 'integer', (col) => col.notNull())
        .addColumn('user_warnings', "integer", (col) => col.notNull())
        .execute()

    await db.schema
        .createTable('inventory')
        .addColumn('item_owner_id', 'text', (col) => col.notNull())
        .addColumn('item_entry_name', 'text', (col) => col.notNull())
        .addColumn('item_equipped', 'boolean', (col) => col.notNull())
        .addColumn('item_weapon', 'boolean', (col) => col.notNull())
        .addColumn('item_type', 'text', (col) => col.notNull())
        .addColumn('item_count', 'integer', (col) => col.notNull())
        .addColumn('item_path', 'text', (col) => col.notNull())
        .execute()

    await db.schema
        .createTable('pending_users')
        .addColumn('user_name', 'text', (col) => col.notNull())
        .addColumn('user_email', 'text', (col) => col.notNull())
        .addColumn('user_password', 'text', (col) => col.notNull())
        .addColumn('user_bio', 'text', (col) => col.notNull())
        .execute()
}