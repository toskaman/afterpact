import { createApp } from "./routes";

const port = Number.parseInt(process.env["PORT"] ?? "3001", 10);
if (!Number.isSafeInteger(port) || port <= 0) {
  console.error("PORT must be a positive integer");
  process.exit(1);
}

const app = createApp({ dataDir: process.env["AFTERPACT_DATA_DIR"] });
app.listen(port).then(
  (bound) => {
    console.log(JSON.stringify({
      msg: "afterpact api listening",
      port: bound,
      transport: app.ops.transport,
      webDir: app.webDir ?? "(static disabled)",
    }));
  },
  (error: unknown) => {
    console.error("failed to start server", error);
    process.exit(1);
  },
);

process.on("SIGINT", () => {
  void app.close().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void app.close().then(() => process.exit(0));
});
