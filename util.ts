import { ConsoleStream, Logger } from "https://deno.land/x/optic/mod.ts"

export const logger = new Logger();
logger.addStream(new ConsoleStream());