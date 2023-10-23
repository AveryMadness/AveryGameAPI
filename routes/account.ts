import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as hashLibrary from "../hashutil.ts"
import { logger } from "../util.ts";
import { db } from "../database.ts";
import { collection, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import * as accountUtil from "../accountUtil.ts"
import { keyAuth } from "../middleware.ts";
import * as token from "../token.ts";

export default async function() {
    const router = new Hono();

    router.post("/authenticateUserForBeta", keyAuth, async (c) => {
        const postData = await c.req.json();

        const username = postData["username"];

        const userExistsRef = doc(db, "user", username);
        const docSnap = await getDoc(userExistsRef);

        if (docSnap.exists())
        {
            const data = docSnap.data();
            if (data["betaTester"] == true || data["isAdmin"] == true)
            {
                c.status(200);
                const key = token.generateToken(data["id"]);
                return c.json({code: 200, message: "Success", key: key});
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

        const userExistsRef = doc(db, "user", username);
        const docSnap = await getDoc(userExistsRef);
        
        if (docSnap.exists())
        {
            const hash = docSnap.data()["password"];
            const validPass = await hashLibrary.checkHashedPassword(hash, password);

            if (validPass)
            {
                c.status(200);
                const key = token.generateToken(docSnap.data()["id"]);
                return c.json({code: 200, message: "Success", key: key});
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

        await setDoc(doc(usersRef, username), {
            id: id,
            password: hashPass,
            profilePhoto: profilePhoto,
            isAdmin: false,
            betaTester: false
        });

        await accountUtil.InitializeProfile(username);

        logger.info(`Created user for ${username} with id ${id}`);

        return c.json({code: 200, message: "Success"});
    });


    return router;
}