import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";
import type { Server } from "http";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws, req) => {
    setupWSConnection(ws, req);
  });
}
