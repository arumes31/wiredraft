/** Allow a socket inside an authored chassis or populated module, while retaining edge-crossing checks. */
export function hardwareContainsSocket(component, socket) {
  const container = component.kind === "module-bay" && component.variant === "populated"
    || ["panel", "mounting-bracket"].includes(component.kind) && component.hardwareLayer === "chassis-container";
  return container && socket.x >= component.x && socket.y >= component.y
    && socket.x + socket.width <= component.x + component.width
    && socket.y + socket.height <= component.y + component.height;
}
