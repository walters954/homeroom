import { report } from "./observe";

/**
 * Cron liveness, as a URL to ping.
 *
 * A job that stops firing raises no error, so the only thing that can catch
 * it is something expecting a ping that never comes. That belongs outside the
 * app by definition — it has to be watching when we aren't running.
 *
 * Deliberately not a vendor SDK. This is the healthchecks.io ping protocol,
 * which is three URLs and no client library: `/start`, the bare URL for
 * success, `/fail` for a throw. Self-hosted healthchecks, healthchecks.io and
 * Better Stack heartbeats all accept it, so switching is an env var and this
 * file never learns which one you chose.
 *
 * Unset URL means no pings, same contract as every other integration here.
 */
export async function withHeartbeat<T>(
  url: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  if (!url) return run();

  await ping(`${url}/start`);
  try {
    const result = await run();
    await ping(url);
    return result;
  } catch (err) {
    // Tell the monitor before rethrowing, so the alert doesn't wait for the
    // whole schedule to lapse. The throw still reaches Next's onRequestError.
    await ping(`${url}/fail`);
    throw err;
  }
}

async function ping(url: string): Promise<void> {
  try {
    await fetch(url, { method: "POST", signal: AbortSignal.timeout(5_000) });
  } catch (err) {
    // A monitor we can't reach must not fail the job it is monitoring.
    report("heartbeat", err, { url });
  }
}
