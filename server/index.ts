import { createApi } from './api';
import { runScheduledIngest } from './scheduler';

const port = Number(process.env.PORT || 4000);
const app = createApi();

app.listen(port, () => {
  console.log(`[API] Listening on http://localhost:${port}`);
});

runScheduledIngest();
