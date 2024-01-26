import { DocumentReference, DocumentSnapshot, Query, QueryDocumentSnapshot, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "./database.ts";
import { logger } from "./util.ts";
import { HonoRequest } from "https://deno.land/x/hono@v3.8.1/mod.ts";

export async function getAccountDataFromID(userId:string):Promise<Object | undefined>
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

export async function getAccountPropertyFromKey(userId:string, key:string):Promise<any | undefined>
{
    const data = await getAccountDataFromID(userId);

    if (data != undefined)
    {
        return (data as any)[key];
    }

    return undefined;
}

export async function getRemoteAddr(c:HonoRequest)
{
    const raw:any = c.raw;
    const innerRequestSymbol = Object.getOwnPropertySymbols(raw).find(x => x.description === "request")!
    const innerRequest = raw[innerRequestSymbol];
    return innerRequest.remoteAddr;
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