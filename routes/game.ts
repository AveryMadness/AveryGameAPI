// deno-lint-ignore require-await
import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { logger } from "../util.ts";
import { userAuth } from "../middleware.ts";
import * as accountUtil from "../accountUtil.ts"
import { db } from "../db.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
//import { dirname } from "https://deno.land/std@0.206.0/path/dirname.ts";
import { bIsMaintenanceMode } from "./admin.ts";
import { ServiceMiddleware } from "../middleware.ts";

async function getJson(filePath: string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}

export default async function() {
    const router = new Hono();

    router.get("/heartbeat", async (c) => {
        if (bIsMaintenanceMode)
        {
            return c.json({code: 429, message: "bIsMaintenanceMode true"}, 429);
        }
        return c.json({code: 200, message: "You should never see this."});
    });

    router.get("/hasItem", ServiceMiddleware("getItem"), userAuth, async (c) => {
        const item = c.req.query("item");
        const user = c.req.header("user") ?? "";

        if (!item || !user)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }
        
        const Item = await db
        .selectFrom('inventory')
        .selectAll('inventory')
        .where('item_owner_id', '=', user)
        .where('item_entry_name', '=', item)
        .executeTakeFirst();

        return c.json({code: 200, message: "Success", hasItem: Item != undefined}, 200);
    });

    router.post("/updateItem", ServiceMiddleware("updateItem"), userAuth, async (c) => {
        const postData = await c.req.json();
        const user = postData.user;
        const bNewItem = postData.bNewItem ?? false;
        const item:string = postData.item ?? "";

        const username = await accountUtil.getUsernameFromUserID(user);

        if (bNewItem)
        {
            const count:number = postData.count;
            const itemType:string = postData.itemType;
            const bEquip:boolean = postData.bEquipItem;
            const bIsWeapon:boolean = postData.bIsWeapon;
            const itemPath:string = postData.itemPath;

            if (!count || !itemType || bEquip == undefined || 
                bIsWeapon == undefined || !itemPath)
            {
                return c.json({code: 400, message: "New item does not have enough defining variables."}, 400);
            }

            if (bEquip)
            {
                await accountUtil.unequipWeaponOfType(itemType, username);
            }

            const ItemExistsRef = await db
            .selectFrom('inventory')
            .selectAll('inventory')
            .where('item_owner_id', '=', user)
            .where('item_entry_name', '=', item)
            .executeTakeFirst();

            if (ItemExistsRef)
            {
                return c.json({code: 400, message: "New item already exists."}, 400);
            }

            await db.
            insertInto('inventory')
            .values({
                item_owner_id: user,
                item_entry_name: item,
                item_equipped: bEquip,
                item_weapon: bIsWeapon,
                item_type: itemType,
                item_count: count,
                item_path: itemPath
            })
            .executeTakeFirst();

            return c.json({code: 200, message: "Success"}, 200);
        }

        const ItemExistsRef = await db
            .selectFrom('inventory')
            .selectAll('inventory')
            .where('item_owner_id', '=', user)
            .where('item_entry_name', '=', item)
            .executeTakeFirst();

        if (!ItemExistsRef)
        {
            return c.json({code: 404, message: `Item ${item} not found.`}, 404);
        }

        const count:number = postData.count ?? ItemExistsRef.item_count;
        const itemType:string = postData.itemType ?? ItemExistsRef.item_type;
        const bEquip:boolean = postData.bEquipItem ?? ItemExistsRef.item_equipped;
        const bIsWeapon:boolean = postData.bIsWeapon ?? ItemExistsRef.item_weapon;
        const itemPath:string = postData.itemPath ?? ItemExistsRef.item_path;

        if (postData.bEquipItem || !ItemExistsRef.item_equipped)
        {
            await accountUtil.unequipWeaponOfType(itemType, username);
        }

        await db.
        updateTable('inventory')
        .set({
            item_equipped: bEquip,
            item_weapon: bIsWeapon,
            item_type: itemType,
            item_count: count,
            item_path: itemPath
        })
        .where('item_entry_name', '=', item)
        .where('item_owner_id', '=', user)
        .execute();

        return c.json({code: 200, message: "Success"}, 200);

    });

    router.get("/getItem", ServiceMiddleware("getItem"), userAuth, async (c) => {
        const user = c.req.header("user");
        const item = c.req.query("item");

        if (!user || !item)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const Item = await db
        .selectFrom('inventory')
        .selectAll('inventory')
        .where('item_owner_id', '=', user)
        .where('item_entry_name', '=', item)
        .executeTakeFirst();

        if (!Item)
        {
            return c.json({code: 404, message: `Item ${item} not found.`}, 404);
        }

        return c.json({code: 200, message: "Success", count: Item.item_count ?? 0, itemPath: Item.item_path ?? "", bIsWeapon: Item.item_weapon ?? false, bIsEquipped: Item.item_equipped ?? false, itemType: Item.item_type});
    });

    router.get("/getEquippedWeapons", ServiceMiddleware("getItem"), userAuth, async (c) => {
        const user = c.req.header("user");

        if (!user)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const username = await accountUtil.getUsernameFromUserID(user);

        let primary = JSON.parse("{}");
        let secondary = JSON.parse("{}");
        let primaryExists = false;
        let secondaryExists = false;

        const pri = await db
        .selectFrom('inventory')
        .selectAll('inventory')
        .where('item_owner_id', '=', user ?? "")
        .where('item_equipped', '=', true)
        .where('item_type', '=', 'Primary')
        .executeTakeFirst() ?? undefined;

        const sec = await db
        .selectFrom('inventory')
        .selectAll('inventory')
        .where('item_owner_id', '=', user ?? "")
        .where('item_equipped', '=', true)
        .where('item_type', '=', 'Secondary')
        .executeTakeFirst() ?? undefined;

        

        return c.json({code: 200, message: "Success", primary: pri != undefined ? {
            item_owner_id: pri.item_owner_id,
            item_entry_name: pri.item_entry_name,
            item_equipped: pri.item_equipped,
            item_weapon: pri.item_weapon,
            item_type: pri.item_type,
            item_count: pri.item_count,
            item_path: pri.item_path,
        } : null, secondary: sec != undefined ? {
            item_owner_id: sec.item_owner_id,
            item_entry_name: sec.item_entry_name,
            item_equipped: sec.item_equipped,
            item_weapon: sec.item_weapon,
            item_type: sec.item_type,
            item_count: sec.item_count,
            item_path: sec.item_path,
        } : null, bHasPrimary: pri != undefined, bHasSecondary: sec != undefined});
    });

    /*router.post("/offer/claimOffer", ServiceMiddleware("claimOffer"), userAuth, async (c) => {
        const postData = await c.req.json();
        const user = postData.user;
        const offerId = postData.offer;

        if (!offerId)
        {
            return c.json({code: 400, message: "Invalid user parameters."});
        }

        const offerRef = doc(db, "offers", offerId);
        const offerSnap = await getDoc(offerRef);

        if (!offerSnap.exists())
        {
            return c.json({code: 404, message: `Offer '${offerId} not found.`});
        }

        const name = await accountUtil.getUsernameFromUserID(user);
        const offerExistsRef = doc(db, "offers", offerId, "redeemed", name);
        const snap = await getDoc(offerExistsRef);

        if (snap.exists())
        {
            return c.json({code: 403, message: "Offer already redeemed."});
        }

        const data = offerSnap.data();

        if (data.promotionalOffer)
        {
            const promoCode = postData.promoCode;
            if (!promoCode)
            {
                return c.json({code: 400, message: "Invalid user parameters."});
            }

            if (data.promotionalCode != promoCode)
            {
                return c.json({code: 403, message: "Incorrect promo code."});
            }
        }

        if (data.microtransactionalRequirement)
        {
            const username = await accountUtil.getUsernameFromUserID(user);
            const cost = data.cost;
            const userRef = doc(db, "user", username);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            const MtxCurrency = userData.MtxCurrency ?? 0;
            if (MtxCurrency < cost)
            {
                return c.json({code: 403, message: "Not enough MtxCurrency to redeem offer."});
            }

            updateDoc(userRef, {
                MtxCurrency: (MtxCurrency - cost)
            });
        }

        const username = await accountUtil.getUsernameFromUserID(user);
        const rewardsCollection = collection(db, "offers", offerId, "rewards");
        const q = await getDocs(rewardsCollection);
        await q.forEach(async (rewardDoc:DocumentSnapshot) => {
            const data = rewardDoc.data();

            if (data.statReward)
            {
                const statRef = doc(db, "user", username, "stat", data.statName);
                await setDoc(statRef, {
                    value: data.statValue
                });
            }

            if (data.microtransactionalReward)
            {
                const userRef = doc(db, "user", username);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();
                
                await updateDoc(userRef, {
                    MtxCurrency: (userData.MtxCurrency ?? 0) + data.microtransactionalAmount
                });
            }
        }, null);

        await setDoc(offerExistsRef, {
            redeemed: true
        });

        return c.json({code: 200, message: "Success", redemptionMessage: data.redemptionMessage});
    });

    router.get("/offer/:offerid", ServiceMiddleware("getOffer"), async (c) => {
        let { offerid } = await c.req.param();
        offerid = decodeURIComponent(offerid);

        const offerRef = doc(db, "offers", offerid);
        const offerSnap = await getDoc(offerRef);

        if (!offerSnap.exists())
        {
            return c.json({code: 404, message: `Offer '${offerid}' not found.`});
        }

        const rewards:object[] = [];

        const rewardsCollection = collection(db, "offers", offerid, "rewards");
        const q = await getDocs(rewardsCollection);
        q.forEach((doc:DocumentSnapshot) => {
            const data = doc.data();
            rewards.push({rewardName: data.rewardName, statReward: data.statReward, statName: data.statName, statValue: data.statValue, microtransactionalReward: data.microtransactionalReward, microtransactionalAmount: data.microtransactionalAmount});
        }, null);

        const data = offerSnap.data();
        return c.json({code: 200, message: "Success", offer: {
            offerName: data.offerName,
            redemptionMessage: data.redemptionMessage,
            promotionalOffer: data.promotionalOffer,
            promotionalCode: data.promotionalCode,
            microtransactionalRequirement: data.microtransactionalRequirement,
            cost: data.cost,
            rewards: rewards
        }});
    
    });*/

    router.get("/checkGameVersion", ServiceMiddleware("checkGameVersion"), async (c) => {
        const gameVersion = await c.req.query("version");

        if (bIsMaintenanceMode)
        {
            return c.json({code: 403, message: "Sorry, all servers are currently offline for maintenance. Check back later!"}, 403);
        }


        const json = await getJson(path.join(".", "data", "version.json"));
        const versions = json.playableVersions;

        if (!gameVersion)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        let validVersions = "";
        for (let i = 0; i < versions.length; i++)
        {
            validVersions += `${versions[i]} (${json["versionType"][i]})${i == (versions.length - 1) ? "" : ","}`
        }
    
        return c.json({code: 200, message: "Success", correctVersion: versions.includes(gameVersion), type: versions.includes(gameVersion) ? versions[gameVersion] : null});
    });

    router.get("/getGameVersions", ServiceMiddleware("getGameVersions"), async (c) => {
        const versions:object[] = [];

        const json = await getJson(path.join(".", "data", "version.json"));
        const versionStrings = json.playableVersions;
        const versionTypes = json.versionType;
        
        for (let i = 0; i < versionStrings.length; i++)
        {
            const versionStr = versionStrings[i];
            const versionType = versionTypes[i];

            versions.push({version: versionStr, type: versionType});
        }

        return c.json({code: 200, message: "Success", versions: versions});
    });

    router.get("/playlist/:playlistId", ServiceMiddleware("getPlaylist"), async (c) => {
        const { playlistId } = c.req.param();

        if (!playlistId)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const json = await getJson(path.join(".", "data", "playlist.json"));

        if (!json[playlistId] || json[playlistId]["exposed"] == false)
        {
            return c.json({code: 404, message: `Playlist ${playlistId} not found.`}, 404);
        }

        const playlist = json[playlistId];

        return c.json({code: 200, message: "Success", playlist: {name: playlist["name"], description: playlist["description"], recommendedLevel: playlist["recommendedLevel"], minimumLevel: playlist["minimumLevel"] ?? 0, assetPath: playlist["assetPath"], overrideGameData: playlist["overrideGameData"] ?? false}});
    });

    router.get("/getPlaylists", ServiceMiddleware("getPlaylist"), async (c) => {
        const json = await getJson(path.join(".", "data", "playlist.json"));

        const playlists:string[] = [];

        for (let i = 0; i < Object.keys(json).length; i++)
        {
            if (json[Object.keys(json)[i]]["exposed"] == false)
                continue;

            playlists.push(Object.keys(json)[i]);
        }

        return c.json({code: 200, message: "Success", playlists: playlists});
    });

    router.get("/getStats", ServiceMiddleware("getAndSetStatValue"), userAuth, async (c) => {
        const userId = await c.req.header("user") ?? "";

        const username = await accountUtil.getUsernameFromUserID(userId);

        if ((username == null || username == ""))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const stats = await db
        .selectFrom('stats')
        .selectAll('stats')
        .where('stat_owner_id', '=', userId)
        .execute();

        const retObj = JSON.parse("{}");

        for (let i = 0; i < stats.length; i++)
        {
            const stat = stats[i];
            if (stat.stat_type == "string")
            {
                retObj[stat.stat_id] = stat.stat_value;
            }
            else if (stat.stat_type == 'number')
            {
                retObj[stat.stat_id] = parseInt(stat.stat_value);
            }
            else if (stat.stat_type == 'boolean')
            {
                retObj[stat.stat_id] = stat.stat_value == "true" ? true : false;
            }
            else
            {
                return c.json({code: 500, message: "Malformed stat type"}, 500);
            }
        }

        return c.json({code: 200, message: "Success", stats: retObj});
    });

    router.get("/getStat", ServiceMiddleware("getAndSetStatValue"), userAuth, async (c) => {
        const stat = await c.req.header("stat") ?? "";
        const userId = await c.req.header("user") ?? "";

        const username = await accountUtil.getUsernameFromUserID(userId);

        if ((username == null || username == "") || (stat == null || stat == ""))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const Stat = await db
        .selectFrom('stats')
        .selectAll('stats')
        .where('stat_owner_id', '=', userId)
        .where('stat_id', '=', stat)
        .executeTakeFirst();

        if (!Stat)
            return c.json({code: 404, message: "Not found."}, 404);

        let value:any = Stat.stat_value;

        if (Stat.stat_type == "string")
        {
            value = Stat.stat_value;
        }
        else if (Stat.stat_type == "number")
        {
            value = parseInt(Stat.stat_value);
        }
        else if (Stat.stat_type == "boolean")
        {
            value = Stat.stat_value == "true" ? "true" : "false";
        }
        else
        {
            return c.json({code: 500, message: "Malformed stat type."}, 500);
        }

        return c.json({code: 200, message: "Success", value: value}, 200);
    });

    router.post("/setStat", ServiceMiddleware("getAndSetStatValue"), userAuth, async (c) => {
        const postData = await c.req.json();

        const statPath = postData["stat"] ?? "";
        const value = postData["value"] ?? "";
        const userId = postData["user"] ?? "";
        const type = postData["type"] ?? "";

        const username = await accountUtil.getUsernameFromUserID(userId);

        if (!username || !value || !statPath || !type)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        if (type != "string" && type != "boolean" && type != "number")
        {
            return c.json({code: 400, message: "Malformed stat type."}, 400);
        }

        const statExists = await db
        .selectFrom('stats')
        .selectAll('stats')
        .where('stat_owner_id', '=', userId)
        .where('stat_id', '=', statPath)
        .executeTakeFirst();

        if (!statExists)
        {
            await db
            .insertInto('stats')
            .values({
                stat_owner_id: userId,
                stat_id: statPath,
                stat_value: value,
                stat_type: type
            })
            .execute();
        }
        else
        {
            await db
            .updateTable('stats')
            .set({
                stat_owner_id: userId,
                stat_id: statPath,
                stat_value: value,
                stat_type: type
            })
            .where('stat_owner_id', '=', userId)
            .where("stat_id", '=', statPath)
            .execute();
        }

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.get("/profile/:user", userAuth, async (c) => {
        const {user} = c.req.param();
        const realUser = c.req.header("user") ?? "";

        if (user != realUser)
        {
            return c.json({code: 403, message: "Unauthorized."}, 403);
        }

        const stats = await db
        .selectFrom('stats')
        .selectAll('stats')
        .where('stat_owner_id', '=', user)
        .execute();

        const retObj = JSON.parse("{}");

        for (let i = 0; i < stats.length; i++)
        {
            const stat = stats[i];
            if (stat.stat_type == "string")
            {
                retObj[stat.stat_id].stat_value = stat.stat_value;
            }
            else if (stat.stat_type == 'number')
            {
                retObj[stat.stat_id].stat_value = parseInt(stat.stat_value);
            }
            else if (stat.stat_type == 'boolean')
            {
                retObj[stat.stat_id].stat_value = stat.stat_value == "true" ? true : false;
            }
            else
            {
                return c.json({code: 500, message: "Malformed stat type"}, 500);
            }

            retObj[stat.stat_id].stat_type = stat.stat_type;
        }

        const inventory = await db
        .selectFrom('inventory')
        .selectAll('inventory')
        .where('item_owner_id', '=', user)
        .execute();

        let Primary;
        let Secondary;

        const inventoryItems = [];

        for (let i = 0; i < inventory.length; i++)
        {
           const item = inventory[i];
           if (item.item_equipped)
           {
                if (item.item_type == "Primary")
                {
                    Primary = item;
                }
                else if (item.item_type == "Secondary")
                {
                    Secondary = item;
                }
           }

           inventoryItems[i] = item;
        }

        const Inventory = {
            equipped_items: {
                primary_item: Primary,
                secondary_item: Secondary,
                primary_exists: Primary != undefined,
                secondary_exists: Secondary != undefined
            },
            items: inventoryItems,
            generated_at: new Date().toISOString()
        };

        retObj.generated_at = new Date().toISOString();

        const Stats = retObj;

        const userData = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_id', '=', user)
        .executeTakeFirst();

        if (!userData)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        const MtxCurrency = {
            current_store_type: "AveryGame",
            current_mtx_amount: userData.user_mtx,
            generated_at: new Date().toISOString()
        }

        const profile = {
            user_name: userData.user_name,
            user_id: user,
            user_warnings: userData.user_warnings,
            user_role: userData.user_role,
            user_status: userData.user_status,
            mtx_currency: MtxCurrency,
            user_stats: Stats,
            user_inventory: Inventory,
            generated_at: new Date().toISOString()
        };

        return c.json({code: 200, message: "Success", profile: profile});
    });

    return router;
}