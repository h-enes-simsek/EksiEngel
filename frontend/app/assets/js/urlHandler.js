import {log} from './log.js';

// Check if the configured EksiSozluk URL is currently accessible
// return: true if URL is accessible, false if not
export async function isEksiSozlukAccessible({signal, baseUrl} = {})
{
  if(typeof baseUrl !== "string" || baseUrl.length === 0)
    throw new TypeError("baseUrl must be a non-empty string");

  try 
  {
    let response = await fetch(baseUrl, {signal});
    let isAccessible = response.status === 200;
    log.info("url", "is EksiSozluk accessible: " + isAccessible + " at " + baseUrl);

    if(!isAccessible)
    {
      log.warn("url", "EksiSozluk is not accessible at: " + baseUrl);
    }

    return isAccessible;
  } 
  catch (err) 
  {
    if(signal?.aborted)
      throw err;

    log.warn("url", "Error checking EksiSozluk accessibility: " + err);
    return false;
  }
}
