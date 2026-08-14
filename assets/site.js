// Shared across the home page and each service page. Every page that loads this
// script carries the quote form, but bail out cleanly rather than throwing if a
// future page does not.
const quoteForm = document.getElementById('quoteForm');
if (quoteForm) {

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/rho044dow3m3la38kqeiuw25wuf23zja';
// Where the owned lead database lives (it powers /admin). The static site is
// hosted separately from the API, so the path has to be absolute when the page
// is served from the static host — a relative /api/quotes would resolve against
// getmovr.ca, which has no such route, and every lead would be lost.
// Same-origin when the API itself is serving the page (Render, or local dev).
const API_HOST = 'https://movr-backend-v6fx.onrender.com';
const SELF_HOSTED = location.hostname === 'localhost' ||
                    location.hostname === '127.0.0.1' ||
                    location.hostname.endsWith('.onrender.com');
const BACKEND_API_URL = (SELF_HOSTED ? '' : API_HOST) + '/api/quotes';

// Address fields adapt to the service: junk removal is a pickup only, so it has
// no destination. Labels change per service so "from/to" reads naturally.
const ADDRESS_CONFIG = {
  moving:     { from: 'Moving From',    to: 'Moving To',           showTo: true,  toRequired: true },
  equipment:  { from: 'Pickup Address', to: 'Delivery Address',    showTo: true,  toRequired: true },
  junk:       { from: 'Pickup Address', to: null,                  showTo: false, toRequired: false },
  'not-sure': { from: 'Pickup Address', to: 'Destination Address', showTo: true,  toRequired: false },
  '':         { from: 'Pickup Address', to: 'Destination Address', showTo: true,  toRequired: false }
};

const serviceSelect = document.getElementById('service');
const fromAddressLabel = document.getElementById('fromAddressLabel');
const toAddressLabel = document.getElementById('toAddressLabel');
const toAddressRow = document.getElementById('toAddressRow');
const toAddressInput = document.getElementById('toAddress');

function syncAddressFields() {
  const config = ADDRESS_CONFIG[serviceSelect.value] || ADDRESS_CONFIG[''];

  fromAddressLabel.textContent = config.from;
  toAddressRow.hidden = !config.showTo;

  if (config.showTo) {
    toAddressLabel.textContent = config.toRequired ? config.to : config.to + ' (optional)';
    // Keep required in sync with visibility — a hidden required input blocks
    // submission with a validation message the user can't see or act on.
    toAddressInput.required = config.toRequired;
  } else {
    toAddressInput.required = false;
    toAddressInput.value = '';
  }
}

serviceSelect.addEventListener('change', syncAddressFields);
syncAddressFields();

quoteForm.addEventListener('submit', function(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('.btn-submit');
  const originalBtnText = submitBtn.textContent;

  const data = {
    name: form.name.value,
    phone: form.phone.value,
    email: form.email.value,
    service: form.service.value,
    from_address: form.fromAddress.value,
    to_address: form.toAddress.value,
    date: form.date.value,
    details: form.details.value,
    submitted_at: new Date().toISOString(),
    source: 'getmovr.ca quote form'
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  // Best-effort mirror into the owned lead database; never blocks or affects the UI.
  fetch(BACKEND_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(function() { /* backend not deployed here — ignore */ });

  fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(function(response) {
      if (!response.ok) throw new Error('Network response was not ok');
      submitBtn.textContent = 'Sent! We\'ll be in touch soon.';
      form.reset();
      syncAddressFields(); // reset() clears the service select, so re-apply its field rules
      setTimeout(function() {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }, 4000);
    })
    .catch(function(err) {
      console.error('Form submission error:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      alert('Something went wrong sending your request. Please call us directly at (437) 988-7234.');
    });
});

}
