import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as accountUtil from "../accountUtil.ts";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";
import { adminAuth } from "../middleware.ts";
import { logger } from "../util.ts";

export default async function() {
    const router = new Hono();

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