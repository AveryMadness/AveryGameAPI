import {
    ColumnType,
    Generated,
    Insertable,
    JSONColumnType,
    Selectable,
    Updateable
  } from 'kysely'

export type Database = {
    flags: FlagsTable
    news: NewsTable
    offers: ShopOffersTable
    users: UserTable
    inventory: UserInventory
    pending_users: PendingUsersTable
};

export interface FlagsTable {
    flag_id: string
    flag_value: string
};

export type Flags = Selectable<FlagsTable>
export type NewFlags = Insertable<FlagsTable>
export type FlagsUpdate = Updateable<FlagsTable>

export interface NewsTable {
    news_id: string
    news_author: string
    news_content: string
    news_creation_date: string
    news_icon: string
    news_title: string
}

export type News = Selectable<NewsTable>
export type NewNews = Insertable<NewsTable>
export type NewsUpdate = Updateable<NewsTable>

export interface ShopOffersTable {
    offer_name: string
    offer_cost: number
    offer_mtx_requirement: boolean
    offer_promo_code: string
    offer_allow_promo_code: boolean
    offer_redemption_message: string
}

export type Offers = Selectable<ShopOffersTable>
export type NewOffers = Insertable<ShopOffersTable>
export type OffersUpdate = Updateable<ShopOffersTable>

export interface UserInventoryTable {
    item_owner_id: string
    item_entry_name: string
    item_equipped: boolean
    item_weapon: boolean
    item_type: string
    item_count: number
    item_path: string
}

export type UserInventory = Selectable<UserInventoryTable>
export type NewUserInventory = Insertable<UserInventoryTable>
export type UserInventoryUpdate = Updateable<UserInventoryTable>

export interface UserTable {
    user_name: string
    user_mtx: number
    user_id: string
    user_token: string
    user_password: string
    user_role: number
    user_status: number
    user_warnings: number
} 

export type User = Selectable<UserTable>
export type NewUser = Insertable<UserTable>
export type UserUpdate = Updateable<UserTable>

export interface PendingUsersTable {
    user_name: string
    user_email: string
    user_password: string
    user_bio: string
}

export type PendingUsers = Selectable<PendingUsersTable>
export type NewPendingUsers = Insertable<PendingUsersTable>
export type PendingUsersUpdate = Updateable<PendingUsersTable>

