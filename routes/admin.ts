import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as accountUtil from "../accountUtil.ts";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";
import { adminAuth, adminKeyAuth } from "../middleware.ts";
import { logger } from "../util.ts";
import { to } from "https://deno.land/x/optic@1.3.11/logger/profileMeasure.ts";
import { toPathString } from "https://deno.land/std@0.206.0/fs/_util.ts";

export default async function() {
    const router = new Hono();

    router.post("/internal/getMemoryUsage", adminAuth, async (c) => {
       const memUsage = Deno.memoryUsage();
       return c.json({code: 200, message: "Success", rss: memUsage.rss, heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal}, 200); 
    });

    router.post("/updateSourceFiles", adminAuth, async (c) => {
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

    router.post("/pak/uploadPak", adminKeyAuth, async (c) => {
        const body = await c.req.arrayBuffer();
        const user = c.req.header("user");
        const fileName = c.req.header("fileName");
        logger.warn(`User ${user} is uploading pak ${fileName}.`);

        return c.text("Not implemented");
    });

    router.post("/offer/createOffer", adminAuth, async (c) => {
        const postData = await c.req.json();
        const username = postData.username;
        const offer = postData.offer;
        logger.warn(`User ${username} is creating an offer with name '${offer.offerName}'`);
        
        const offerRef = doc(db, "offers", offer.offerName);
        const offerSnap = await getDoc(offerRef);

        if (offerSnap.exists())
        {
            return c.json({code: 400, message: `Offer ${offer.offerName} alredy exists.`});
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
    });

    router.post("/flags/setEventFlag", adminAuth, async (c) => {
        const postData = await c.req.json();
        const flag = postData.flag;
        const value = postData["value"];

        if (!flag || (!value && isNaN(value)))
        {
            return c.json({code: 400, message: "Invalid user parameters"}, 400);
        }

        if (!flag.startsWith("flag."))
        {
            return c.json({code: 400, message: "Badly formatted flag."}, 400);
        }

        const flagsRef = doc(db, "flags", flag);

        await setDoc(flagsRef, {
            value: value
        });

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.post("/flags/delete/:flag", adminAuth, async (c) => {
        const postData = await c.req.json();
        
        const {flag} = c.req.param();

        if (!flag)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const newsRef = doc(db, "flags", flag);
        const newsSnap = await getDoc(newsRef);

        if (!newsSnap.exists())
        {
            return c.json({code: 404, message: `Flag ${flag} not found.`}, 404);
        }

        await deleteDoc(newsRef);

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.post("/news/deletePost", adminAuth, async (c) => {
        const postData = await c.req.json();
        const postId = postData["id"];

        if (!postId)
        {
            return c.json({code: 400, message: "Invalid user parameters"}, 400);
        }

        const newsRef = doc(db, "news", postId);
        const newsSnap = await getDoc(newsRef);

        if (!newsSnap.exists())
        {
            return c.json({code: 404, message: `Post ${postId} not found.`}, 404);
        }

        await deleteDoc(newsRef);

        return c.json({code: 200, message: "Success"});
    })

    router.post("/news/createPost", adminAuth, async (c) => {
        const postData = await c.req.json();
        const content = postData["content"];
        const title = postData["title"];
        const photo = postData["photo"];

        if (!content || !title || !photo)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const id = (Math.floor(Date.now() * 2 / 1.8)).toString();
        const creationData = Date.now().toString();

        const newsRef = doc(db, "news", id);

        let authorName = "";

        const userRef = doc(db, "user", postData["username"]);
        const userSnap = await getDoc(userRef);

        const uid = userSnap.data()["id"];

        if (uid == "1699465204298")
        {
            authorName == "System";
        }
        else
        {
            authorName = postData["username"];
        }

        await setDoc(newsRef, {
            "content": content,
            "title": title,
            "photo": photo,
            "createdOn": creationData,
            "author": authorName
        });

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

        const docRef = doc(db, "user", username);
        const docSnap = await getDoc(docRef);

        await updateDoc(docRef, {
            MtxCurrency: amount
        });

        return c.json({code: 200, message: "Success"}, 200);
        
    });

    router.post("/deleteUser", adminAuth, async (c) => {
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

        const docRef = doc(db, "user", username);
        const docSnap = await getDoc(docRef);

        const deleterRef = doc(db, "user", deleterUsername);
        const deleterSnap = await getDoc(deleterRef);

        if (docSnap.data()["isAdmin"] == true && deleterSnap.data()["id"] != "1698121131246")
        {
            return c.json({code: 403, message: `Cannot delete user ${username}. Insufficient Permissions.`}, 403);
        }

        await deleteDoc(docRef);
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

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists())
        {
            return c.text("Unknown profile error.", 500);
        }

        const data = userSnap.data();

        if (data["isAdmin"] == true)
        {
            return c.text("True", 200);
        }
        else
        {
            return c.text("False", 200);
        }
    });

    router.post("/setAdmin", adminAuth, async (c) => {
        const postData = await c.req.json();
        const userToSet = postData["user"];
        const valueToSet = postData["admin"];

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

        const userRef = doc(db, "user", username);
        
        await updateDoc(userRef, {
            isAdmin: actualValue
        });

        return c.json({code: 200, message: "Success"}, 200);

    });

    router.post("/setBanned", adminAuth, async (c) => {
        const postData = await c.req.json();
        const userToSet = postData["user"];
        const valueToSet = postData["banned"];

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

        const userRef = doc(db, "user", username);
        
        await updateDoc(userRef, {
            banned: actualValue
        });

        return c.json({code: 200, message: "Success"}, 200);

    });

    router.post("/setBetaTester", adminAuth, async (c) => {
        const postData = await c.req.json();
        const userToSet = postData["user"];
        const valueToSet = postData["betaTester"];

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

        const userRef = doc(db, "user", username);
        
        await updateDoc(userRef, {
            betaTester: actualValue
        });

        return c.json({code: 200, message: "Success"}, 200);

    });

    return router;
}