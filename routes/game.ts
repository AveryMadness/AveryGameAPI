import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { logger } from "../util.ts";
import { keyAuth, adminAuth, adminKeyAuth, userpassAuth } from "../middleware.ts";
import * as accountUtil from "../accountUtil.ts"
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";


export default async function() {
    const router = new Hono();

    const currentGameVersion = Deno.env.get("GAME_VERSION") ?? "0.25.0";

    router.get("/checkGameVersion", async (c) => {
        const gameVersion = await c.req.header("version");

        if (!gameVersion)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        logger.info(currentGameVersion);

        return c.json({code: 200, message: "Success", correctVersion: (gameVersion == currentGameVersion) ?? false});
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