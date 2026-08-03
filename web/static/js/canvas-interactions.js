export const EmptyCanvasAction = Object.freeze({
  PAN: "pan",
  SELECT: "select",
});

export function emptyCanvasAction(shiftKey) {
  return shiftKey ? EmptyCanvasAction.SELECT : EmptyCanvasAction.PAN;
}

export function nextCanvasTool(activeTool, requestedTool) {
  return requestedTool !== "select" && activeTool === requestedTool ? "select" : requestedTool;
}
