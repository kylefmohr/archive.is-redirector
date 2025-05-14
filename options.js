const DEFAULT_DOMAINS = []; 

const SKIP_HOMEPAGE_REDIRECT_KEY = 'skipHomepageRedirectEnabled';
const RECOMMENDED_DOMAINS_URL = 'https://raw.githubusercontent.com/kylefmohr/archive.is-redirector/refs/heads/main/recommended_domains.json';


// DOM elements
const domainListElement = document.getElementById('domainList');
const newDomainInput = document.getElementById('newDomain');
const addDomainButton = document.getElementById('addDomain');
const clearAllDomainsButton = document.getElementById('clearAllDomains'); // Renamed
const skipHomepageCheckbox = document.getElementById('skipHomepageRedirect');
const loadRecommendedDomainsButton = document.getElementById('loadRecommendedDomains');
const recommendedDomainsStatusElement = document.getElementById('recommendedDomainsStatus');

// Load and display the current domains and settings
function loadStoredSettings() {
  chrome.storage.sync.get(['domains', SKIP_HOMEPAGE_REDIRECT_KEY], (result) => {
    const domains = result.domains || DEFAULT_DOMAINS; // Will be [] if not set
    displayDomains(domains);

    const skipHomepage = result[SKIP_HOMEPAGE_REDIRECT_KEY] === undefined ? true : result[SKIP_HOMEPAGE_REDIRECT_KEY];
    skipHomepageCheckbox.checked = skipHomepage;
  });
}

// Display the list of domains in the UI
function displayDomains(domains) {
  domainListElement.innerHTML = '';
  
  domains.sort().forEach(domain => { // Sort for consistent display
    const domainItem = document.createElement('div');
    domainItem.className = 'domain-item';
    
    const domainText = document.createElement('span');
    domainText.textContent = domain;
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.onclick = () => deleteDomain(domain);
    
    domainItem.appendChild(domainText);
    domainItem.appendChild(deleteButton);
    domainListElement.appendChild(domainItem);
  });
}

// Add a new domain to the list
function addDomain() {
  const domain = newDomainInput.value.trim().toLowerCase();
  
  if (!domain) {
    alert('Please enter a domain.');
    return;
  }
  
  let cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  cleanDomain = cleanDomain.split('/')[0];
  
  chrome.storage.sync.get('domains', (result) => {
    const domains = result.domains || DEFAULT_DOMAINS; // Will be [] if not set
    
    if (domains.includes(cleanDomain)) {
      alert(`Domain "${cleanDomain}" is already in the list.`);
      return;
    }
    
    const updatedDomains = [...domains, cleanDomain];
    chrome.storage.sync.set({ domains: updatedDomains }, () => {
      displayDomains(updatedDomains);
      newDomainInput.value = '';
    });
  });
}

// Delete a domain from the list
function deleteDomain(domainToDelete) {
  chrome.storage.sync.get('domains', (result) => {
    const domains = result.domains || DEFAULT_DOMAINS;
    const updatedDomains = domains.filter(domain => domain !== domainToDelete);
    
    chrome.storage.sync.set({ domains: updatedDomains }, () => {
      displayDomains(updatedDomains);
    });
  });
}

// Clear all domains from the list
function clearAllDomains() {
  if (confirm('Are you sure you want to remove ALL domains from the list?')) {
    chrome.storage.sync.set({ domains: [] }, () => { // Set to empty array
      displayDomains([]); // Display empty list
    });
  }
}

// Save the skip homepage redirect setting
function saveSkipHomepageSetting() {
  const enabled = skipHomepageCheckbox.checked;
  chrome.storage.sync.set({ [SKIP_HOMEPAGE_REDIRECT_KEY]: enabled }, () => {
    // console.log(`Skip homepage redirect setting saved: ${enabled}`);
  });
}

// Fetch and apply recommended domains
async function fetchAndApplyRecommendedDomains() {
  recommendedDomainsStatusElement.textContent = 'Loading...';
  loadRecommendedDomainsButton.disabled = true;
  try {
    const response = await fetch(RECOMMENDED_DOMAINS_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    
    if (data && Array.isArray(data.domains)) {
      const fetchedDomains = data.domains.map(d => d.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]).filter(d => d);
      
      chrome.storage.sync.get('domains', (result) => {
        let currentDomains = result.domains || [];
        let domainsAddedCount = 0;
        let newDomainsForStorage = [...currentDomains];

        fetchedDomains.forEach(fetchedDomain => {
          if (fetchedDomain && !newDomainsForStorage.includes(fetchedDomain)) {
            newDomainsForStorage.push(fetchedDomain);
            domainsAddedCount++;
          }
        });
        
        chrome.storage.sync.set({ domains: newDomainsForStorage }, () => {
          displayDomains(newDomainsForStorage);
          if (domainsAddedCount > 0) {
            recommendedDomainsStatusElement.textContent = `Added ${domainsAddedCount} new domain(s).`;
          } else if (fetchedDomains.length > 0) {
            recommendedDomainsStatusElement.textContent = 'All recommended domains already in list.';
          } else {
            recommendedDomainsStatusElement.textContent = 'No domains found in recommended list or list empty.';
          }
          setTimeout(() => { recommendedDomainsStatusElement.textContent = ''; }, 5000);
        });
      });
    } else {
      throw new Error('Invalid format from recommended domains URL.');
    }
  } catch (error) {
    console.error('Error fetching recommended domains:', error);
    recommendedDomainsStatusElement.textContent = `Error: ${error.message.substring(0, 100)}`; // Truncate long errors
    // Keep error message visible for a bit longer or until next action
    setTimeout(() => { if(recommendedDomainsStatusElement.textContent.startsWith("Error:")) recommendedDomainsStatusElement.textContent = ''; }, 10000);
  } finally {
    loadRecommendedDomainsButton.disabled = false;
  }
}


// Event listeners
document.addEventListener('DOMContentLoaded', loadStoredSettings);
addDomainButton.addEventListener('click', addDomain);
clearAllDomainsButton.addEventListener('click', clearAllDomains); // Updated
skipHomepageCheckbox.addEventListener('change', saveSkipHomepageSetting);
loadRecommendedDomainsButton.addEventListener('click', fetchAndApplyRecommendedDomains);

newDomainInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    addDomain();
  }
});