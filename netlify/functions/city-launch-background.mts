/**
 * Netlify Background Function (the "-background" suffix gives it a 15-minute limit and an immediate 202 reply).
 * Runs the City Launch writing loop; see lib/factory/city-launch-background.ts. Plain `next dev` keeps writing
 * in-process (no function server); `netlify dev` and deployed sites hand batches to this function, and when it
 * is unavailable or never starts, the chained /api/factory/city-launch/tick path takes over.
 */
import { handleCityLaunchBackground } from "../../lib/factory/city-launch-background";

const cityLaunchBackground = async (req: Request): Promise<Response> => handleCityLaunchBackground(req);

export default cityLaunchBackground;
