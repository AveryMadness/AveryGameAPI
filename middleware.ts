import type { MiddlewareHandler } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { db } from "./database.ts";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { checkHashedPassword } from "./hashutil.ts";
import * as token from "./token.ts";
import { logger, backendHostType, BackendHostType } from "./util.ts";
import * as accountUtil from "./accountUtil.ts"
//import auth from "./routes/auth.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";


async function getJson(filePath: string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}

const rateLimits:string[] = [];

export const HostTypeMiddleware = (hostType:BackendHostType = backendHostType):MiddlewareHandler => {
    return async (c, next) => {

        if (hostType == BackendHostType.Prod)
            return await next();

        if (hostType == BackendHostType.None)
        {
            logger.error("Tried to access host type, but host type is NONE! Exiting...");
            Deno.exit(1);
        }
        const authName = hostType == BackendHostType.Developer ? "DEVELOPER_AUTH_KEY" : "STAGING_AUTH_KEY";

        const authHeader = c.req.header("hostAuthentication");

        if (!authHeader)
        {
            return c.json({code: 400, message: "Invalid authentication header."}, 400);
        }

        const correctAuth = Deno.env.get(authName);

        if (authHeader != correctAuth)
        {
            return c.json({code: 403, message: "Invalid authentication key."}, 403);
        }

        await next();
    };
};

export const ServiceMiddleware = (service:string):MiddlewareHandler => {
    return async (c, next) => {
        const services = await getJson(path.join("data", "services.json"));

        const services2 = services.services;
        const serviceSym = services2[service];

        if (!serviceSym.enabled)
        {
            return c.json({code: 422, message: `'${serviceSym.displayName}' Service disabled.`});
        }

        await next();
    };
};

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
        let username = null;
        let password = null;
        const userId = c.req.header("user");
        const key = c.req.header("authKey");
        if (c.req.method == "POST")
        {
        const jsonData = await c.req.json();

        username = jsonData["username"];
        password = jsonData["password"];
       
        
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
       
            if (docSnap.data()["userStatus"] == accountUtil.UserStatus.Banned) {
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
       
           
       
            if (docSnap.data()["role"] < accountUtil.UserRole.Administrator) {
                return c.json({
                    code: 403,
                    message: `Invalid permissions for user ${username}.`
                }, 403);
            }
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

            if (userSnap.data()["userStatus"] == accountUtil.UserStatus.Banned) {
                return c.json({
                    code: 403,
                    message: `User ${username} is banned.`
                }, 403);
            }

            if (userSnap.data()["role"] < accountUtil.UserRole.Administrator) 
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
        let username = null;
        let password = null;
        const userId = c.req.header("user");
        const key = c.req.header("authKey");
        if (c.req.method == "POST")
        {
        const jsonData = await c.req.json();

        username = jsonData["username"];
        password = jsonData["password"];
       
        
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
       
            if (docSnap.data()["userStatus"] == accountUtil.UserStatus.Banned) {
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

            if (userSnap.data()["userStatus"] == accountUtil.UserStatus.Banned) {
                return c.json({
                    code: 403,
                    message: `User ${username} is banned.`
                }, 403);
            }

        }
        else if ((key == null && userId == null) || (username == null && password == null))
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 403);
        }

        await next();
    };
};

export const userAuth = UsernamePasswordMiddleware();
export const adminAuth = AdminMiddleware();
export const ratelimitAuth = RateLimitedMiddleware();