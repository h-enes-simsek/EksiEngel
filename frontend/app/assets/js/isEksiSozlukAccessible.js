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

    if(!isAccessible)
    {
      log.err("access", "EksiSozluk is not accessible at: " + baseUrl);
    }
    else
    {
      log.info("access", "EksiSozluk is accessible at: " + baseUrl);
    }

    return isAccessible;
  } 
  catch (err) 
  {
    if(signal?.aborted)
      throw err;

    log.err("access", "Error checking EksiSozluk accessibility: " + err);
    return false;
  }
}
