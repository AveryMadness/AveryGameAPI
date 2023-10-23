import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as token from "../token.ts"
import * as accountUtil from "../accountUtil.ts"
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { auth, db } from "../database.ts";
import { checkHashedPassword } from "../hashutil.ts";
import { userpassAuth } from "../middleware.ts";

export default async function() {
    const router = new Hono();

    router.post("/invalidateAuthToken", userpassAuth, async (c) => {
        const postData = await c.req.json();

        const userId = postData["user"];
        const username = postData["username"];

        if (!userId || !username)
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


        const authToken = token.getTokenFromUserId(userId);
        
        if (authToken == "")
        {
            c.status(404);
            return c.json({
                code: 404,
                message: `Auth Token or ID ${userId} is not valid/found.`
            });
        }

        token.invalidateToken(authToken);
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
