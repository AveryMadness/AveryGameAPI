import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { DocumentSnapshot, Query, QueryDocumentSnapshot, collection, doc, getDoc, getDocs, query } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";
import { logger } from "../util.ts";
import { ratelimitAuth, userAuth } from "../middleware.ts";
import * as accountUtil from "../accountUtil.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
import {existsSync} from "https://deno.land/std@0.206.0/fs/mod.ts";
import { Md5, Message } from "https://deno.land/std@0.119.0/hash/md5.ts";
import { ServiceMiddleware } from "../middleware.ts";



async function getJson(filePath: string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}

export default async function() {
    const router = new Hono();

    router.get("/test", ratelimitAuth, async (c) => {
        return c.text("Not limited!");
    });

    router.get("/cloudstorage/:ini", ServiceMiddleware("cloudstorage"), async (c) => {
        const {ini} = c.req.param();

        if (existsSync(path.join(".", "cloudstorage", ini + ".ini")))
        {
            const data = await Deno.open(path.join(".", "cloudstorage", ini + ".ini"), {read: true});
            c.header("FileName", ini + ".ini");
            c.header("Content-Disposition", `attachment; filename="${ini}.ini"`);
            const md5 = new Md5();
            const newmd5 = md5.update(((await (await data.readable.getReader()).read()).value) ?? "");
            const hash = newmd5.toString("hex");
            c.header("FileHash", hash);
            const data2 = await Deno.open(path.join(".", "cloudstorage", ini + ".ini"), {read: true});
            return c.body(data2.readable, 200);
        }
        else
        {
            return c.json({code: 404, message: "cloudstorage file not found."}, 404);
        }
    });

    router.get("/pak/:pakid", ServiceMiddleware("pakfile"), userAuth, async (c) => {
        const {pakid} = c.req.param();
        const user = c.req.header("user") ?? "";

        const username = await accountUtil.getUsernameFromUserID(user);
        const userDoc = doc(db, "user", username);
        const userSnap = await getDoc(userDoc);

        let hasSig:boolean = false;

        if (!pakid)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        if (!existsSync(path.join(".", "data", "pak", `${pakid}`)))
        {
            return c.json({code: 404, message: `Pak ${pakid} does not exist.`}, 404);
        }

        if (existsSync(path.join(".", "data", "pak", `${pakid}`, `config.json`)))
        {
            const json = await getJson(path.join(".", "data", "pak", `${pakid}`, `config.json`));

            const permissions = json.permissions;

            if (permissions.admin && !userSnap.data()["isAdmin"])
                return c.json({code: 403, message: `Insufficient permissions for user ${username}`});

            if (permissions.betaTester && !userSnap.data()["betaTester"])
                return c.json({code: 403, message: `Insufficient permissions for user ${username}`});

            if (c.req.header("checkSign") == "true")
            {
                if (permissions.signed)
                {
                    if (!existsSync(path.join(".", "data", "pak", `${pakid}`, `${pakid}.sig`)))
                    {
                        return c.json({code: 404, message: `Sig ${pakid}.sig does not exist.`}, 404);
                    }

                    const data = await Deno.open(path.join(".", "data", "pak", `${pakid}`, `${pakid}.sig`), {read: true});
                    c.header("FileName", pakid + ".sig");
                    c.header("Content-Disposition", `attachment; filename="${pakid}.sig"`);
                    c.header("fileSign", "true");
                    const md5 = new Md5();
                    const newmd5 = md5.update(((await (await data.readable.getReader()).read()).value) ?? "");
                    const hash = newmd5.toString("hex");
                    c.header("FileHash", hash);
                    const data2 = await Deno.open(path.join(".", "data", "pak", `${pakid}`, `${pakid}.sig`), {read: true});
                    return c.body(data2.readable, 200);
                }
            }

            if (permissions.signed)
                hasSig = true;
        }
        else
        {
            logger.warn(`File ${path.join(".", "data", "pak", pakid, `config.json`)} does not exist.`);
        }

        if (!existsSync(path.join(".", "data", "pak", pakid, `${pakid}.pak`)))
        {
            return c.json({code: 404, message: `Pak ${pakid}.pak does not exist.`}, 404);
        }

        const data = await Deno.open(path.join(".", "data", "pak", pakid, `${pakid}.pak`), {read: true});
        c.header("FileName", pakid + ".pak");
        c.header("Content-Disposition", `attachment; filename="${pakid}.pak"`);
        c.header("fileSign", "false");
        c.header("hasSig", hasSig.toString());
        const md5 = new Md5();
        const newmd5 = md5.update(((await (await data.readable.getReader()).read()).value) ?? "");
        const hash = newmd5.toString("hex");
        c.header("FileHash", hash);
        const data2 = await Deno.open(path.join(".", "data", "pak", pakid, `${pakid}.pak`), {read: true});
        return c.body(data2.readable, 200);
    });

    router.get("/content/:contentId", ServiceMiddleware("contentPaths"), async (c) => {
        const { contentId } = c.req.param();

        if (!contentId)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        if (!existsSync(path.join(".", "data", `${contentId}.json`)))
        {
            return c.json({code: 404, message: `Content path ${contentId} not found.`}, 404);
        }

        const json = await getJson(path.join(".", "data", `${contentId}.json`));
        if (!json.contentPage)
        {
            return c.json({code: 404, message: `Content path ${contentId} does not contain content.`});
        }

        return c.json({code: 200, message: "Success", content: json}, 200);
    });

    router.get("/flags/getFlags", async (c) => {
        const flagsRef = collection(db, "flags");
        const flags = await getDocs(flagsRef);

        const retFlags:string[] = [];
        await flags.forEach(async (doc:DocumentSnapshot) => {
            retFlags.push(doc.id);
        }, null);

        if (retFlags.length <= 0)
        {
            return c.json({code: 500, message: "Failed to retrieve flags."}, 500);
        }

        return c.json({code: 200, message: "Success", flags: retFlags}, 200);
    });

    router.get("/flags/:flagId", ServiceMiddleware("getEventFlag"), async (c) => {
        const { flagId } = c.req.param();

        if (!flagId)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const flagRef = doc(db, "flags", flagId);
        const flagSnap = await getDoc(flagRef);

        if (!flagSnap.exists())
        {
            return c.json({code: 404, message: `Flag ${flagId} not found.`}, 404);
        }

        return c.json({code: 200, message: "Success", value: flagSnap.data()["value"]}, 200);
    });

    router.get("/news/getRecentPost", ServiceMiddleware("getNewsPost"), async (c) => {
        const q = query(collection(db, "news"));

        let retObject:QueryDocumentSnapshot = new QueryDocumentSnapshot();
        let mostRecentDate:Date = new Date(628021800000);
        let success:Boolean = false;
        let idChosen:string = "";

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc:QueryDocumentSnapshot) => {
            const dateToCompare = new Date(parseInt(doc.data()["createdOn"]));
            if (dateToCompare > mostRecentDate)
            {
                success = true;
                retObject = doc;
                mostRecentDate = new Date(parseInt(doc.data()["createdOn"]));
                idChosen = doc.id;
            }
        }, null);

        if (!success)
        {
            return c.json({code: 404, message: "No Posts found."}, 404);
        }


        return c.json({code: 200, message: "Success", id: idChosen, post: {content: retObject.data()["content"], title: retObject.data()["title"], photo: retObject.data()["photo"], author: retObject.data()["author"]}});
    });

    router.get("/news/:postId", ServiceMiddleware("getNewsPost"), async (c) => {
        const { postId } = c.req.param();

        const newsRef = doc(db, "news", postId);
        const newsSnap = await getDoc(newsRef);

        if (!newsSnap.exists())
        {
            return c.json({code: 404, message: `Post ${postId} not found.`}, 404);
        }

        return c.json({code: 200, message: "Success", post: {content: newsSnap.data()["content"], photo: newsSnap.data()["photo"], title: newsSnap.data()["title"], author: newsSnap.data()["author"]}});
    });

    

    router.get("/user/:userId", ServiceMiddleware("getUser"), async (c) => {
        const { userId } = c.req.param();
        
        let username = await accountUtil.getUsernameFromUserID(userId);

        if (username == "")
        {
            username = userId;
            const userRef = doc(db, "user", username);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists())
                return c.json({code: 404, message: `User ${userId} not found.`}, 404);
        }

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        const data = userSnap.data();

        return c.json({code: 200, message: "Success", username: username, id: data["id"], banned: data["banned"], isAdmin: data["isAdmin"], betaTester: data["betaTester"], profilePhoto: data["profilePhoto"], MtxCurrency: data["MtxCurrency"] ?? 0}, 200);
    });

    router.get("/getUsers", ServiceMiddleware("getUser"), ratelimitAuth, async (c) => {
        const count = c.req.query("c");
        const startAt = c.req.query("s");
        let users:any[] = [];
        const usersCollection = collection(db, "user");
        
        const actualCount = Number(count);
        const actualStartAt = Number(startAt);

        const snapShot = await getDocs(usersCollection);
        snapShot.forEach((doc:DocumentSnapshot) => {
            const data = doc.data();
            users.push({username: doc.id, id: data["id"], admin: data["isAdmin"],
            betaTester: data["betaTester"], banned: data["banned"],
            profilePhoto: data["profilePhoto"], friends: data["friends"]});

        }, null);

        

        if (actualStartAt > 0)
        {
            users = users.splice(actualStartAt, users.length);
        }

        const moreLeft = actualCount < users.length;

        if (actualCount > 0)
        {
            users = users.slice(0, actualCount);
        }

        return c.json({users: users, more: moreLeft}, 200);
    });
    
    return router;
}