// deno-lint-ignore require-await

import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as hashLibrary from "../hashutil.ts"
import { logger } from "../util.ts";
import { db } from "../db.ts";
import * as accountUtil from "../accountUtil.ts"
import { adminAuth, userAuth } from "../middleware.ts";
import * as token from "../token.ts";
import * as validation from "https://deno.land/x/validation@v0.4.0/email.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";
import { ServiceMiddleware } from "../middleware.ts";


export const UserStatus = Object.freeze({
    Offline: Symbol(0),
    Online: Symbol(1),
    Playing: Symbol(2),
    Away: Symbol(3),
    None: Symbol(-1)
});

export default async function() {
    const router = new Hono();

    const banWarnCounterKey = "01BEC33FE5575E51CEE950A439DCB47A5C28AED5A3137C29F864710CCBA8E128";
    router.post("/incrementBanWarningCounter", userAuth, async (c) => {
        const postData = await c.req.json();
        let key = postData.key;
        const userId = key.split(banWarnCounterKey)[1];
        key = key.split(userId)[0];

        if (key != banWarnCounterKey)
        {
            return c.json({code: 403, message: "Invalid authentication."}, 403);
        }

        const username = await accountUtil.getUsernameFromUserID(userId) ?? "";
        if (username == "")
        {
            return c.json({code: 403, message: "Invalid authentication."}, 403);
        }

        if (userId != postData.user)
        {
            return c.json({code: 403, message: "Invalid authentication."}, 403);
        }

        const severity = postData.severity;
        const user = await db.
        selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username)
        .executeTakeFirst()

        if (!user)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }
        const warns:number = user.user_warnings;

        if (warns + severity >= 10)
        {
            await db
            .updateTable('users')
            .set({
                user_status: accountUtil.UserStatus.Banned,
                user_warnings: 10
            })
            .executeTakeFirst();
            return c.json({code: 200, message: "Success", bHasBanned: true}, 200);
        }
        else
        {
            await db
            .updateTable('users')
            .set({
                user_warnings: warns + severity
            })
            .executeTakeFirst()
            return c.json({code: 200, message: "Success", bHasBanned: false}, 200);
        }

    });

    router.post("/authenticateAdmin", ServiceMiddleware("login"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const username = postData["username"];

       
        //const key = await token.generateToken(userId);
        return c.json({code: 200, message: "Success", /*key: key, userId: userId*/}, 200);
    });

    router.get("/game/getItem", async (c) => {

    });

    router.post("/authenticateAuthKey", ServiceMiddleware("login"), async (c) => {
        const postData = await c.req.json();
        const userId = postData["user"];
        const _key = postData["key"];

        const tok = await token.getTokenFromUserId(userId);

        if (!tok)
        {
            return c.json({code: 403, message: "Unauthorized"}, 403);
        }

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.post("/authenticateAdminKey", ServiceMiddleware("login"), adminAuth, async (c) => {
        const postData = await c.req.json();
        const userId = postData["user"];
        const key = await token.generateToken(userId);
        return c.json({code: 200, message: "Success", key: key, userId: userId}, 200);
    });

    router.get("getMtxCurrency", userAuth, async (c) => {
        const user = await c.req.header("user") || "";

        const username = await accountUtil.getUsernameFromUserID(user);

        if (!username)
        {
            c.json({code: 404, message: `User ${user} not found.`}, 404);
        }

        const userDoc = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst()

        if (!userDoc)
        {
            return c.json({code: 404, message: "User not found"}, 404);
        }

        let MtxCurrency:Number = 0;

        MtxCurrency = userDoc.user_mtx;

        return c.json({code: 200, message: "Success", mtx: MtxCurrency ?? 0});
    });

    router.get("getPermission", ServiceMiddleware("getBetaPermission"), async (c) => {
        const user = c.req.query("user");

        if (!user)
        {
            return c.json({code: 400, message: "Invalid user parameters"}, 400);
        }

        const username = await accountUtil.getUsernameFromUserID(user);

        if (!username)
        {
            return c.json({code: 404, message: `User for ${user} not found.`}, 404);
        }

        const userDoc = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst()

        if (!userDoc)
        {
            return c.json({code: 404, message: "User not found"}, 404);
        }

        return c.json({code: 200, message: "Success", hasPermission: userDoc.user_role >= accountUtil.UserRole.BetaTester}, 200);
    });

    router.post("/authenticateUser", ServiceMiddleware("login"), async (c) => {
        const postData = await c.req.json();

        const username = postData["username"];
        const password = postData["password"];

        if (username == null || password == null)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }

        if (username == "" || password == "")
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }

        const user = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst()

        if (!user)
        {
            return c.json({code: 404, message: "User not found"}, 404);
        }

        if (user.user_status == accountUtil.UserStatus.Banned)
            return c.json({code: 403, message: `User ${username} is banned.`}, 403);
        
        if (user)
        {
            const hash = user.user_password;
            const validPass = await hashLibrary.checkHashedPassword(hash, password);

            if (validPass)
            {
                c.status(200);
                const key = await token.generateToken(user.user_id);
                return c.json({code: 200, message: "Success", key: key, userId: user.user_id});
            }
            else
            {
                c.status(403);
                return c.json({code: 403, message: "Password incorrect."});
            }
        }
        else
        {
            c.status(404);
            return c.json({code: 404, message: `User ${username} not found.`});
        }
        
    });

    router.post("/createUser", ServiceMiddleware("createUser"), async (c) => {
        const postData = await c.req.json();

        const username = postData["username"];
        const password = postData["password"];
        const email = postData["email"];
        const bio = postData["bio"];

        if (username == null || password == null || bio == null || email == null || !validation.valid(email))
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }


        const id = Date.now().toString();

        const userDoc = await db
        .selectFrom('pending_users')
        .selectAll('pending_users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst()
        
        if (userDoc)
        {
            c.status(403);
            return c.json({code: 403, message: `User ${username} already exists.`});
        }

        const hashPass = await hashLibrary.hashPassword(password);

        const result = await db
        .insertInto('pending_users')
        .values({
            user_name: username,
            user_email: email,
            user_password: password,
            user_bio: bio
        })
        .executeTakeFirst();

        const client = new SmtpClient();

        await client.connectTLS({
            hostname: "smtp.gmail.com",
            port: 465,
            username: "averymadness62@gmail.com",
            password: Deno.env.get("SMTP_PASS")
        });

        await client.send({
            from: "averygame@averymadness.me",
            to: email,
            subject: "Avery Game user submission",
            content: "Your Avery Game user submission has been submitted. You will be notified when it is accepted."
        });

        await client.close();

        //auto accept me
        if (username == "AveryMadness" && email == "averymadness62@gmail.com") {
            const success = await accountUtil.acceptPendingUser(username, email, hashPass);
            if (success)
            {
                logger.info("Auto accepted user " + username);
            }
            else
            {
                logger.error("failed to auto accept " + username);
            }
        }

        return c.json({code: 200, message: "Success", userId: id});
    });


    return router;
}