import app from "./app";
import { env } from "./config/env";

const port = env.PORT || 5001;

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Backend server is running at http://0.0.0.0:${port}`);
});
