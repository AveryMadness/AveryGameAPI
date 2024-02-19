import { accessToken } from "https://deno.land/x/access_token@1.0.0/mod.ts";
import { logger } from "./util.ts";
import { BufReader, readLines } from "https://deno.land/std@0.92.0/io/bufio.ts";
import { TextProtoReader } from "https://deno.land/std@0.92.0/textproto/mod.ts";
import { userAuth } from "./middleware.ts";
import { getUsernameFromUserID } from "./accountUtil.ts";
import { db } from "./db.ts";

export const tokens:Map<string, string> = new Map();

export async function generateToken(userId:string, force:boolean = false)
{
    const username = await getUsernameFromUserID(userId);

    if (username == "")
    {
        logger.info("username is nothing, returning new token")
        const tok = accessToken.generate("ags", userId);
        return tok;
    }

    const user = await db.
    selectFrom('users')
    .selectAll('users')
    .where('user_name', '=', username ?? "")
    .executeTakeFirst()

    if (!user)
    {
        return;
    }

    const token = user.user_token;

    if (!token || force)
    {
        const newToken = accessToken.generate("ags", userId);
        await db
        .updateTable('users')
        .set({
            user_token: newToken
        })
        .where('user_name', '=', 'username')
        .executeTakeFirst()

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
    let allLines:string = "";
    while (line = await tp.readLine())
    {
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
    const user = await db.
    selectFrom('users')
    .selectAll('users')
    .where('user_name', '=', username ?? "")
    .executeTakeFirst()
    
    if (!user)
    {
        return "";
    }

    return user.user_token;
}
