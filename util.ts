import { ConsoleStream, Logger } from "https://deno.land/x/optic/mod.ts"

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



