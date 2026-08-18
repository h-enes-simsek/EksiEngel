import {config} from './config.js';
import {log} from './log.js';

// Check if the configured EksiSozluk URL is currently accessible
// return: true if URL is accessible, false if not
export async function isEksiSozlukAccessible()
{
  try 
  {
    let response = await fetch(config.EksiSozlukURL);
    let isAccessible = response.status === 200;
    log.info("url", "is EksiSozluk accessible: " + isAccessible + " at " + config.EksiSozlukURL);

    if(!isAccessible)
    {
      log.warn("url", "EksiSozluk is not accessible at: " + config.EksiSozlukURL);
    }

    return isAccessible;
  } 
  catch (err) 
  {
    log.warn("url", "Error checking EksiSozluk accessibility: " + err);
    return false;
  }
}