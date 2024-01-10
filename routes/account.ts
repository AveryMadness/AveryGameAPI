import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as hashLibrary from "../hashutil.ts"
import { logger } from "../util.ts";
import { db } from "../database.ts";
import { collection, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import * as accountUtil from "../accountUtil.ts"
import { keyAuth, adminAuth, adminKeyAuth, userpassAuth } from "../middleware.ts";
import * as token from "../token.ts";

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
    router.post("/incrementBanWarningCounter", keyAuth, async (c) => {
        const postData = await c.req.json();
        let key = postData.key;
        const userId = key.split(banWarnCounterKey)[1];
        key = key.split(userId)[0];

        if (key != banWarnCounterKey)
        {
            return c.json({code: 403, message: "Invalid authentication."}, 403);
        }

        const username = await accountUtil.getUsernameFromUserID(userId);
        if (username == "")
        {
            return c.json({code: 403, message: "Invalid authentication."}, 403);
        }

        if (userId != postData.user)
        {
            return c.json({code: 403, message: "Invalid authentication."}, 403);
        }

        const severity = postData.severity;
        const userDoc = doc(db, "user", username);
        const userSnap = await getDoc(userDoc);
        const warns:number = userSnap.data()["warns"] ?? 0;

        if (warns + severity >= 10)
        {
            await updateDoc(userDoc, {
                banned: true,
                warns: 10
            });
            return c.json({code: 200, message: "Success", bHasBanned: true}, 200);
        }
        else
        {
            await updateDoc(userDoc, {
                warns: warns + severity,
            });
            return c.json({code: 200, message: "Success", bHasBanned: false}, 200);
        }

    });

    router.post("/authenticateAdmin", adminAuth, async (c) => {
        const postData = await c.req.json();
        const username = postData["username"];

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        const userId = userSnap.data()["id"];
        const key = await token.generateToken(userId);
        return c.json({code: 200, message: "Success", key: key, userId: userId}, 200);
    });

    router.get("/game/getItem", async (c) => {

    });

    router.get("/status/:userid", async (c) => {
        const { userid } = c.req.param();

        const username = await accountUtil.getUsernameFromUserID(userid);

        if (!username || !userid)
        {
            return c.json({code: 400, message: "Invalid user parameters"}, 400);
        }

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        let status = await userSnap.data()["status"];

        if (isNaN(status) || status > 3 || status < 0)
        {
            status = -1;
        }

        return c.json({code: 200, message: "Success", status: status}, 200);
    });

    router.post("/setUserStatus", keyAuth, async (c) => {
        const postData = await c.req.json();
        const userId = postData["user"];
        const status = postData["status"];

        if (isNaN(status) || status > 3 || status < 0)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const username = await accountUtil.getUsernameFromUserID(userId);

        const userRef = doc(db, "user", username);
        
        await updateDoc(userRef, {
            status: status,
        });

        return c.json({code: 200, message: "Success"});
    });

    router.post("/authenticateAuthKey", async (c) => {
        const postData = await c.req.json();
        const userId = postData["user"];
        const key = postData["key"];

        const tok = await token.getTokenFromUserId(userId);

        if (!tok)
        {
            return c.json({code: 403, message: "Unauthorized"}, 403);
        }

        return c.json({code: 200, message: "Success"}, 200);
    });

    router.post("/authenticateAdminKey", adminKeyAuth, async (c) => {
        const postData = await c.req.json();
        const userId = postData["user"];
        const key = await token.generateToken(userId);
        return c.json({code: 200, message: "Success", key: key, userId: userId}, 200);
    });

    router.get("getMtxCurrency", keyAuth, async (c) => {
        const user = await c.req.header("user") || "";

        const username = await accountUtil.getUsernameFromUserID(user);

        if (!username)
        {
            c.json({code: 404, message: `User ${user} not found.`}, 404);
        }

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        let MtxCurrency:Number = 0;

        MtxCurrency = userSnap.data()["MtxCurrency"];

        return c.json({code: 200, message: "Success", mtx: MtxCurrency ?? 0});
    });

    router.get("getPermission", async (c) => {
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

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists())
        {
            return c.json({code: 404, message: `User ${username} not found.`}, 404);
        }

        return c.json({code: 200, message: "Success", hasPermission: userSnap.data()["betaTester"] || userSnap.data()["isAdmin"]}, 200);
    });

    router.post("/authenticateUserForBeta", keyAuth, async (c) => {
        const postData = await c.req.json();

        const username = postData["username"];

        const userExistsRef = doc(db, "user", username);
        const docSnap = await getDoc(userExistsRef);

        if (docSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${username} is banned.`}, 403);
        }

        if (docSnap.exists())
        {
            const data = docSnap.data();
            if (data["betaTester"] == true || data["isAdmin"] == true)
            {
                c.status(200);
                const key = await token.generateToken(data["id"]);
                return c.json({code: 200, message: "Success", key: key, userId: data["id"]});
            }
            else
            {
                c.status(403);
                return c.json({code: 403, message: "User not authorized for beta."});
            }
        }

        c.status(500);
        return c.json({code: 500, message: "Internal profile error."});
    });

    router.post("/authenticateUser", async (c) => {
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

        const userExistsRef = doc(db, "user", username);
        const docSnap = await getDoc(userExistsRef);

        if (!docSnap.exists())
        {
            return c.json({code: 404, message: `User ${username} not found.`}, 404);
        }

        if (docSnap.data()["banned"] != null)
        {
            if (docSnap.data()["banned"])
                return c.json({code: 403, message: `User ${username} is banned.`}, 403);
        }
        
        if (docSnap.exists())
        {
            const hash = docSnap.data()["password"];
            const validPass = await hashLibrary.checkHashedPassword(hash, password);

            if (validPass)
            {
                const useragent = c.req.header("User-Agent");
                let shouldKeyExpire = true;
                if (useragent?.includes("AveryGame/"))
                    shouldKeyExpire = false;
                c.status(200);
                const key = await token.generateToken(docSnap.data()["id"]);
                return c.json({code: 200, message: "Success", key: key, userId: docSnap.data()["id"]});
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

    router.post("/createUser", async (c) => {
        const postData = await c.req.json();

        const username = postData["username"];
        const password = postData["password"];
        const profilePhoto = postData["profilePhoto"];

        if (username == null || password == null || profilePhoto == null)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }


        const id = Date.now().toString();
        
        logger.info(`Creating user for ${username} with id ${id}`);

        const usersRef = collection(db, "user");
        const userExistsRef = doc(db, "user", username);
        const docSnap = await getDoc(userExistsRef);
        
        if (docSnap.exists())
        {
            logger.warn(`Could not create user for ${username}, user already exists.`);
            c.status(403);
            return c.json({code: 403, message: `User ${username} already exists.`});
        }

        const hashPass = await hashLibrary.hashPassword(password);
        const key = await token.getTokenFromUserId(id);

        await setDoc(doc(usersRef, username), {
            id: id,
            password: hashPass,
            profilePhoto: profilePhoto,
            isAdmin: false,
            betaTester: false,
            banned: false,
            token: key,
            MtxCurrency: 0
        });

        await accountUtil.InitializeProfile(username);

        logger.info(`Created user for ${username} with id ${id}`);

        return c.json({code: 200, message: "Success", userId: id});
    });


    return router;
}