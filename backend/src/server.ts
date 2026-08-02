// Parent: REQ-1200, REQ-1301
import "dotenv/config";

import app from "./app";
import { startScheduledJobs } from "./lib/scheduler";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CodeBook backend listening on port ${PORT}`);
  startScheduledJobs();
});
