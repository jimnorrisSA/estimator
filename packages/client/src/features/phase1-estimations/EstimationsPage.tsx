import { EstimationList } from "./EstimationList.js";
import { EstimationCanvas } from "./components/EstimationCanvas.js";

export function EstimationsPage() {
  return (
    <div className="flex h-full w-full">
      <EstimationList />
      <EstimationCanvas />
    </div>
  );
}
