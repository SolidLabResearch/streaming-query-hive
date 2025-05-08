
import { IncomingMessage, ServerResponse } from "http";
import { RSPAgentQuery } from "./HTTPServer";

export class GETHandler {
    public static async handle(request: IncomingMessage, response: ServerResponse, rspAgentRecord: Record<string, RSPAgentQuery>) {
        if (request.url === "/fetchQueries" && request.method === "GET") {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(rspAgentRecord));
        }
        else if (request.url === "/status" && request.method === "GET") {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ active: true }));
        }
        else {
            response.writeHead(404, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Not Found" }));
            return;
        }
    }
}