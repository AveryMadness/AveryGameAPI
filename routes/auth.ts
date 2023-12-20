import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as token from "../token.ts"
import * as accountUtil from "../accountUtil.ts"
import { DocumentSnapshot, collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { auth, db } from "../database.ts";
import { checkHashedPassword } from "../hashutil.ts";
import { userpassAuth } from "../middleware.ts";
import { logger } from "../util.ts";

export default async function() {
    const router = new Hono();

    router.get("/getUserIdFromAuthToken", async (c) => {
        const key = c.req.header("authKey");

        if (!key)
        {
            return c.json({code: 400, message: "Invalid user parameters"}, 400);
        }

        const users = collection(db, "user");

        let returnVal = "";
        const querySnapshot = await getDocs(users);
        querySnapshot.forEach((doc:DocumentSnapshot) => {
            // doc.data() is never undefined for query doc snapshots
            if (doc.data()["token"] == key)
            {
                returnVal = doc.data()["id"];
            }
        }, null);

        if (returnVal == "")
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        return c.json({code: 200, message: "Success", user: returnVal});
    });

    router.post("/invalidateAuthToken", userpassAuth, async (c) => {
        const postData = await c.req.json();

        const userId = postData["user"];
        const username = postData["username"];
        const tokenToInvalidate = postData["token"]

        if (!userId || !username || !tokenToInvalidate)
        {
            c.status(400);
            return c.json({
                code: 403,
                message: "Invalid user parameters."
            });
        }

        if (!await accountUtil.validateUserFromID(userId, username))
        {
            c.status(400);
            return c.json({
                code: 400,
                message: `User ID ${userId} does not match user ${username}`
            });
        }


        const authTokens = await token.getTokenFromUserId(userId);
        
        if (!authTokens.includes(tokenToInvalidate))
        {
            c.status(404);
            return c.json({
                code: 404,
                message: `Auth Token or ID ${userId} is not valid/found.`
            });
        }

        token.invalidateToken(tokenToInvalidate);
        return c.json({error: 200, message: "Success"});

    });

    router.post("/createAuthToken", userpassAuth, async (c) => {
        const postData = await c.req.json();

        const userId = postData["user"];
        const username = postData["username"];

        if (!userId || !username)
        {
            c.status(400);
            return c.json({
                code: 400,
                message: "Invalid user parameters."
            });
        }

        if (!await accountUtil.validateUserFromID(userId, username))
        {
            c.status(400);
            return c.json({
                code: 400,
                message: `User ID ${userId} does not match user ${username}`
            });
        }

        const authToken = token.generateToken(userId);
        
        c.status(200);
        return c.json({
            code: 200,
            message: "",
            auth: authToken
        });
    });

    return router;
}

function validateUserFromID() {
  throw new Error("Function not implemented.");
}
