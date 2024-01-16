import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { logger } from "../util.ts";
import { keyAuth, adminAuth, adminKeyAuth, userpassAuth } from "../middleware.ts";
import * as accountUtil from "../accountUtil.ts"
import { DocumentReference, DocumentSnapshot, QueryDocumentSnapshot, collection, doc, getDoc, getDocs, getDocsFromServer, query, setDoc, updateDoc, where } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
import { dirname } from "https://deno.land/std@0.206.0/path/dirname.ts";

async function getJson(filePath: string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}

export default async function() {
    const router = new Hono();

    const currentGameVersion = Deno.env.get("GAME_VERSION") ?? "0.25.0";

    router.get("/heartbeat", async (c) => {
        return c.json({code: 200, message: "You should never see this."});
    });

    router.get("/hasItem", keyAuth, async (c) => {
        const item = c.req.query("item");
        const user = c.req.header("user") ?? "";

        if (!item)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }
        
        const username = await accountUtil.getUsernameFromUserID(user);

        const itemRef = doc(db, "user", username, "inventory", item);
        const itemSnap = await getDoc(itemRef);

        return c.json({code: 200, message: "Success", hasItem: itemSnap.exists()}, 200);
    });

    router.post("/updateItem", keyAuth, async (c) => {
        const postData = await c.req.json();
        const user = postData.user;
        const bNewItem = postData.bNewItem ?? false;
        const item = postData.item ?? "";

        const username = await accountUtil.getUsernameFromUserID(user);

        if (bNewItem)
        {
            const count = postData.count ?? 0;
            const itemType = postData.itemType ?? "None";
            const bEquip = postData.bEquipItem ?? false;
            const bIsWeapon = postData.bIsWeapon ?? false;
            const itemPath = postData.itemPath ?? false;

            const itemRef = doc(db, "user", username, "inventory", item);
            const itemSnap = await getDoc(itemRef);

            if (bEquip)
            {
                await accountUtil.unequipWeaponOfType(itemType, username);
            }

            await setDoc(itemRef, {
                count: count,
                itemPath: itemPath,
                IsWeapon: bIsWeapon,
                IsEquipped: bEquip,
                ItemType: itemType
            });

            return c.json({code: 200, message: "Success"}, 200);
        }

        const itemRef = doc(db, "user", username, "inventory", item);
        const itemSnap = await getDoc(itemRef);

        if (!itemSnap.exists())
        {
            return c.json({code: 404, message: `Item ${item} not found.`}, 404);
        }

        const data = itemSnap.data();

        const count = postData.count ?? data.count;
        const itemType = postData.itemType ?? data.ItemType;
        const bEquip = postData.bEquipItem ?? data.IsEquipped;
        const bIsWeapon = postData.bIsWeapon ?? data.IsWeapon;
        const itemPath = postData.itemPath ?? data.itemPath;

        if (postData.bEquipItem)
        {
            await accountUtil.unequipWeaponOfType(itemType, username);
        }

        await updateDoc(itemRef, {
            count: count,
            ItemType: itemType,
            IsEquipped: bEquip,
            IsWeapon: bIsWeapon,
            itemPath: itemPath
        });

        return c.json({code: 200, message: "Success"}, 200);

    });

    router.get("/getItem", keyAuth, async (c) => {
        const user = c.req.header("user");
        const item = c.req.query("item");

        if (!user || !item)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const username = await accountUtil.getUsernameFromUserID(user);
        
        const userRef = doc(db, "user", username, "inventory", item);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists())
        {
            return c.json({code: 404, message: `Item ${item} not found.`}, 404);
        }

        return c.json({code: 200, message: "Success", count: userSnap.data()["count"] ?? 0, itemPath: userSnap.data()["itemPath"] ?? "", bIsWeapon: userSnap.data()["IsWeapon"] ?? false, bIsEquipped: userSnap.data()["IsEquipped"] ?? false, itemType: userSnap.data()["ItemType"] ?? "None"});
    });

    router.get("/getEquippedWeapons", keyAuth, async (c) => {
        const user = c.req.header("user");

        if (!user)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const username = await accountUtil.getUsernameFromUserID(user);

        const q = query(collection(db, "user", username, "inventory"), where("IsEquipped", "==", true), where("IsWeapon", "==", true));

        let primary:any = {};
        let secondary:any = {};
        let primaryExists:boolean = false;
        let secondaryExists:boolean = false;

        const querySnapshot = await getDocs(q);
        await querySnapshot.forEach(async (doc:QueryDocumentSnapshot) => {
            const data = doc.data();
            if (data["ItemType"] == "Primary")
            {
                primary = data;
                primaryExists = true;
            }
            else if (data["ItemType"] == "Secondary")
            {
                secondary = data;
                secondaryExists = true;
            }
        }, null);

        return c.json({code: 200, message: "Success", primary: primary, secondary: secondary, bHasPrimary: primaryExists, bHasSecondary: secondaryExists});
    });

    router.post("/offer/claimOffer", keyAuth, async (c) => {
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

    router.get("/offer/:offerid", async (c) => {
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
    
    });

    router.get("/checkGameVersion", async (c) => {
        const gameVersion = await c.req.query("version");

        var json = await getJson(path.join(".", "data", "version.json"));
        var versions = json.playableVersions;

        if (!gameVersion)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }
        
        return c.json({code: 200, message: "Success", correctVersion: versions.includes(gameVersion)});
    });

    router.get("/getGameVersions", async (c) => {
        const versions:object[] = [];

        var json = await getJson(path.join(".", "data", "version.json"));
        var versionStrings = json.playableVersions;
        var versionTypes = json.versionType;
        
        for (let i = 0; i < versionStrings.length; i++)
        {
            const versionStr = versionStrings[i];
            const versionType = versionTypes[i];

            versions.push({version: versionStr, type: versionType});
        }

        return c.json({code: 200, message: "Success", versions: versions});
    });

    router.get("/playlist/:playlistId", async (c) => {
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

    router.get("/getPlaylists", async (c) => {
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

    router.get("/getStats", keyAuth, async (c) => {
        const userId = await c.req.header("user") ?? "";

        const username = await accountUtil.getUsernameFromUserID(userId);

        if ((username == null || username == ""))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const q = query(collection(db, "user", username, "stat"));

        const retVal:Map<string, string> = new Map();
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc:QueryDocumentSnapshot) => {
            retVal.set(doc.id, doc.data()["value"]);
        }, null);

        let retObj = JSON.parse("{}");

        retVal.forEach((val, key) => {
            retObj[key] = val;
        });

        return c.json({code: 200, message: "Success", stats: retObj});
    });

    router.get("/getStat", keyAuth, async (c) => {
        const stat = await c.req.header("stat") ?? "";
        const userId = await c.req.header("user") ?? "";

        const username = await accountUtil.getUsernameFromUserID(userId);

        if ((username == null || username == "") || (stat == null || stat == ""))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const statRef = doc(db, "user", username, "stat", stat);
        const statSnap = await getDoc(statRef);

        if (!statSnap.exists())
        {
            return c.json({code: 404, message: `Stat ${stat} not found.`}, 404);
        }

        const data = statSnap.data();

        const value = data["value"];

        return c.json({code: 200, message: "Success", value: value}, 200);
    });

    router.post("/setStat", keyAuth, async (c) => {
        const postData = await c.req.json();

        const statPath = postData["stat"];
        const value = postData["value"];
        const userId = postData["user"];

        const username = await accountUtil.getUsernameFromUserID(userId);

        if (!username || !value || !statPath)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const statRef = doc(db, "user", username, "stat", statPath);
        const statSnap = await getDoc(statRef);

        if (statSnap.exists())
        {
            await updateDoc(statRef, {
                value: value
            });
        }
        else
        {
            await setDoc(statRef, {
                value: value
            });
        }

        return c.json({code: 200, message: "Success"}, 200);
    });

    return router;
}