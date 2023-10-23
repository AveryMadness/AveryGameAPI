import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { DocumentSnapshot, QueryDocumentSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";
import { logger } from "../util.ts";
import { ratelimitAuth } from "../middleware.ts";

export default async function() {
    const router = new Hono();

    router.get("/test", ratelimitAuth, async (c) => {
        return c.text("Not limited!");
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