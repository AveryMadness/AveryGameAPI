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
    stats: UserStats
    cloudstorage: UserSettingsTable
};

export interface FlagsTable {
    flag_id: string
    flag_value: string
    active_at: string
    active_until: string
};

export type Flags = Selectable<FlagsTable>
export type NewFlags = Insertable<FlagsTable>
export type FlagsUpdate = Updateable<FlagsTable>

export interface UserStats {
    stat_owner_id: string
    stat_id: string
    stat_value: string
    stat_type: string
}

export type Stats = Selectable<UserStats>
export type NewStats = Insertable<UserStats>
export type StatsUpdate = Updateable<UserStats>

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

export interface UserSettingsTable {
    owner_user_id: string
    data: string
    file_name: string
    uploaded: string
}

export type UserSettings = Selectable<UserSettingsTable>
export type NewUserSettings = Insertable<UserSettingsTable>
export type UserSettingsUpdate = Updateable<UserSettingsTable>

export interface UserInboxTable {
    owner_user_id: string
    message_title: string
    message_author: string
    message_content: string
    message_sent: string
    message_read: boolean
}

export type UserInbox = Selectable<UserInboxTable>
export type NewUserInbox = Insertable<UserInboxTable>
export type UserInboxUpdate = Updateable<UserInboxTable>

