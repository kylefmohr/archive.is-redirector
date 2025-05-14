const DEFAULT_DOMAINS = [];

const SKIP_HOMEPAGE_REDIRECT_KEY = 'skipHomepageRedirectEnabled';

// Initialize storage with default settings if none exist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['domains', SKIP_HOMEPAGE_REDIRECT_KEY], (result) => {
    const itemsToSet = {};
    if (result.domains === undefined) {
      itemsToSet.domains = []; // Default to empty array
    }
    if (result[SKIP_HOMEPAGE_REDIRECT_KEY] === undefined) {
      itemsToSet[SKIP_HOMEPAGE_REDIRECT_KEY] = true; // Default to true (skip homepages)
    }
    if (Object.keys(itemsToSet).length > 0) {
      chrome.storage.sync.set(itemsToSet);
      console.log('Initialized default settings:', itemsToSet);
    }
  });
});

// Track URLs that have been processed to prevent infinite loops
const processedUrls = new Map(); // Map of tabId -> Set of processed URLs

chrome.tabs.onRemoved.addListener((tabId) => {
  if (processedUrls.has(tabId)) {
    processedUrls.delete(tabId);
    // console.log(`Cleaned up resources for tab ${tabId}`);
  }
});

function scheduleTabCleanup(tabId) {
  setTimeout(() => {
    if (processedUrls.has(tabId)) {
      processedUrls.delete(tabId);
      // console.log(`Cleaned up resources for inactive tab ${tabId}`);
    }
  }, 60000); // 1 minute timeout
}

function getProcessedUrlsForTab(tabId) {
  if (!processedUrls.has(tabId)) {
    processedUrls.set(tabId, new Set());
  }
  return processedUrls.get(tabId);
}

function checkAndRedirectUrl(url, tabId, isBeforeNavigate = false) {
  const tabProcessedUrls = getProcessedUrlsForTab(tabId);
  
  if (tabProcessedUrls.has(url)) {
    return;
  }
  
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;
    
    if (hostname.includes('archive.is') || hostname.includes('archive.today')) {
      return;
    }
    
    chrome.storage.sync.get(['domains', SKIP_HOMEPAGE_REDIRECT_KEY], (result) => {
      const domainsToRedirect = result.domains || DEFAULT_DOMAINS; // Will be [] if not set or cleared
      if (!domainsToRedirect || domainsToRedirect.length === 0) { // No domains to redirect
          return;
      }
      
      const skipHomepageEnabled = result[SKIP_HOMEPAGE_REDIRECT_KEY] === undefined ? true : result[SKIP_HOMEPAGE_REDIRECT_KEY];

      for (const listedDomain of domainsToRedirect) {
        if (hostname === listedDomain || hostname.endsWith('.' + listedDomain)) {
          let shouldRedirect = true; 

          if (skipHomepageEnabled && (pathname === '/' || pathname === '')) {
            shouldRedirect = false;
            // console.log(`Skipping redirect for homepage (setting enabled) of matched domain: ${url}`);
          }

          if (shouldRedirect) {
            const baseUrl = parsedUrl.origin + pathname;
            const targetUrl = 'https://archive.is/newest/' + baseUrl;
            
            console.log(`Redirecting from ${url} to ${targetUrl}`);
            
            tabProcessedUrls.add(url);
            tabProcessedUrls.add(targetUrl);
            
            try {
                const archiveUrlObj = new URL(targetUrl);
                tabProcessedUrls.add(archiveUrlObj.toString());
            } catch (e) {
                // console.warn(`Could not parse targetUrl for processed tracking: ${targetUrl}`, e);
            }
            
            chrome.tabs.update(tabId, { url: targetUrl });
            scheduleTabCleanup(tabId);
            return; 
          }
        }
      }
    });
  } catch (e) {
    console.error(`Error processing URL ${url}: ${e}`);
  }
}

// Early detection
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  checkAndRedirectUrl(details.url, details.tabId, true);
}, { url: [{ schemes: ['http', 'https'] }] });

// Fallback detection
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  chrome.tabs.get(details.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;
    checkAndRedirectUrl(tab.url, details.tabId, false);
  });
}, { url: [{ schemes: ['http', 'https'] }] });

// History API updates
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  chrome.tabs.get(details.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;
    checkAndRedirectUrl(tab.url, details.tabId, false);
  });
}, { url: [{ schemes: ['http', 'https'] }] });