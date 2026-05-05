import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function createCollabDoc(projectId: string) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(
    `ws://${window.location.host}/ws`,
    `project-${projectId}`,
    doc
  );
  return { doc, provider };
}
