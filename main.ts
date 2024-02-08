import "https://deno.land/std@0.204.0/dotenv/load.ts";
import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts" 
import { logger, setBackendHostType, backendHostType, BackendHostType } from "./util.ts"
//import { auth, db } from "./database.ts"
//import { tokens } from "./token.ts";
//import { collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { cors } from "https://deno.land/x/hono@v3.8.3/middleware.ts"
import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { InitializeWebsocketServer } from "./wss/main.ts"
//import { TextProtoReader } from "https://deno.land/std@0.92.0/textproto/mod.ts";
//import { BufReader } from "https://deno.land/std@0.92.0/io/bufio.ts";
//import { readerFromStreamReader } from "https://deno.land/std@0.205.0/streams/mod.ts";
import {existsSync} from "https://deno.land/std@0.206.0/fs/mod.ts";
//import { exists } from "https://deno.land/std@0.206.0/fs/exists.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
import { HostTypeMiddleware } from "./middleware.ts";



if (!existsSync(path.join("cloudstorage")))
{
  logger.error("Cloudstorage folder does not exist. Please create for the program to function.");
  Deno.exit(1);
}

if (!existsSync(path.join("data")))
{
  logger.error("Data folder does not exist. Please create for the program to function.");
  Deno.exit(1);
}

if (!existsSync(path.join("data", "playlist.json")))
{
  logger.warn("Playlists data does not exist, platlist functionality will not work.");
}

if (!existsSync(path.join("data", "version.json")))
{
  logger.error("version.json file does not exist. Please create and populate for the program to function.");
  Deno.exit(1);
}

const app = new Hono({});

app.onError((err, c) => {
  logger.error(err.stack ?? `${err.name ?? "Error"}: ${err.message}`);

  return c.json({
    errorName: err.name ?? "Unknown Error",
    errorMessage: err.message,
    code: 500,
    message: err.message
  }, 500);
});

app.use("*", async (c, next) => {
  await next();

  if (Deno.args.includes("-dev"))
  {
    if (c.res.status == 200)
    {
      logger.debug(`[${c.req.method}] ${c.req.url} - ${c.res.status}`);
    }
    else
    {
      logger.error(`[${c.req.method}] ${c.req.url} - ${c.res.status}`);
    }
  }
});

if (Deno.args.includes("-dev"))
{
   setBackendHostType(BackendHostType.Developer);
}
else if (Deno.args.includes("-staging"))
{
  setBackendHostType(BackendHostType.Staging);
}
else if (Deno.args.includes("-prod"))
{
  setBackendHostType(BackendHostType.Prod);
}

if (backendHostType == BackendHostType.None)
{
  logger.error("Backend Host Type is NONE, make sure to check your parameters. exiting...");
  Deno.exit(1);
}

app.use(
  '/api/*',
  cors({
    origin: "*",
  })
);

app.use(HostTypeMiddleware(backendHostType));


app.notFound((c) => {
  return c.json({code: 404, message: "Not Found"});
});
  
app.route("/api/v1/account", await (await import("./routes/account.ts")).default());
app.route("/api/v1/authentication", await (await import("./routes/auth.ts")).default());
app.route("api/v1/friend", await (await import("./routes/friend.ts")).default());
app.route("api/v1/admin", await (await import("./routes/admin.ts")).default());
app.route("api/v1/data", await (await import("./routes/data.ts")).default());
app.route("api/v1/game", await (await import("./routes/game.ts")).default());

const abortController = new AbortController();


app.get("/admin", async (c) => {
  c.header("content-type", "text/html");
  return c.body(await Deno.readFile("admin/index.html"));
});



const envName = backendHostType == BackendHostType.Prod ? "PORT" : backendHostType == BackendHostType.Developer ? "DEV_PORT" : "STAGING_PORT";
serve(app.fetch, {
  signal: abortController.signal,
  port: parseInt(Deno.env.get(envName) ?? "8000"),
});

app.get('/', async (c) => {
  return c.json({code: 200, message: "Success"});
});

InitializeWebsocketServer();


