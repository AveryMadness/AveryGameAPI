import "https://deno.land/std/dotenv/load.ts";
import { Hono } from 'https://deno.land/x/hono/mod.ts' 
import { logger } from "./util.ts"
import { auth, db } from "./database.ts"
import { collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import { cors } from 'https://deno.land/x/hono/middleware.ts'

const app = new Hono();

app.onError((err, c) => {
  logger.error(err.stack ?? `${err.name ?? "Error"}: ${err.message}`);

  return c.json({
    errorName: err.name ?? "Unknown Error",
    errorMessage: err.message,
  }, 500);
});

app.use(
  '/api/*',
  cors({
    origin: "*",
  })
)
  
app.route("/api/v1/account", await (await import("./routes/account.ts")).default());
app.route("/api/v1/authentication", await (await import("./routes/auth.ts")).default());
app.route("api/v1/friend", await (await import("./routes/friend.ts")).default());
app.route("api/v1/admin", await (await import("./routes/admin.ts")).default());
app.route("api/v1/data", await (await import("./routes/data.ts")).default());

Deno.serve(app.fetch);

app.get('/', (c) => c.text('Hello Deno!'));

