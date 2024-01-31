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
        const address = await c.req.header("cf-connecting-ip") ?? "";

        if (c.req.header("test") == "true")
        {
            c.req.raw.headers.forEach((val:string, key:string, parent:Headers) => {
                logger.info(`${key}: ${val}`);
            });
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
        const userId = c.req.header("user");
        const key = c.req.header("authKey");
        
        if (username != null && password != null) {
            const userExitsRef = doc(db, "user", username);
            const docSnap = await getDoc(userExitsRef);
       
            if (!docSnap.exists()) {
                c.status(404);
                return c.json({
                    error: 404,
                    message: `User ${username} not found.`
                });
            }
       
            if (docSnap.data()["banned"]) {
                return c.json({
                    code: 403,
                    message: `User ${username} is banned.`
                }, 403);
            }
       
            const hash = docSnap.data()["password"];
       
            if (!await checkHashedPassword(hash, password)) {
                c.status(403);
                return c.json({
                    code: 403,
                    message: `Password for user ${username} is invalid.`
                });
            }
       
            const isAdmin = docSnap.data()["isAdmin"];
       
            if (!isAdmin) {
                return c.json({
                    code: 403,
                    message: `Invalid permissions for user ${username}.`
                }, 403);
            }
        }
        else if (userId != null && key != null)
        {
            const username = await accountUtil.getUsernameFromUserID(userId);
            if (!username || username == "")
            {  
                return c.json({code: 404, message: `User '${userId}' not found.`}, 404);
            }
            const correctKey = await token.getTokenFromUserId(userId);

            if (key != correctKey)
            {
                return c.json({code: 403, message: `Authentication key '${key}' incorrect.`}, 403) 
            }

            const userRef = doc(db, "user", username);
            const userSnap = await getDoc(userRef);

            return c.text(userSnap.data()["isAdmin"]);
            if (!userSnap.data()["isAdmin"])
            {
                return c.json({code: 403, message: `Invalid permissions for user '${username}'`}, 403)
            }
        }
        else if ((key == null && userId == null) || (username == null && password == null))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 403);
        }

        await next();
    };
}

export const UsernamePasswordMiddleware = ():MiddlewareHandler => {
    return async (c, next) => {
        const jsonData = await c.req.json();

        const username = jsonData["username"];
        const password = jsonData["password"];
        const key = c.req.header("authKey");
        const user = c.req.header("user");

        if (username != null && password != null) {

            if (!username || !password) {
                c.status(400);
                return c.json({ code: 400, message: "Invalid user parameters." });
            }
        
            const userExitsRef = doc(db, "user", username);
            const docSnap = await getDoc(userExitsRef);
        
            if (docSnap.data()["banned"]) {
                return c.json({ code: 403, message: `User ${username} is banned.` }, 403);
            }
        
            if (!docSnap.exists()) {
                c.status(404);
                return c.json({ error: 404, message: `User ${username} not found.` });
            }
        
            const hash = docSnap.data()["password"];
        
            if (!await checkHashedPassword(hash, password)) {
                c.status(403);
                return c.json({ error: 403, message: `Password for user ${username} is invalid.` });
            }
        }
        else if (user != null && key != null)
        {
            const username = await accountUtil.getUsernameFromUserID(user);
            if (!username || username == "")
            {
                return c.json({code: 404, message: `User ${user} not found.`}, 404);
            }

            const correctKey = await token.getTokenFromUserId(user);

            if (correctKey != key)
            {
                return c.json({code: 403, message: `Invalid permissions for user '${username}'`}, 403);
            }
        }
        else if ((key == null && user == null) || (username == null && password == null))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        await next();
    };
};

export const userAuth = UsernamePasswordMiddleware();
export const adminAuth = AdminMiddleware();
export const ratelimitAuth = RateLimitedMiddleware();