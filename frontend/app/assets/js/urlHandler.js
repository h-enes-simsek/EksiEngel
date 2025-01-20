import {config, saveConfig} from './config.js';
import {log} from './log.js';

const isURLValid = url => {
    try { 
      return Boolean(new URL(url)); 
    }
    catch(e)
    { 
      return false; 
    }
  }

async function isURLAccessible(url)
{
  try 
  {
    let response = await fetch(url);
    // redirected response is not considered correct
    // TODO: redirected response probably means the user is using a VPN. So, redirected url could be used instead 
    return response.status === 200 && !response.redirected;
  } 
  catch (err) 
  {
    return false;
  }
}

// eksisozluk.com is banned by government and cannot be accessible anymore
// this function finds the latest URL and saves it to config
// return: true if everthing works, false if not
export async function handleEksiSozlukURL()
{
  let isAccessible = await isURLAccessible(config.EksiSozlukURL);
  log.info("url", "is EksiSozluk accessible: " + isAccessible + " at " + config.EksiSozlukURL);

  if(!isAccessible)
  {
    log.warn("url", "EksiSozluk is not accessible at: " + config.EksiSozlukURL);

    try 
    {
      // use a API to find last location of eksisozluk.com 
      let response = await fetch(config.whereIsEksiSozlukURL);
      if(response.status !== 200)
        throw "Where is EksiSozluk API is not accessible";

      let newEksiSozlukURL = await response.text();
      log.info("url", "Obtained EksiSozluk URL: " + newEksiSozlukURL);

      if(config.EksiSozlukURL == newEksiSozlukURL)
        throw "Obtained EksiSozluk URL is the same with the one in the config";

      if(!isURLValid(newEksiSozlukURL))
        throw "Obtained EksiSozluk URL is not valid";

      let isNewURLAccessible = await isURLAccessible(newEksiSozlukURL);

      if(isNewURLAccessible)
      {
        log.info("url", "new EksiSozluk URL accessible, saved into config");
        config.EksiSozlukURL = newEksiSozlukURL;
        await saveConfig(config);
        return true;
      }
      else 
      {
        throw "Obtained EksiSozluk URL is not accessible";
      }
    } 
    catch (err) 
    {
      log.err("url", err);
      return false;
    }
  } 

  return true;
}