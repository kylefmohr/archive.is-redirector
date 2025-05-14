// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get a reference to the options button
  const optionsBtn = document.getElementById('optionsBtn');
  
  // Add a click event listener to the button
  optionsBtn.addEventListener('click', function() {
    // Open the options page
    chrome.runtime.openOptionsPage();
  });
});
