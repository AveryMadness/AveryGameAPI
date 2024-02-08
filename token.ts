import { accessToken } from "https://deno.land/x/access_token@1.0.0/mod.ts";
//import { logger } from "./util.ts";
import { BufReader } from "https://deno.land/std@0.92.0/io/bufio.ts";
import { TextProtoReader } from "https://deno.land/std@0.92.0/textproto/mod.ts";
//import { userAuth } from "./middleware.ts";
import { getUsernameFromUserID } from "./accountUtil.ts";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { db } from "./database.ts";

export const tokens:Map<string, string> = new Map();

export async function generateToken(userId:string, force = false)
{
    const username = await getUsernameFromUserID(userId);

    if (username == "")
    {
        const tok = accessToken.generate("ags", userId);
        return tok;
    }

    const userRef = doc(db, "user", username);
    const userSnap = await getDoc(userRef);

    const token = userSnap.data()["key"];

    if (!token || force)
    {
        const newToken = accessToken.generate("ags", userId);
        updateDoc(userRef, {
            token: newToken
        });

        return newToken;
    }

    return token;
}

export async function invalidateToken(token:string)
{
    if (tokens.has(token))
    {
        tokens.delete(token);
    }

    const tp = new TextProtoReader( new 
        BufReader(await Deno.open('permenantKeys.txt', { read: true})));
        
    let line;
    let allLines = "";
    while (true)
    { 
        line = await tp.readLine();
        if (!line)
            break;
        const keyandid = line.split(";");
        const key = keyandid[0];
            
        if (key != token)
        {
            allLines += line + "\n";
        }
    }

    allLines = allLines.trim();


    await Deno.writeFile('permenantKeys.txt', new TextEncoder().encode(allLines));
}

export async function getTokenFromUserId(userId:string):Promise<string>
{
    
    const username = await getUsernameFromUserID(userId);
    const userRef = doc(db, "user", username);
    const userSnap = getDoc(userRef);
    
    return (await userSnap).data()["key"];
}
