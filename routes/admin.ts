// deno-lint-ignore require-await

import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as accountUtil from "../accountUtil.ts";
import { db } from "../db.ts";
import { adminAuth } from "../middleware.ts";
import { logger } from "../util.ts";
//import { to } from "https://deno.land/x/optic@1.3.11/logger/profileMeasure.ts";
//import { toPathString } from "https://deno.land/std@0.206.0/fs/_util.ts";
import { UserRole } from "../accountUtil.ts";
//import * as account from "./account.ts";
//import * as token from "../token.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";
import { ServiceMiddleware } from "../middleware.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";


async function getJson(filePath: string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}


export let bIsMaintenanceMode = false;
export default async function() {
    const router = new Hono();

    router.get("/pending/:user", ServiceMiddleware("getPendingUsers"), adminAuth, async (c) => {
        const { user } = c.req.param();

        if (!user)
        {
            return c.json({code: 400, message: "bruh"}, 400);
        }

        const pendingUser = await db
        .selectFrom('pending_users')
        .selectAll('pending_users')
        .where('user_name', '=', user ?? "")
        .executeTakeFirst()
        
        if (!pendingUser)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        return c.json({code: 200, message: "Success", user: {
            username: pendingUser.user_name,
            email: pendingUser.user_email,
            bio: pendingUser.user_bio,
        }});
    });

    router.get("/pending/getPendingUsers", ServiceMiddleware("getPendingUsers"), adminAuth, async (c) => {
        const pendingUsers = await db
        .selectFrom('pending_users')
        .selectAll('pending_users')
        .execute()

        const retVal:object[] = [];
        for (let i = 0; i < pendingUsers.length; i++)
        {
            retVal.push(pendingUsers[i]);
        }

        return c.json({code: 200, message: "Success", pendingUsers: retVal});
    });

    router.post("/pending/acceptPendingUser", ServiceMiddleware("acceptDenyPendingUser"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const username = postData["user"];

        const pendingUser = await db
        .selectFrom('pending_users')
        .selectAll('pending_users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst()

        if (!pendingUser)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        const password = pendingUser.user_password;
        const email = pendingUser.user_email;

        await accountUtil.acceptPendingUser(username, email, password);

        return c.json({code: 200, message: "Success"});
    });

    router.post("/pending/denyPendingUser", ServiceMiddleware("acceptDenyPendingUser"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const user = postData["user"];

        const pendingUser = await db
        .selectFrom('pending_users')
        .selectAll('pending_users')
        .where('user_name', '=', user ?? "")
        .executeTakeFirst()

        if (!pendingUser)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        const client = new SmtpClient();

        await client.connectTLS({
            hostname: "smtp.gmail.com",
            port: 465,
            username: "averymadness62@gmail.com",
            password: Deno.env.get("SMTP_PASS")
        });

        await client.send({
            from: "averygame@averymadness.me",
            to: pendingUser.user_email,
            subject: "Avery Game user submission",
            content: "Your Avery Game user submission has been denied."
        });

        await client.close();

        const result = await db
        .deleteFrom('pending_users')
        .where('user_name', '=', user ?? "")
        .execute()

        return c.json({code: 200, message: "Success"});
    });

    router.post("/internal/setService", ServiceMiddleware("updateService"), adminAuth, async (c) => {
        const json = await getJson(path.join(".", "data", "services.json"));

        const postData = await c.req.json();
        const id = postData.service;
        const enabled = postData.enabled;

        if (!json["services"][id])
        {
            return c.json({code: 404, message: `Service ${id} not found.`}, 404);
        }
        
        json["services"][id].enabled = enabled;
        const jsonstr = JSON.stringify(json, null, 2);
        const file = await Deno.create(path.join(".", "data", "services.json"));
        const writer = file.writable.getWriter();
        await writer.write(new TextEncoder().encode(jsonstr));
        return c.json({code: 200, message: "Success"});
    });

    router.get("/internal/getServices", adminAuth, async (c) => {
        const json = await getJson(path.join(".", "data", "services.json"));

        const retVal:object[] = [];
        for (let i = 0; i < Object.keys(json["services"]).length; i++)
        {
            const jsonObjName = Object.keys(json["services"])[i];
            const jsonObj = json["services"][jsonObjName];
            retVal.push({id: jsonObjName, name: jsonObj["displayName"], enabled: jsonObj["enabled"]});
        }

        return c.json({code: 200, message: "Success", services: retVal});
    });

    router.post("/internal/getMemoryUsage", ServiceMiddleware("getMemoryUsage"), adminAuth, async (c) => {
       const memUsage = Deno.memoryUsage();
       return c.json({code: 200, message: "Success", rss: memUsage.rss, heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal}, 200); 
    });

    let MaintenanceTime:Date;
    router.post("/internal/setMaintenance", adminAuth, async (c) => {
        const postData = await c.req.json();
        const newMain = postData.active;

        bIsMaintenanceMode = newMain;
        MaintenanceTime = new Date(Date.now());
        return c.json({code: 200, message: "Success"}, 200);
    })

    router.get("/internal/isMaintenance", async (c) => {
        return c.json({code: 200, message: "Success", isMaintenance: bIsMaintenanceMode, timeSinceMaintenance: bIsMaintenanceMode ? MaintenanceTime.toISOString() : null}, 200);
    });

    router.post("/internal/updateSourceFiles", ServiceMiddleware("updateSourceFiles"), adminAuth, async (c) => {
        logger.warn(`User ${(await c.req.json())["username"]} is updating source files!`);
        const p = new Deno.Command("git", {args: ["pull"], stdout: 'piped'}).spawn();

        const status = await p.status;
        const outputString = new TextDecoder().decode((await p.output()).stdout);
        logger.info(`updateSourceFiles: ${outputString}`);
        if (status.success)
        {
            if (outputString.includes('Already up to date.'))
                return c.json({code: 409, message: "Already up to date."}, 409);
            return c.json({code: 200, message: "Success"}, 200);
        }
        else
        {
            return c.json({code: 500, message: "Failure"}, 500);
        }
    });

    router.post("/pak/uploadPak", adminAuth, async (c) => {
        const _body = await c.req.arrayBuffer();
        const user = c.req.header("user");
        const fileName = c.req.header("fileName");
        logger.warn(`User ${user} is uploading pak ${fileName}.`);

        return c.text("Not implemented");
    });

    /*router.post("/offer/createOffer", ServiceMiddleware("createOffer"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const username = postData.username;
        const daOffer = postData.offer;
        logger.warn(`User ${username} is creating an offer with name '${daOffer.offerName}'`);
        
        const offer = await db
        .selectFrom('offers')
        .selectAll('offers')
        .where('offer_name', '=', daOffer.offerName)
        .executeTakeFirst()

        if (offer)
        {
            return c.json({code: 400, message: `Offer ${daOffer.offerName} alredy exists.`});
        }

        await setDoc(offerRef, {
            offerName: offer.offerName,
            redemptionMessage: offer.redemptionMessage,
            promotionalOffer: offer.promotionalOffer,
            promotionalCode: offer.promotionalCode,
            microtransactionalRequirement: offer.microtransactionalRequirement,
            cost: offer.cost
        });

        for (let i = 0; i < offer.rewards.length; i++)
        {
            const reward = offer.rewards[i];
            const rewardRef = doc(db, "offers", offer.offerName, "rewards", reward.rewardName);

            await setDoc(rewardRef, {
                rewardName: reward.rewardName,
                statReward: reward.statReward,
                statName: reward.statName,
                statValue: reward.statValue,
                microtransactionalReward: reward.microtransactionalReward,
                microtransactionalAmount: reward.microtransactionalAmount
            });
        }

        return c.json({code: 200, message: "Success"});
    });*/

    router.post("/flags/setEventFlag", ServiceMiddleware("setOrDeleteEventFlag"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const flag = postData.flag;
        const value = postData["value"];
        const activeAt = postData["activeAt"];
        const activeTo = postData["activeTo"];


        if (!flag || (!value && isNaN(value)))
        {
            return c.json({code: 400, message: "Invalid user parameters"}, 400);
        }

        if (!flag.startsWith("flag."))
        {
            return c.json({code: 400, message: "Badly formatted flag."}, 400);
        }

        const flagObj = await db
        .selectFrom('flags')
        .selectAll('flags')
        .where('flag_id', '=', flag ?? "")
        .executeTakeFirst()

        if (flagObj)
        {
            const result = await db
            .updateTable('flags')
            .set({
                flag_id: flag,
                flag_value: value ?? "",
                active_at: activeAt ?? flagObj.active_at,
                active_until: activeTo ?? flagObj.active_until
            })
            .where('flag_id', '=', flag)
            .executeTakeFirst();
        }
        else
        {
            const result = await db
            .insertInto('flags')
            .values({
                flag_id: flag,
                flag_value: value ?? "",
                active_at: activeAt ?? new Date().toISOString(),
                active_until: activeTo ?? new Date().toISOString()
            })
            .executeTakeFirst();
        }

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.post("/flags/delete/:flag", ServiceMiddleware("setOrDeleteEventFlag"), adminAuth, async (c) => {        
        const {flag} = c.req.param();

        if (!flag)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const flagRef = await db
        .selectFrom('flags')
        .selectAll('flags')
        .where('flag_id', '=', flag)
        .executeTakeFirst();


        if (!flagRef)
        {
            return c.json({code: 404, message: `Flag ${flag} not found.`}, 404);
        }

        await db
        .deleteFrom('flags')
        .where('flag_id', '=', flag);

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.post("/news/deletePost", ServiceMiddleware("createOrDeleteNewsPost"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const postId = postData["id"];

        if (!postId)
        {
            return c.json({code: 400, message: "Invalid user parameters"}, 400);
        }

        const news = await db
        .selectFrom('news')
        .selectAll('news')
        .where('news_id', '=', postId);

        if (!news)
        {
            return c.json({code: 404, message: `Post ${postId} not found.`}, 404);
        }

        await db
        .deleteFrom('news')
        .where('news_id', '=', postId);

        return c.json({code: 200, message: "Success"});
    })

    router.post("/news/createPost", ServiceMiddleware("createOrDeleteNewsPost"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const content = postData["content"];
        const title = postData["title"];
        const photo = postData["photo"];

        if (!content || !title || !photo)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const id = (Math.floor(Date.now() * 2 / 1.8)).toString();
        const creationDate = Date.now().toString();

        let authorName = "";

        const user = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', postData["username"] ?? "")
        .executeTakeFirst()

        const uid = user?.user_id;

        if (uid == "1699465204298")
        {
            authorName == "System";
        }
        else
        {
            authorName = postData["username"];
        }

        await db.
        insertInto('news')
        .values({
            news_id: id ?? "",
            news_author: authorName,
            news_content: content,
            news_creation_date: creationDate ?? "",
            news_icon: photo,
            news_title: title
        })
        .executeTakeFirst()

        return c.json({code: 200, message: "Success", id: id}, 200);

    });

    router.post("/setMtxCurrency", adminAuth, async (c) => {
        const jsonData = await c.req.json();
        const user = jsonData["user"];
        const amount = jsonData["MtxCurrency"];

        if (!user || !amount || isNaN(amount))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const username = await accountUtil.getUsernameFromUserID(user);

        if (!username)
        {
            return c.json({code: 404, message: `User ${user} not found.`}, 404);
        }

        const result = await db.
        updateTable('users')
        .set({
            user_mtx: amount
        })
        .where('user_name', '=', username)
        .executeTakeFirst();

        return c.json({code: 200, message: "Success"}, 200);
        
    });

    router.post("/deleteUser", ServiceMiddleware("deleteUser"), adminAuth, async (c) => {
        const jsonData = await c.req.json();
        const toDelete = jsonData["toDelete"];
        const deleterUsername = jsonData["username"];

        const username = await accountUtil.getUsernameFromUserID(toDelete);

        if (!username)
        {
            return c.json({code: 404, message: `User ${toDelete} not found.`}, 404);
        }

        if (username == jsonData["username"])
        {
            return c.json({code: 403, message: `Cannot delete user ${username}. Insufficient Permissions.`}, 403);
        }

        const user = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username)
        .executeTakeFirst();

        const deleter = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', deleterUsername)
        .executeTakeFirst();

        await db
        .deleteFrom('users')
        .where('user_name', "=", username)
        .executeTakeFirst();

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.get("/isAdmin", async (c) => {
        const userId = c.req.query("user");

        if (!userId)
        {
            return c.text("Invalid query parameters.", 400);
        }

        const username = await accountUtil.getUsernameFromUserID(userId);
        
        if (username == "")
        {
            return c.text(`User ${userId} not found.`, 404);
        }

        const user = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst();

        if (!user)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        if (user.user_role > accountUtil.UserRole.BetaTester)
        {
            return c.text("True", 200);
        }
        else
        {
            return c.text("False", 200);
        }
    });

    
    router.post("/setRole", ServiceMiddleware("setAdmin"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const userToSet = postData["user"];
        const valueToSet = postData["role"];

        if (!userToSet || valueToSet == null)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const username = await accountUtil.getUsernameFromUserID(userToSet);

        if (username == "")
        {
            return c.json({code: 404, message: `User ${userToSet} not found.`}, 404);
        }

        await db
        .updateTable('users')
        .set({
            user_role: valueToSet
        })
        .where('user_name', '=', username ?? "")
        .executeTakeFirst();

        return c.json({code: 200, message: "Success"}, 200);

    });

    router.post("/setStatus", ServiceMiddleware("banUser"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const userToSet = postData["user"];
        const valueToSet = postData["status"];

        if (!userToSet || valueToSet == null)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const actualValue = Boolean(valueToSet);

        const username = await accountUtil.getUsernameFromUserID(userToSet);

        if (username == "")
        {
            return c.json({code: 404, message: `User ${userToSet} not found.`}, 404);
        }

        
        await db
        .updateTable('users')
        .set({
            user_status: valueToSet
        })
        .where('user_name', '=', username ?? "")
        .executeTakeFirst();

        return c.json({code: 200, message: "Success"}, 200);

    });

    return router;
}