import { WebSocketClient, WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { logger } from "../util.ts";

export let wss:WebSocketServer;

const chatMessages:string[] = [];

let numOnlineUsers = 0;

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

function onNumOnlineUsersChanged()
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
    const wsport:number = parseInt(Deno.env.get("WebSocketPort") ?? "8080") ?? 8080;
    wss = new WebSocketServer(wsport);

    if (wss != null)
    {
        logger.info(`Chat server listening at ws://localhost:${wsport}/`)
    }

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

        ws.on("message", function (message: string) {

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
                    chatMessages.push(payload);
                    ws.send(JSON.stringify({payloadType: "sendChatMessage", code: 200, message: "Success"}));
                    UpdateAllUserChats();
                    break;

                case "getNumOnlineUsers":
                    ws.send(JSON.stringify({payloadType: "getNumOnlineUsers", payload: numOnlineUsers}));
                    break;
            }       
        });
    });
}