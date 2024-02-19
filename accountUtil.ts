import { logger } from "./util.ts";
import { HonoRequest } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import * as token from "./token.ts"
import * as account from "./routes/account.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/smtp.ts";
import {db} from "./db.ts"

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
        const json = await req.json();
        return true;
    }
    catch
    {
        return false;
    }
}

export async function acceptPendingUser(username:string, email:string, password:string):Promise<boolean>
{
     
            const existingUser = await db
            .selectFrom('users')
            .selectAll('users')
            .where('user_name', '=', username)
            .executeTakeFirst();

            if (existingUser) {
                logger.info("user already exists, ret false");
                return false;
            }

            const existingPendingUser = await db
            .selectFrom('pending_users')
            .selectAll('pending_users')
            .where('user_name', '=', username)
            .executeTakeFirst();

            if (!existingPendingUser) {
                logger.info("pending user doesnt exist, ret false")
                return false;
            }

            const id = Date.now();
            const key = await token.generateToken(id.toString());
            if (!key)
            {
                logger.info("failed to gen key, ret false")
                return false;
            }

            await db
            .insertInto('users')
            .values({
                user_name: username,
                user_mtx: 0,
                user_id: id.toString(),
                user_token: key,
                user_password: password,
                user_role: UserRole.User,
                user_status: UserStatus.Verified,
                user_warnings: 0
            })
            .executeTakeFirst()

           await db
           .deleteFrom('pending_users')
           .where('user_name', '=', username)
           .executeTakeFirst()
       
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
    const raw:any = c.raw;
    const innerRequestSymbol = Object.getOwnPropertySymbols(raw).find(x => x.description === "request")!
    const innerRequest = raw[innerRequestSymbol];
    return innerRequest.remoteAddr;
}

export async function getUsernameFromUserID(userId:string)
{
    const username = await db
    .selectFrom('users')
    .select('user_name')
    .where('user_id', '=', userId)
    .executeTakeFirst();

    if (!username)
    {
        return "";
    }

    return username.user_name;
}

export async function unequipWeaponOfType(type:string, username:string)
{
    try {
    const userId = await db.
    selectFrom('users')
    .select('user_id')
    .where('user_name', '=', username)
    .executeTakeFirst();

    if (!userId)
    {
        return;
    }

    await db
    .updateTable('inventory')
    .set({
        item_equipped: false
    })
    .where('item_owner_id', '=', userId.user_id)
    .where('item_type', '=', type)
    .executeTakeFirst()
}
catch (e)
{
    logger.error(e);
}
}