import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts"

export async function hashPassword(password:string)
{
    const hash = await bcrypt.hash(password);
    return hash;
}

export async function checkHashedPassword(hash:string, password:string)
{
    const result = await bcrypt.compare(password, hash);
    return result
}