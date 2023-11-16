import "https://deno.land/std@0.204.0/dotenv/load.ts";
import { Hono } from "https://deno.land/x/hono@v3.8.1/mod.ts" 
import { logger } from "./util.ts"
import { auth, db } from "./database.ts"
import { tokens } from "./token.ts";
import { collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { cors } from "https://deno.land/x/hono@v3.8.3/middleware.ts"
import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { InitializeWebsocketServer } from "./wss/main.ts"
import { TextProtoReader } from "https://deno.land/std@0.92.0/textproto/mod.ts";
import { BufReader } from "https://deno.land/std@0.92.0/io/bufio.ts";
import { readerFromStreamReader } from "https://deno.land/std@0.205.0/streams/mod.ts";
import {existsSync} from "https://deno.land/std@0.206.0/fs/mod.ts";
import { exists } from "https://deno.land/std@0.206.0/fs/exists.ts";



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

app.use(
  '/api/*',
  cors({
    origin: "*",
  })
)


try {
  
const options = existsSync("permenantKeys.txt") ? { read: true } : { read: true, createNew: true, write: true}
const tp = new TextProtoReader( new 
BufReader(await Deno.open('permenantKeys.txt', options)));

let line;
while (line = await tp.readLine())
{
  if (line == "")
    continue;
  const keyandid = line.split(";");
  tokens.set(keyandid[0], keyandid[1]);
}
}
catch (exception)
{
  logger.error(exception);
}
finally
{
  logger.info("Initialized linked keys.");
}
  
app.route("/api/v1/account", await (await import("./routes/account.ts")).default());
app.route("/api/v1/authentication", await (await import("./routes/auth.ts")).default());
app.route("api/v1/friend", await (await import("./routes/friend.ts")).default());
app.route("api/v1/admin", await (await import("./routes/admin.ts")).default());
app.route("api/v1/data", await (await import("./routes/data.ts")).default());
app.route("api/v1/game", await (await import("./routes/game.ts")).default());

const abortController = new AbortController();

InitializeWebsocketServer();



serve(app.fetch, {
  signal: abortController.signal,
  port: parseInt(Deno.env.get("PORT") ?? "8080"),
});

app.get('/', (c) => c.text('Hello Deno!'));

