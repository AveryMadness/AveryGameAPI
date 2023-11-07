import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts";
import { logger } from "../util.ts";


export default async function() {
    const router = new Hono();

    const currentGameVersion = Deno.env.get("GAME_VERSION") ?? "0.25.0";

    router.get("/checkGameVersion", async (c) => {
        const gameVersion = await c.req.header("version");

        if (!gameVersion)
        {
            return c.json({code: 400, message: "Invalid user parameters."}, 400);
        }

        logger.info(currentGameVersion);

        return c.json({code: 200, message: "Success", correctVersion: (gameVersion == currentGameVersion) ?? false});
    });
    return router;
}