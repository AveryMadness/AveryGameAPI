import { WebSocketClient, WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { logger, backendHostType, BackendHostType } from "../util.ts";
import { getUsernameFromUserID } from "../accountUtil.ts";

export let wss:WebSocketServer;

const chatMessages:string[] = [];

const _numOnlineUsers = 0;

function UpdateAllUserChats()
{
    if (wss)
    {
        const clients = wss.clients;

        clients.forEach(client => {
            client.send(JSON.stringify({payloadType: "updateChatMessages", payload: chatMessages}));
        });
    }
}

const cachedUsernames:Map<string, string> = new Map<string, string>();
async function replaceUserID(string:string):Promise<string>
{
    if (string.includes("userid:"))
    {
        let retVal = string;
        const split = retVal.split("userid:");
        let userid = split[1];
        userid = userid.split("]")[0];
        if (cachedUsernames.has(userid))
        {
            return retVal.replace("userid: " + userid, cachedUsernames.get(userid) ?? "");
        }
        
        const username = await getUsernameFromUserID(userid);

        if (!username)
        {
            return string;
        }

        cachedUsernames.set(userid, username);

        retVal = retVal.replace("userid:" + userid, username);
        return retVal;
    }
    
    return string;
}

function _onNumOnlineUsersChanged()
{
    if (wss)
    {
        const clients = wss.clients;

        clients.forEach(client => {
            client.send(JSON.stringify({payloadType: "updateOnlineUsers", payload: numOnlineUsers}));
        });
    }
}

export function InitializeWebsocketServer()
{
    const envName = backendHostType == BackendHostType.Prod ? "WebSocketPort" : backendHostType == BackendHostType.Developer ? "DEV_WebSocketPort" : "STAGING_WebSocketPort";

    const wsport:number = parseInt(Deno.env.get(envName) ?? "3000") ?? 3000;
    wss = new WebSocketServer(wsport);

    if (wss != null)
    {
        logger.info(`Chat server listening at ws://localhost:${wsport}/`)
    }

    wss.on("error", function(err:string) {
        logger.error(err.toString());
    });

    wss.on("connection", function (ws: WebSocketClient) {
        ws.send(JSON.stringify({payloadType: "updateChatMessages", payload: chatMessages}));

        ws.on("open", function () {
            //logger.info("client opened");
            //numOnlineUsers++;
            //onNumOnlineUsersChanged();
        });

        ws.on("close", function() {
            //logger.info("client closed");
            //numOnlineUsers--;
            //onNumOnlineUsersChanged();
        });

        ws.on("message", async function (message: string) {

            let json;
            try {
                json = JSON.parse(message);
            }
            catch (exception)
            {
                logger.error(exception);
            }

            const payloadType = json.payloadType;
            const payload = json.payload;

            if (!payloadType)
            {
                ws.send(JSON.stringify({code: 400, message: "No payload type."}));
                return;
            }

            if (!payload)
            {
                ws.send(JSON.stringify({code: 400, message: "No payload."}));
                return;
            }
            
            switch (payloadType)
            {
                case "getChatMessages":
                    ws.send(JSON.stringify({payloadType: "getChatMessages", code: 200, message: "Success", payload: chatMessages}));
                    break;

                case "sendChatMessage":
                {
                    let message = payload;
                    message = await replaceUserID(payload);
                    chatMessages.push(message);
                    ws.send(JSON.stringify({payloadType: "sendChatMessage", code: 200, message: "Success"}));
                    UpdateAllUserChats();
                    break;
                }

                case "getNumOnlineUsers":
                    ws.send(JSON.stringify({payloadType: "getNumOnlineUsers", payload: numOnlineUsers}));
                    break;
            }       
        });
    });
}