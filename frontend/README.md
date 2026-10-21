# StudentStay Frontend

This folder contains the frontend for StudentStay - a student housing platform.

## Files

- `index.html` - Homepage
- `access.html` - Authentication (login/signup)
- `admin.html` - Admin dashboard
- `landlord.html` - Landlord dashboard
- `properties.html` - Properties listing
- `property.html` - Property details
- `cities.html` - Cities page
- `style.css` - Main stylesheet
- `portal.css` - Portal-specific styles
- `catalog.css` - Catalog styles
- `property.css` - Property page styles
- `portal-api.js` - API integration (connects to Flask backend)
- `portal.js` - LocalStorage version (backup/demo)
- `script.js` - Main script
- `catalog.js` - Catalog script
- `property.js` - Property script
- `sample-data.js` - Sample data

## Configuration

Before running, update the API_BASE in `portal-api.js`:

```javascript
const API_BASE = 'http://localhost:5000/api'; // Local development
// Change to: const API_BASE = 'https://your-backend.onrender.com/api'; // Production
```

## Running Locally

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server
```

Then open `http://localhost:8000` in your browser.

## Deployment

1. Push this folder to GitHub
2. Enable GitHub Pages in repository settings
3. Your site will be available at `https://yourusername.github.io/repository-name/`
