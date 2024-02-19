import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { db } from "../db.ts";
import { logger } from "../util.ts";
import { ratelimitAuth, userAuth } from "../middleware.ts";
import * as accountUtil from "../accountUtil.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
import {existsSync} from "https://deno.land/std@0.206.0/fs/mod.ts";
import { Md5, Message } from "https://deno.land/std@0.119.0/hash/md5.ts";
import { ServiceMiddleware } from "../middleware.ts";
import * as fs from "https://deno.land/std@0.122.0/node/fs.ts";
import { UserStatus } from "./account.ts";



export async function getJson(filePath: string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}

export default async function() {
    const router = new Hono();

    router.get("/manifest/:key", async (c) => {
        let {key} = c.req.param();
        if (!key) key = "avery-game";

        const locale = (c.req.header("Accept-Language") ?? "").split(",")[0];
        const playlists = await getJson(path.join(".", "data", "featured.json"));
        const services = await getJson(path.join(".", "data", "services.json"));
        const versions = await getJson(path.join(".", "data", "version.json"));

        let latestModifiedDate = new Date();
        const playlistStat = fs.statSync(path.join(".", "data", "featured.json"));
        const playlistDate = new Date(playlistStat.mtimeMs ?? 0);
        if (playlistDate > latestModifiedDate)
            latestModifiedDate = playlistDate;

        const servicesStat = fs.statSync(path.join(".", "data", "services.json"));
        const servicesDate = new Date(servicesStat.mtimeMs ?? 0);
        if (servicesDate > latestModifiedDate)
            latestModifiedDate = servicesDate;

        const versionsStat = fs.statSync(path.join(".", "data", "version.json"));
        const versionsDate = new Date(versionsStat.mtimeMs ?? 0);
        if (versionsDate > latestModifiedDate)
            latestModifiedDate = versionsDate;


        if (key == "avery-game")
        {
            const manifest = {
                _title: "Avery Game",
                _activeDate: new Date(fs.statSync(path.join(".", "main.ts")).birthtimeMs ?? 0).toISOString(),
                lastModified: latestModifiedDate.toISOString(),
                _locale: locale,
                _templateName: key,
                playlist: {
                    playlists: playlists.featured.playlists,
                    _title: "Playlists",
                    _activeDate: new Date(playlistStat.birthtime ?? 0).toISOString(),
                    lastModified: playlistDate.toISOString(),
                    _locale: locale,
                    _templateName: "Playlists"
                },
                content: {
                    content: playlists.featured.contentPacks,
                    _title: "Content",
                    _activeDate: new Date(playlistStat.birthtime ?? 0).toISOString(),
                    lastModified: playlistDate.toISOString(),
                    _locale: locale,
                    _templateName: "Content"
                },
                services: {
                    services: services,
                    _title: "Services",
                    _activeDate: new Date(servicesStat.birthtime ?? 0).toISOString(),
                    lastModified: servicesDate.toISOString(),
                    _locale: locale,
                    _templateName: "Services"
                },
                versions: {
                    versions: versions,
                    _title: "Versions",
                    _activeDate: new Date(versionsStat.ctimeMs ?? 0).toISOString(),
                    lastModified: versionsDate.toISOString(),
                    _locale: locale,
                    _templateName: "Versions"
                }
              };

              return c.json({code: 200, message: "Success", manifest: manifest});
        }
        
        return c.json({code: 404, message: `Key ${key} not found.`}, 404);
        
    });

    router.get("/cloudstorage/:ini", ServiceMiddleware("cloudstorage"), async (c) => {
        const {ini} = c.req.param();

        if (existsSync(path.join(".", "cloudstorage", ini + ".ini")))
        {
            const data = await Deno.open(path.join(".", "cloudstorage", ini + ".ini"), {read: true});
            c.header("FileName", ini + ".ini");
            c.header("Content-Disposition", `attachment; filename="${ini}.ini"`);
            const md5 = new Md5();
            const newmd5 = md5.update(((await (await data.readable.getReader()).read()).value) ?? "");
            const hash = newmd5.toString("hex");
            c.header("FileHash", hash);
            const data2 = await Deno.open(path.join(".", "cloudstorage", ini + ".ini"), {read: true});
            return c.body(data2.readable, 200);
        }
        else
        {
            return c.json({code: 404, message: "cloudstorage file not found."}, 404);
        }
    });

    router.get("/pak/:pakid", ServiceMiddleware("pakfile"), userAuth, async (c) => {
        const {pakid} = c.req.param();
        const user = c.req.header("user") ?? "";

        const username = await accountUtil.getUsernameFromUserID(user);
       
        const userObj = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst();

        if (!userObj)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        let hasSig:boolean = false;

        if (!pakid)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        if (!existsSync(path.join(".", "data", "pak", `${pakid}`)))
        {
            return c.json({code: 404, message: `Pak ${pakid} does not exist.`}, 404);
        }

        if (existsSync(path.join(".", "data", "pak", `${pakid}`, `config.json`)))
        {
            const json = await getJson(path.join(".", "data", "pak", `${pakid}`, `config.json`));

            const permissions = json.permissions;

            if (permissions.admin && userObj.user_role < accountUtil.UserRole.Administrator)
                return c.json({code: 403, message: `Insufficient permissions for user ${username}`});

            if (permissions.betaTester && userObj.user_role < accountUtil.UserRole.BetaTester)
                return c.json({code: 403, message: `Insufficient permissions for user ${username}`});

            if (c.req.header("checkSign") == "true")
            {
                if (permissions.signed)
                {
                    if (!existsSync(path.join(".", "data", "pak", `${pakid}`, `${pakid}.sig`)))
                    {
                        return c.json({code: 404, message: `Sig ${pakid}.sig does not exist.`}, 404);
                    }

                    const data = await Deno.open(path.join(".", "data", "pak", `${pakid}`, `${pakid}.sig`), {read: true});
                    c.header("FileName", pakid + ".sig");
                    c.header("Content-Disposition", `attachment; filename="${pakid}.sig"`);
                    c.header("fileSign", "true");
                    const md5 = new Md5();
                    const newmd5 = md5.update(((await (await data.readable.getReader()).read()).value) ?? "");
                    const hash = newmd5.toString("hex");
                    c.header("FileHash", hash);
                    const data2 = await Deno.open(path.join(".", "data", "pak", `${pakid}`, `${pakid}.sig`), {read: true});
                    return c.body(data2.readable, 200);
                }
            }

            if (permissions.signed)
                hasSig = true;
        }
        else
        {
            logger.warn(`File ${path.join(".", "data", "pak", pakid, `config.json`)} does not exist.`);
        }

        if (!existsSync(path.join(".", "data", "pak", pakid, `${pakid}.pak`)))
        {
            return c.json({code: 404, message: `Pak ${pakid}.pak does not exist.`}, 404);
        }

        const data = await Deno.open(path.join(".", "data", "pak", pakid, `${pakid}.pak`), {read: true});
        c.header("FileName", pakid + ".pak");
        c.header("Content-Disposition", `attachment; filename="${pakid}.pak"`);
        c.header("fileSign", "false");
        c.header("hasSig", hasSig.toString());
        const md5 = new Md5();
        const newmd5 = md5.update(((await (await data.readable.getReader()).read()).value) ?? "");
        const hash = newmd5.toString("hex");
        c.header("FileHash", hash);
        const data2 = await Deno.open(path.join(".", "data", "pak", pakid, `${pakid}.pak`), {read: true});
        return c.body(data2.readable, 200);
    });

    router.get("/content/:contentId", ServiceMiddleware("contentPaths"), async (c) => {
        const { contentId } = c.req.param();

        if (!contentId)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        if (!existsSync(path.join(".", "data", `${contentId}.json`)))
        {
            return c.json({code: 404, message: `Content path ${contentId} not found.`}, 404);
        }

        const json = await getJson(path.join(".", "data", `${contentId}.json`));
        if (!json.contentPage)
        {
            return c.json({code: 404, message: `Content path ${contentId} does not contain content.`});
        }

        return c.json({code: 200, message: "Success", content: json}, 200);
    });

    router.get("/flags/getFlags", async (c) => {
        const retFlags = await db
        .selectFrom('flags')
        .selectAll('flags')
        .execute();

        if (retFlags.length < 0)
        {
            return c.json({code: 500, message: "Failed to retrieve flags."}, 500);
        }

        return c.json({code: 200, message: "Success", flags: retFlags}, 200);
    });

    router.get("/flags/:flagId", ServiceMiddleware("getEventFlag"), async (c) => {
        const { flagId } = c.req.param();

        if (!flagId)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        const flag = await db
        .selectFrom('flags')
        .selectAll('flags')
        .where('flag_id', '=', flagId ?? "")
        .executeTakeFirst();

        if (!flag)
        {
            return c.json({code: 404, message: "Flag not found."}, 404);
        }

        return c.json({code: 200, message: "Success", value: flag.flag_value}, 200);
    });

    router.get("/news/:postId", ServiceMiddleware("getNewsPost"), async (c) => {
        const { postId } = c.req.param();

        const post = await db
        .selectFrom('news')
        .selectAll('news')
        .where('news_id', '=', postId ?? "")
        .executeTakeFirst();

        if (!post)
        {
            return c.json({code: 404, message: `Post ${postId} not found.`}, 404);
        }

        return c.json({code: 200, message: "Success", post: {content: post.news_content, photo: post.news_icon, title: post.news_title, author: post.news_author}});
    });

    

    router.get("/user/:userId", ServiceMiddleware("getUser"), async (c) => {
        const { userId } = c.req.param();
        
        let username = await accountUtil.getUsernameFromUserID(userId);

        if (username == "")
        {
            username = userId;
            const userFromId = await db
            .selectFrom('users')
            .selectAll('users')
            .where('user_id', '=', username ?? "")
            .executeTakeFirst();
            if (!userFromId)
                return c.json({code: 404, message: `User ${userId} not found.`}, 404);
            else
            {
                return c.json({code: 200, message: "Success", username: userFromId.user_name, id: userFromId.user_id, banned: userFromId.user_status == accountUtil.UserStatus.Banned, isAdmin: userFromId.user_role > accountUtil.UserRole.BetaTester, betaTester: userFromId.user_role > accountUtil.UserRole.User, profilePhoto: "DEPRECATED", MtxCurrency: userFromId.user_mtx ?? 0}, 200);
            }

        }

        const user = await db
        .selectFrom('users')
        .selectAll('users')
        .where('user_name', '=', username ?? "")
        .executeTakeFirst();

        if (!user)
        {
            return c.json({code: 404, message: "User not found."}, 404);
        }

        return c.json({code: 200, message: "Success", username: user.user_name, id: user.user_id, banned: user.user_status == accountUtil.UserStatus.Banned, isAdmin: user.user_role > accountUtil.UserRole.BetaTester, betaTester: user.user_role > accountUtil.UserRole.User, profilePhoto: "DEPRECATED", MtxCurrency: user.user_mtx ?? 0}, 200);
    });

    router.get("/getUsers", ServiceMiddleware("getUser"), ratelimitAuth, async (c) => {
        const count = c.req.query("c");
        const startAt = c.req.query("s");
        let users:any[] = [];

        const actualCount = Number(count);
        const actualStartAt = Number(startAt);

        const usersDB = await db
        .selectFrom('users')
        .selectAll('users')
        .execute();

        for (let i = 0; i < usersDB.length; i++)
        {
            const temp = usersDB[i];
            users.push({username: temp.user_name, id: temp.user_id, admin: temp.user_role == accountUtil.UserRole.Administrator,
            betaTester: temp.user_role > accountUtil.UserRole.User, banned: temp.user_status == accountUtil.UserStatus.Banned});
        }

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