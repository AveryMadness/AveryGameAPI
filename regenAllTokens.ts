// deno-lint-ignore require-await

import "https://deno.land/std@0.204.0/dotenv/load.ts";
import { DocumentSnapshot, collection, _deleteDoc, getDocs, _setDoc } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";
import * as _token from "./token.ts";
import { db } from "./database.ts";
//import { logger } from "./util.ts";
//import { UserStatus, UserRole } from "./accountUtil.ts";

async function regenAllTokens()
{
    const usersCollection = collection(db, "user");
    
        const snapShot = await getDocs(usersCollection);
        snapShot.forEach(async (doc:DocumentSnapshot) => {
            const data = doc.data();
            //const tok = await token.generateToken(data["id"], true);
            //logger.info(`Generated token ${tok} for ${doc.id}`);
        }, null);
}

regenAllTokens();