// deno-lint-ignore require-await

import "https://deno.land/std@0.204.0/dotenv/load.ts";
import * as token from "./token.ts";
import { db } from "./db.ts";
import { logger } from "./util.ts";
import { UserStatus, UserRole } from "./accountUtil.ts";

async function regenAllTokens()
{
}

regenAllTokens();