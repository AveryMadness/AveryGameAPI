import { accessToken } from "https://deno.land/x/access_token@1.0.0/mod.ts";
import { logger } from "./util.ts";
import { BufReader, readLines } from "https://deno.land/std@0.92.0/io/bufio.ts";
import { TextProtoReader } from "https://deno.land/std@0.92.0/textproto/mod.ts";
import { keyAuth } from "./middleware.ts";

export const tokens:Map<string, string> = new Map();

export async function generateToken(userId:string, expire:boolean = true)
{

    const existingToken = getTokenFromUserId(userId);
    if (existingToken != "")
    {
        await invalidateToken(existingToken);
    }

    const token = accessToken.generate("ags", userId);
    
    tokens.set(token, userId);
    if (expire)
        setTimeout(() => invalidateToken(token), parseInt(Deno.env.get("TOKEN_LIFESPAN") ?? "180") * 1000);
    else
    {
        const file = Deno.readFileSync('permenantKeys.txt');
        const textDecoder = new TextDecoder();
        let fileStr = textDecoder.decode(file);

        fileStr += "\n" + token + ";" + userId;

        const textEncoder = new TextEncoder();
        const fileToWrite = textEncoder.encode(fileStr);

        Deno.writeFileSync('permenantKeys.txt', fileToWrite);
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

export function getTokenFromUserId(userId:string)
{
    let retVal = "";
    tokens.forEach((id, token) => 
    {
        if (id == userId)
            retVal = token;
    });

    return retVal;
}
