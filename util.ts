import { ConsoleStream, Logger } from "https://deno.land/x/optic/mod.ts"
import {getJson} from "./routes/data.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";


export enum BackendHostType
{
  None = 0,
  Developer = 100,
  Staging = 200,
  Prod = 300
}

export let backendHostType:BackendHostType = BackendHostType.None;

export function setBackendHostType(hostType:BackendHostType):void
{
    backendHostType = hostType;
}

export const logger = new Logger();
logger.addStream(new ConsoleStream());



