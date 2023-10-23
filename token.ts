import { accessToken } from "https://deno.land/x/access_token@1.0.0/mod.ts";
import { logger } from "./util.ts";

export const tokens:Map<string, string> = new Map();

export function generateToken(userId:string)
{

    const existingToken = getTokenFromUserId(userId);
    if (existingToken != "")
    {
        logger.info(`Invalidating token ${existingToken}, new token was requested.`);
        invalidateToken(existingToken);
    }

    const token = accessToken.generate("ags", userId);
    
    tokens.set(token, userId);
    setTimeout(() => invalidateToken(token), parseInt(Deno.env.get("TOKEN_LIFESPAN") ?? "180") * 1000);
    return token;
}

export function invalidateToken(token:string)
{
    if (tokens.has(token))
    {
        tokens.delete(token);
        logger.info(`Invalidated token ${token}`);
    }
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
