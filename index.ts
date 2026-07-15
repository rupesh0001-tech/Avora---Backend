import app from "./app";
import { env } from "./config/env";

const port = env.PORT || 5001;

app.listen(port, () => {
  console.log(`🚀 Backend server is running at http://localhost:${port}`);
});
