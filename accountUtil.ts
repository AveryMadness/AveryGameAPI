// deno-lint-ignore require-await

import {DocumentSnapshot, _Query, QueryDocumentSnapshot, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "./database.ts";
import { logger } from "./util.ts";
import { HonoRequest } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as token from "./token.ts"
//import * as account from "./routes/account.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/smtp.ts";

export enum UserRole
{
    User = 100,
    BetaTester = 200,
    Administrator = 300
}

export enum UserStatus
{
    Banned = 100,
    Unverified = 200,
    Verified = 300
}

export async function HasValidJson(req:HonoRequest):Promise<boolean>
{
    try
    {
        const _json = await req.json();
        return true;
    }
    catch
    {
        return false;
    }
}

export async function getAccountDataFromID(userId:string):Promise<object | undefined>
{
    const q = query(collection(db, "user"), where("id", "==", userId));

    let retVal = undefined;
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc:QueryDocumentSnapshot) => {
        // doc.data() is never undefined for query doc snapshots
        retVal = doc.data();
    }, null);

    return retVal;
}

export async function getAccountPropertyFromKey(userId:string, key:string):Promise<object | undefined>
{
    const data = await getAccountDataFromID(userId);

    if (data != undefined)
    {
        return (data as object)[key];
    }

    return undefined;
}

export async function acceptPendingUser(username:string, email:string, password:string):Promise<boolean>
{
    const asdasdasdasdasdasd = doc(db, "user", username);
            const snapasdasdasdasd = await getDoc(asdasdasdasdasdasd);
            if (snapasdasdasdasd.exists()) {
                return false;
            }
            const id = Date.now();
            const key = await token.generateToken(id.toString());
            await setDoc(asdasdasdasdasdasd, {
                id: id.toString(),
                role: UserRole.User,
                userStatus: UserStatus.Verified,
                password: password,
                MtxCurrency: 0,
                key: key
            });

            await deleteDoc(doc(db, "pendingUsers", username));
       
            const client2 = new SmtpClient();
       
            await client2.connectTLS({
                hostname: "smtp.gmail.com",
                port: 465,
                username: "averymadness62@gmail.com",
                password: Deno.env.get("SMTP_PASS")
            });
       
            await client2.send({
                from: "averymadness62@gmail.com",
                to: email,
                subject: "Avery Game user submission",
                content: "Your Avery Game user submission has been accepted. Welcome, " + username + "!"
            });
       
            await client2.close();

            return true;
}

export async function getRemoteAddr(c:HonoRequest)
{
    /*const raw:any = c.raw;
    const innerRequestSymbol = Object.getOwnPropertySymbols(raw).find(x => x.description === "request")!
    const innerRequest = raw[innerRequestSymbol];
    return innerRequest.remoteAddr;*/
}

export async function getUsernameFromUserID(userId:string)
{
    const q = query(collection(db, "user"), where("id", "==", userId));
    let retVal = "";

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc:QueryDocumentSnapshot) => {
        retVal = doc.id;
    }, null);

    return retVal;
}

export async function unequipWeaponOfType(type:string, username:string)
{
    try {
    const q = query(collection(db, "user", username, "inventory"), where("ItemType", "==", type));

    const querySnapshot = await getDocs(q);
    await querySnapshot.forEach(async (doc:QueryDocumentSnapshot) => {
        await updateDoc(doc, {
            IsEquipped: false
        });
    }, null);
}
catch (e)
{
    logger.error(e);
}
}

export async function getFriendsFromUserID(userId:string) 
{
    const username = await getUsernameFromUserID(userId);

    if (username == "")
    {
        return {success: false, friends: []};
    }

    const q = collection(db, "user", username, "friends");
    const retVal:object[] = [];

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc:DocumentSnapshot) => {
        retVal.push({id: doc.id, pending: doc.data()["status"] == "PENDING", sbna: doc.data()["status"] == "SENT"});
    }, null);

    return {success: true, friends: retVal};
}

export async function isUserBetaVerified(userId:string):Promise<boolean>
{
    const username = await getUsernameFromUserID(userId);
    const userExistsRef = doc(db, "user", username);
    const docSnap = await getDoc(userExistsRef);

    if (docSnap.exists())
    {
        const data = docSnap.data();
        if (data["betaTester"] == true)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    return false;
}

export async function isUserBetaVerifiedUsername(username:string):Promise<boolean>
{
    const userExistsRef = doc(db, "user", username);
    const docSnap = await getDoc(userExistsRef);

    if (docSnap.exists())
    {
        const data = docSnap.data();
        if (data["betaTester"] == true)
        {
            return true;
        }
        else
        {
            return false;
        }
    }
    
    return false;
}

export async function validateUserFromID(userId:string, username:string):Promise<boolean>
{
    const userExitsRef = doc(db, "user", username);
    const docSnap = await getDoc(userExitsRef);

    if (!docSnap.exists())
    {
        return false;
    }

    const data = await docSnap.data();

    if (data["id"] == userId)
    {
        return true;
    }

    return false;
}

export async function InitializeInventory(username:string)
{
    await setDoc(doc(db, "user", username, "inventory", "W_C_Rifle"), {
        count: 1
    }); 
}

export async function InitializeFriends(username:string)
{
    await setDoc(doc(db, "user", username, "friends"), {});
}

export async function InitializeProfile(username:string)
{
    await InitializeInventory(username);
    //await InitializeFriends(username);
}