import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { DocumentSnapshot, Query, QueryDocumentSnapshot, collection, doc, getDoc, getDocs, query } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";
import { logger } from "../util.ts";
import { ratelimitAuth } from "../middleware.ts";
import * as accountUtil from "../accountUtil.ts";

export default async function() {
    const router = new Hono();

    router.get("/test", ratelimitAuth, async (c) => {
        return c.text("Not limited!");
    });

    router.get("/news/getRecentPost", async (c) => {
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
            else
            {
            }
        }, null);

        if (!success)
        {
            return c.json({code: 404, message: "No Posts found."}, 404);
        }


        return c.json({code: 200, message: "Success", id: idChosen, post: {content: retObject.data()["content"], title: retObject.data()["title"], photo: retObject.data()["photo"]}});
    });

    router.get("/news/:postId", async (c) => {
        const { postId } = c.req.param();

        const newsRef = doc(db, "news", postId);
        const newsSnap = await getDoc(newsRef);

        if (!newsSnap.exists())
        {
            return c.json({code: 404, message: `Post ${postId} not found.`}, 404);
        }

        return c.json({code: 200, message: "Success", post: {content: newsSnap.data()["content"], photo: newsSnap.data()["photo"], title: newsSnap.data()["title"]}});
    });

    

    router.get("/user/:userId", async (c) => {
        const { userId } = c.req.param();
        
        const username = await accountUtil.getUsernameFromUserID(userId);

        if (username == "")
        {
            return c.json({code: 404, message: `User ${userId} not found.`}, 404);
        }

        const userRef = doc(db, "user", username);
        const userSnap = await getDoc(userRef);

        const data = userSnap.data();

        return c.json({code: 200, message: "Success", username: username, id: userId, isAdmin: data["isAdmin"], betaTester: data["betaTester"], profilePhoto: data["profilePhoto"]}, 200);
    });

    router.get("/getUsers", ratelimitAuth, async (c) => {
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