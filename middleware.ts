import type { MiddlewareHandler } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { db } from "./database.ts";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { checkHashedPassword } from "./hashutil.ts";
import * as token from "./token.ts";
import { logger } from "./util.ts";
import * as accountUtil from "./accountUtil.ts"
import auth from "./routes/auth.ts";

const rateLimits:string[] = [];

export const RateLimitedMiddleware = ():MiddlewareHandler => {
    return async (c, next) => {
        const {hostname, port, transport} = c.env.remoteAddr;
        const address = hostname;

        if (c.req.header("test") == "true")
        {
            return c.text(address);
        }
        
        if (address == "")
        {
            return await next();
        }

        if (rateLimits.includes(address))
        {
            c.header("Retry-After", "3000", {append: true});
            return c.json({code: 429, message: "Too many requests."}, 429);
        }

        rateLimits.push(address);
        setTimeout(() => {rateLimits.splice(rateLimits.indexOf(address), 1)}, 3000);
        await next();
    };  
};

export const AdminMiddleware = ():MiddlewareHandler => {
    return async (c, next) => {
        const jsonData = await c.req.json();

        const username = jsonData["username"];
        const password = jsonData["password"];

        if (!username || !password)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }
        
        const userExitsRef = doc(db, "user", username);
        const docSnap = await getDoc(userExitsRef);

        if (!docSnap.exists())
        {
            c.status(404);
            return c.json({error: 404, message: `User ${username} not found.`});
        }

        if (docSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${username} is banned.`}, 403);
        }

        const hash = docSnap.data()["password"];

        if (!await checkHashedPassword(hash, password))
        {
            c.status(403);
            return c.json({error: 403, message: `Password for user ${username} is invalid.`});
        }

        const isAdmin = docSnap.data()["isAdmin"];

        if (!isAdmin)
        {
            return c.json({error: 403, message: `Invalid permissions for user ${username}.`}, 403);
        }

        await next();
    };
}

export const AdminKeyMiddleware = ():MiddlewareHandler => {
    return async (c, next) => {
        let userId = c.req.query("user");

        if (!userId)
        {
            const json = await c.req.json();
            userId = json["user"];
        }

        if (!userId)
        {
            userId = c.req.header("user");
        }

        const authKey = c.req.header("authKey");

        if (!userId || !authKey)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."})
        }

        const userTokens = await token.getTokenFromUserId(userId);

        if (userTokens != authKey)
        {
            c.status(401);
            return c.json({code: 401, message: "Invalid or expired Authentication Key."});
        }

        const username = accountUtil.getUsernameFromUserID(userId);

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        if (userSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${username} is banned.`}, 403);
        }

        if (!userSnap.data()["isAdmin"])
        {
            return c.json({code: 403, message: `Not enough permissions for user ${username}.`}, 403);
        }

        await next();
    };
}

export const AuthKeyMiddleware = ():MiddlewareHandler => {
    return async (c, next) => {


        let userId = c.req.query("user");

        if (!userId)
        {
            try {
                const json = await c.req.json();
                userId = json["user"];
            }
            catch (e)
            {}
        }

        if (!userId)
        {
            userId = c.req.header("user");
        }

        const authKey = c.req.header("authKey");

        if (!userId || !authKey)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."})
        }

        const userTokens = await token.getTokenFromUserId(userId);

        if (userTokens != authKey)
        {
            c.status(401);
            return c.json({code: 401, message: "Invalid or expired Authentication Key."});
        }

        await next();

    };
};

export const UsernamePasswordMiddleware = ():MiddlewareHandler => {
    return async (c, next) => {
        const jsonData = await c.req.json();

        const username = jsonData["username"];
        const password = jsonData["password"];

        if (!username || !password)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }
        
        const userExitsRef = doc(db, "user", username);
        const docSnap = await getDoc(userExitsRef);

        if (docSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${username} is banned.`}, 403);
        }

        if (!docSnap.exists())
        {
            c.status(404);
            return c.json({error: 404, message: `User ${username} not found.`});
        }

        const hash = docSnap.data()["password"];

        if (!await checkHashedPassword(hash, password))
        {
            c.status(403);
            return c.json({error: 403, message: `Password for user ${username} is invalid.`});
        }

        await next();
    };
};

export const userpassAuth = UsernamePasswordMiddleware();
export const adminAuth = AdminMiddleware();
export const adminKeyAuth = AdminKeyMiddleware();
export const keyAuth = AuthKeyMiddleware();
export const ratelimitAuth = RateLimitedMiddleware();