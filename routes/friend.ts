// deno-lint-ignore require-await
import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { userAuth } from "../middleware.ts";
import * as accountUtil from "../accountUtil.ts"
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "../database.ts";
//import { logger } from "../util.ts";
import { ServiceMiddleware } from "../middleware.ts";

export default async function() {
    const router = new Hono();

    router.get("/getFriends", ServiceMiddleware("getFriend"), async (c) => {
        const userId = c.req.query("user");
        const returnID = c.req.query("x");

        let _returnBool = true;

        if (!userId)
        {
            return c.json({code: 400, message: "Invalid query parameters."}, 400);
        }

        if (returnID != undefined)
        {
            _returnBool = Boolean(returnID);
        }

        const { success, friends } = await accountUtil.getFriendsFromUserID(userId);

        if (!success)
        {
            return c.json({code: 404, message: `User ${userId} not found.`});
        }

        return c.json({code: 200, message: "Success", friends: friends});
        
    });

    router.get("/isFriend", ServiceMiddleware("getFriend"), async (c) => {
        const user = c.req.query("user");
        const otherUser = c.req.query("otherUser");

        if (!user || !otherUser)
        {
            c.status(400);
            return c.text("Please enter a user and other user using query parameters.");
        }

        const username = await accountUtil.getUsernameFromUserID(user);
        const otherName = await accountUtil.getUsernameFromUserID(otherUser);

        if (username == "" || otherName == "")
        {
            c.status(404);
            return c.text("User not found.");
        }

        const userFriendRef = doc(db, "user", username, "friends", otherUser);
        const userFriendSnap = await getDoc(userFriendRef);
        const otherFriendRef = doc(db, "user", otherName, "friends", user);
        const otherFriendSnap = await getDoc(otherFriendRef);

        if (userFriendSnap.exists() && otherFriendSnap.exists())
        {
            if (userFriendSnap.data()["status"] == "ACCEPTED" && otherFriendSnap.data()["status"] == "ACCEPTED")
            {
                c.status(200);
                return c.text("True");
            }
            else
            {
                c.status(200);
                return c.text("False");
            }
        }
        else
        {
            c.status(200);
            return c.text("False");
        }
        

    });

    router.post("/removeFriend", ServiceMiddleware("addRemoveFriend"), userAuth, async (c) => {
        const postData = await c.req.json();

        const user = postData["user"];
        const otherUser = postData["otherUser"];

        if (!otherUser)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }

        const username = await accountUtil.getUsernameFromUserID(user);
        const otherName = await accountUtil.getUsernameFromUserID(otherUser);

        if (username == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${user} not found.`});
        }

        if (otherName == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${otherUser} not found.`});
        }

        const userExistsRef = doc(db, "user", username, "friends", otherUser);
        const userSnap = await getDoc(userExistsRef);

        if (userSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${username} is banned.`}, 403);
        }

        if (userSnap.exists())
        {
            if (userSnap.data()["status"] != "ACCEPTED")
            {
                c.status(400);
                return c.json({code: 400, message: "User is not friends, or friend request does not exist."});
            }
        }
        else
        {
            c.status(400);
            return c.json({code: 400, message: "Friend request does not exist."});
        }

        const recipientDoc = doc(db, "user", otherName, "friends", user);
        const recipientSnap = await getDoc(recipientDoc);

        if (recipientSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${otherName} is banned.`}, 403);
        }

        if (recipientSnap.exists())
        {
            if (recipientSnap.data()["status"] != "ACCEPTED")
            {
                c.status(400);
                return c.json({code: 400, message: "User is not friends, or friend request does not exist."});
            }
        }
        else
        {
            c.status(400);
            return c.json({code: 400, message: "Friend request does not exist."});
        }

        await deleteDoc(userExistsRef);
        await deleteDoc(recipientDoc);

        c.status(200);
        return c.json({code: 200, message: "Success"});

    });

    router.post("/denyRequest", ServiceMiddleware("acceptDenyFriendRequest"), userAuth, async (c) => {
        const postData = await c.req.json();

        const denyingUser = postData["user"];
        const deniee = postData["otherUser"];

        if (!deniee)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters"});
        }

        const username = await accountUtil.getUsernameFromUserID(denyingUser);
        const denieeName = await accountUtil.getUsernameFromUserID(deniee);

        if (username == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${denyingUser} not found.`});
        }

        if (denieeName == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${deniee} not found.`});
        }

        const userExistsRef = doc(db, "user", username, "friends", deniee);
        const userSnap = await getDoc(userExistsRef);

       

        if (userSnap.exists())
        {
            if (userSnap.data()["banned"])
            {
                return c.json({code: 403, message: `User ${username} is banned.`}, 403);
            }
            
            if (userSnap.data()["status"] == "ACCEPTED")
            {
                c.status(400);
                return c.json({code: 400, message: "User already friends, or friend request does not exist."});
            }
        }
        else
        {
            c.status(400);
            return c.json({code: 400, message: "Friend request does not exist."});
        }

        const recipientDoc = doc(db, "user", denieeName, "friends", denyingUser);
        const recipientSnap = await getDoc(recipientDoc);

        if (recipientSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${denieeName} is banned.`}, 403);
        }

        if (recipientSnap.exists())
        {
            if (recipientSnap.data()["status"] == "ACCEPTED")
            {
                c.status(400);
                return c.json({code: 400, message: "User already friends, or friend request does not exist."});
            }
        }
        else
        {
            c.status(400);
            return c.json({code: 400, message: "Friend request does not exist."});
        }

        await deleteDoc(userExistsRef);
        await deleteDoc(recipientDoc);

        c.status(200);
        return c.json({code: 200, message: "Success"});

    });

    router.post("/acceptRequest", ServiceMiddleware("acceptDenyFriendRequest"), userAuth, async (c) => {
        const postData = await c.req.json();

        const acceptingUser = postData["user"];
        const acceptee = postData["otherUser"];

        if (!acceptee)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }

        const username = await accountUtil.getUsernameFromUserID(acceptingUser);
        const accepteeName = await accountUtil.getUsernameFromUserID(acceptee);

        if (username == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${acceptingUser} not found.`});
        }

        if (accepteeName == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${acceptee} not found.`});
        }

        const userExistsRef = doc(db, "user", username, "friends", acceptee);
        const userSnap = await getDoc(userExistsRef);

       
        if (userSnap.exists())
        {
            if (userSnap.data()["banned"])
            {
                return c.json({code: 403, message: `User ${username} is banned.`}, 403);
            }

            if (userSnap.data()["status"] == "ACCEPTED")
            {
                c.status(400);
                return c.json({code: 400, message: "Friend request does not exist."});
            }

            if (userSnap.data()["status"] == "SENT")
            {
                c.status(400);
                return c.json({code: 400, message: `User ${username} can not accept friend request that they initiated.`});
            }
        }
        else
        {
            c.status(400);
            return c.json({code: 400, message: "Friend request does not exist."});
        }

        const recipientDoc = doc(db, "user", accepteeName, "friends", acceptingUser);
        const recipientSnap = await getDoc(recipientDoc);

        if (recipientSnap.data()["banned"])
        {
            return c.json({code: 403, message: `User ${accepteeName} is banned.`}, 403);
        }

        if (recipientSnap.exists())
        {
            if (recipientSnap.data()["status"] == "ACCEPTED")
            {
                c.status(400);
                return c.json({code: 400, message: "User already friends, or friend request does not exist."});
            }
        }
        else
        {
            c.status(400);
            return c.json({code: 400, message: "User already friends, or friend request does not exist."});
        }

        await updateDoc(userExistsRef, {
            status: "ACCEPTED"
        });

        await updateDoc(recipientDoc, {
            status: "ACCEPTED"
        });

        c.status(200);
        return c.json({code: 200, message: "Success"});

    });

    router.post("/sendRequest", ServiceMiddleware("addRemoveFriend"), userAuth, async (c) => {
        const postData = await c.req.json();

        const userId = postData["user"];
        const recipient = postData["otherUser"];

        if (!recipient)
        {
            c.status(400);
            return c.json({code: 400, message: "Invalid user parameters."});
        }

        const username = await accountUtil.getUsernameFromUserID(userId);
        const recipientName = await accountUtil.getUsernameFromUserID(recipient);
        
        if (recipientName == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${recipient} not found.`});
        }

        if (username == "")
        {
            c.status(404);
            return c.json({code: 404, message: `User for ID ${userId} not found.`});
        }

        const userExistsRef = doc(db, "user", username, "friends", recipient);

        const docSnap = await getDoc(userExistsRef);

        const data = docSnap.data();


        if ((docSnap.exists() && data["status"] != undefined) && (data["status"] == "SENT" || data["status"] == "PENDING" || data["status"] == "ACCEPTED"))
        {
            return c.json({code: 400, message: `User ${username} has an existing pending or accepted friend request to ${recipientName}`}, 400);
        }

        const recipientDoc = doc(db, "user", recipientName, "friends", userId);

        await setDoc(userExistsRef, {
            status: "SENT"
        });

        await setDoc(recipientDoc, {
            status: "PENDING"
        });

        c.status(200);
        return c.json({code: 200, message: "Success"});
        
    });

    return router;
}