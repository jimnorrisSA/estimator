import express from "express";
import { createServer } from "http";
import { setupWebSocket } from "./websocket/index.js";
import { setupAuth } from "./auth/index.js";
import { projectRouter } from "./routes/projects.js";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
setupAuth(app);
setupWebSocket(httpServer);

app.use("/api/projects", projectRouter);

const PORT = process.env.PORT ?? 4000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
