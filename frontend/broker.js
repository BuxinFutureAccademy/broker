(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api'; // Production backend URL
  let token = localStorage.getItem('studentstay_token');
  let currentUser = JSON.parse(localStorage.getItem('studentstay_user') || 'null');
  let editingId = null;
  let editingPhotos = [];

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  async function apiCall(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      localStorage.removeItem('studentstay_token');
      localStorage.removeItem('studentstay_user');
      window.location.href = 'access.html';
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Image upload failed');
    }

    return response.json();
  }

  // Logout handler
  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => {
    localStorage.removeItem('studentstay_token');
    localStorage.removeItem('studentstay_user');
    window.location.href = 'access.html';
  }));

  // Guard function to check if user is broker
  function guard(role) {
    if (!currentUser || currentUser.role !== role) {
      window.location.href = `access.html#${role}`;
      return null;
    }
    return currentUser;
  }

  // Initialize broker page
  const session = guard('broker');
  if (session) {
    initializeBrokerPage();
  }

  async function initializeBrokerPage() {
    // Update header
    document.querySelector('#brokerHeaderName').textContent = currentUser.name;
    document.querySelector('#brokerAvatar').textContent = currentUser.name.slice(0, 1).toUpperCase();
    document.querySelector('#brokerWelcome').textContent = currentUser.name.split(' ')[0];

    // Load broker data
    await loadBrokerProfile();
    await loadBrokerLocation();
    await loadBrokerPortfolio();
    await loadBrokerVisits();
  }

  // Load broker profile
  async function loadBrokerProfile() {
    try {
      const profile = await apiCall('/broker/profile');
      if (profile) {
        const form = document.querySelector('#brokerProfileForm');
        Object.entries(profile).forEach(([key, value]) => {
          if (form.elements[key]) {
            form.elements[key].value = value || '';
          }
        });
      }
    } catch (error) {
      console.error('Error loading broker profile:', error);
    }
  }

  // Save broker profile
  const profileForm = document.querySelector('#brokerProfileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(profileForm));
      if (data.experience === '') delete data.experience;
      else data.experience = Number(data.experience);
      
      try {
        const updated = await apiCall('/broker/profile', {
          method: 'PUT',
          body: JSON.stringify(data)
        });
        
        currentUser = { ...currentUser, ...updated };
        localStorage.setItem('studentstay_user', JSON.stringify(currentUser));
        
        document.querySelector('#brokerHeaderName').textContent = updated.name;
        document.querySelector('#brokerWelcome').textContent = updated.name.split(' ')[0];
        document.querySelector('#brokerAvatar').textContent = updated.name.slice(0, 1).toUpperCase();
        
        alert('Your broker profile has been saved successfully!');
      } catch (error) {
        alert(error.message || 'Failed to save profile');
      }
    });
  }

  // Load broker location
  async function loadBrokerLocation() {
    try {
      const location = await apiCall('/broker/location');
      if (location) {
        const form = document.querySelector('#locationForm');
        Object.entries(location).forEach(([key, value]) => {
          if (form.elements[key]) {
            form.elements[key].value = value || '';
          }
        });
      }
    } catch (error) {
      console.error('Error loading broker location:', error);
    }
  }

  // Save broker location
  const locationForm = document.querySelector('#locationForm');
  if (locationForm) {
    locationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(locationForm));
      if (data.radius === '') delete data.radius;
      else data.radius = Number(data.radius);
      
      try {
        await apiCall('/broker/location', {
          method: 'PUT',
          body: JSON.stringify(data)
        });
        
        alert('Your location has been saved successfully!');
      } catch (error) {
        alert(error.message || 'Failed to save location');
      }
    });
  }

  async function loadBrokerVisits() {
    try {
      const visits = await apiCall('/broker/visits') || [];
      const container = document.querySelector('#brokerVisits');
      if (!container) return;
      container.innerHTML = visits.length ? visits.map(item => `<div class="request-row"><div><b>${esc(item.student?.name || 'Student')}</b><p>${esc(item.student?.phone || 'No phone')} · ${esc(item.listing?.title || 'Home')}<br>${esc(item.listing?.address || item.listing?.sector || '')}</p></div><span class="status-pill">Ready to visit</span></div>`).join('') : '<div class="portfolio-empty"><p>No paid students in your sectors yet. Set My Location to the sectors you cover, such as Gamma 1 or Alpha 1.</p></div>';
    } catch (error) {
      console.error('Error loading visits:', error);
    }
  }

  // Load broker portfolio
  async function loadBrokerPortfolio() {
    try {
      const portfolio = await apiCall('/broker/portfolio');
      renderPortfolio(portfolio || []);
      updateStats(portfolio?.length || 0);
    } catch (error) {
      console.error('Error loading broker portfolio:', error);
      renderPortfolio([]);
    }
  }

  // Render portfolio items
  function renderPortfolio(items) {
    const container = document.querySelector('#brokerPortfolio');
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div class="portfolio-empty">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p>No portfolio photos yet. Add your first property photo to get started.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="portfolio-item">
        <img src="${esc(item.photos?.[0] || 'https://via.placeholder.com/400x300?text=No+Image')}" alt="${esc(item.title)}" class="portfolio-image">
        <div class="portfolio-info">
          <h3 class="portfolio-title">${esc(item.title)}</h3>
          <span class="portfolio-type">${esc(item.type)}</span>
          <div class="portfolio-price">${esc(item.price)}</div>
          <div class="portfolio-location">
            📍 ${esc(item.location)}
          </div>
          <p class="portfolio-description">${esc(item.description)}</p>
          <div class="portfolio-actions">
            <button class="edit-btn" type="button" data-edit-portfolio="${esc(item.id)}">Edit</button>
            <button class="delete-btn" type="button" data-delete-portfolio="${esc(item.id)}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-edit-portfolio]').forEach(button => {
      button.addEventListener('click', () => {
        const item = items.find(entry => entry.id === button.dataset.editPortfolio);
        const form = document.querySelector('#portfolioForm');
        if (!item || !form) return;
        editingId = item.id;
        editingPhotos = item.photos || [];
        form.elements.title.value = item.title || '';
        form.elements.type.value = item.type || 'apartment';
        form.elements.price.value = item.price || '';
        form.elements.location.value = item.location || '';
        form.elements.description.value = item.description || '';
        form.querySelector('button').textContent = 'Save changes';
        location.hash = 'portfolio';
      });
    });

    // Add delete handlers
    container.querySelectorAll('[data-delete-portfolio]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this portfolio item?')) return;
        
        try {
          await apiCall(`/broker/portfolio/${button.dataset.deletePortfolio}`, {
            method: 'DELETE'
          });
          await loadBrokerPortfolio();
          alert('Portfolio item deleted successfully');
        } catch (error) {
          alert(error.message || 'Failed to delete portfolio item');
        }
      });
    });
  }

  // Update stats
  function updateStats(photoCount) {
    document.querySelector('#photoCount').textContent = photoCount;
  }

  // Photo upload preview
  const photoInput = document.querySelector('[name="photos"]');
  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const files = [...photoInput.files];
      if (files.length > 10) {
        alert('Choose up to 10 photos.');
        photoInput.value = '';
        return;
      }
      if (files.some(file => !file.type.startsWith('image/'))) {
        alert('Please upload image files only. Videos are not accepted.');
        photoInput.value = '';
        return;
      }
      
      const preview = document.querySelector('#photoPreview');
      preview.innerHTML = files.map(file => `
        <img src="${URL.createObjectURL(file)}" alt="Preview">
      `).join('');
    });
  }

  // Add portfolio item
  const portfolioForm = document.querySelector('#portfolioForm');
  if (portfolioForm) {
    portfolioForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const files = [...data.getAll('photos')].filter(file => file.size && file.type.startsWith('image/'));
      
      if (files.length > 10) {
        return alert('Choose up to 10 photos.');
      }
      
      if (files.length === 0 && !editingId) {
        return alert('Please select at least one photo.');
      }

      try {
        const uploaded = files.length ? await Promise.all(files.map(uploadImage)) : [];
        const portfolioData = {
          title: String(data.get('title')).trim(),
          type: String(data.get('type')),
          price: String(data.get('price')).trim(),
          location: String(data.get('location')).trim(),
          description: String(data.get('description')).trim(),
          photos: uploaded.length ? uploaded.map(photo => photo.url) : editingPhotos
        };

        const wasEdit = Boolean(editingId);
        if (editingId) {
          await apiCall(`/broker/portfolio/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(portfolioData)
          });
        } else {
          await apiCall('/broker/portfolio', {
            method: 'POST',
            body: JSON.stringify(portfolioData)
          });
        }

        editingId = null;
        editingPhotos = [];
        form.reset();
        form.querySelector('button').textContent = 'Add to Portfolio';
        document.querySelector('#photoPreview').innerHTML = '';
        await loadBrokerPortfolio();
        alert(wasEdit ? 'Portfolio item updated.' : 'Portfolio item added successfully!');
      } catch (error) {
        alert(error.message || 'Failed to add portfolio item');
      }
    });
  }

  document.querySelectorAll('.side-nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.side-nav a').forEach(item => item.classList.remove('selected'));
      link.classList.add('selected');
    });
  });
})();
