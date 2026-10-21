# StudentStay - Backend + Frontend

A full-stack student housing platform with Flask backend and HTML/CSS/JS frontend.

## Architecture

- **Backend**: Flask API deployed on Render
- **Frontend**: Static HTML/CSS/JS deployed on GitHub Pages
- **Image Storage**: Cloudinary
- **Email**: Flask-Mail (SMTP)
- **Database**: PostgreSQL (Render) / SQLite (local)

## Project Structure

```
New folder (63)/
├── backend/                  # Flask backend
│   ├── app.py               # Main Flask application
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variables template
│   ├── .gitignore          # Git ignore file
│   ├── render.yaml         # Render deployment config
│   ├── Procfile            # Render process configuration
│   ├── setup.py            # Setup verification script
│   └── seed_data.py        # Test accounts seed script
├── frontend/                # Frontend files
│   ├── index.html          # Homepage
│   ├── access.html         # Authentication page
│   ├── admin.html          # Admin dashboard
│   ├── landlord.html       # Landlord dashboard
│   ├── properties.html     # Properties listing page
│   ├── property.html       # Property detail page
│   ├── cities.html         # Cities page
│   ├── style.css           # Main stylesheet
│   ├── portal.css          # Portal-specific styles
│   ├── catalog.css         # Catalog styles
│   ├── property.css        # Property page styles
│   ├── portal-api.js       # Frontend API integration
│   ├── portal.js           # Original localStorage version (backup)
│   ├── script.js           # Main script
│   ├── catalog.js          # Catalog script
│   ├── property.js         # Property script
│   └── sample-data.js      # Sample data
├── README.md               # This file
└── .gitignore             # Git ignore file
```

## Backend Setup (Local Development)

### Prerequisites
- Python 3.8+
- pip

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
```bash
# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

6. Edit `.env` with your configuration:
```env
JWT_SECRET_KEY=your-secret-key-here
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=noreply@studentstay.com
```

### Cloudinary Setup

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard → Settings → API Security
3. Copy your Cloud Name, API Key, and API Secret
4. Add them to your `.env` file

### Email Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Go to Google Account → Security → App Passwords
3. Generate a new app password for "Mail"
4. Use this app password in your `.env` file (not your regular password)

### Run the Backend

```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Seed Test Accounts (Optional)

To create test accounts for all roles:

```bash
python seed_data.py
```

This will create:
- Student: student@test.com / student123
- Landlord: landlord@test.com / landlord123
- Broker: broker@test.com / broker123
- Admin: admin@test.com / admin123

## Frontend Setup (Local Development)

### Update API Base URL

In `frontend/portal-api.js`, update the API_BASE variable:

```javascript
const API_BASE = 'http://localhost:5000/api'; // Local development
// Change to your Render URL when deployed:
// const API_BASE = 'https://your-backend.onrender.com/api';
```

### Run Frontend

Navigate to the frontend directory and start a local server:

```bash
cd frontend

# Using Python
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server
```

Then open `http://localhost:8000` in your browser.

## Deployment

### Backend Deployment on Render

1. **Create a GitHub repository** for the backend:
   - Initialize git in the backend folder
   - Push to GitHub

2. **Set up Cloudinary** (if not already done):
   - Get your Cloudinary credentials
   - Keep them secure

3. **Deploy to Render**:
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will detect `render.yaml` automatically
   - Set the following environment variables in Render dashboard:
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`
     - `MAIL_SERVER`
     - `MAIL_PORT`
     - `MAIL_USE_TLS`
     - `MAIL_USERNAME`
     - `MAIL_PASSWORD`
     - `MAIL_DEFAULT_SENDER`
   - Render will automatically set up PostgreSQL and `JWT_SECRET_KEY`

4. **Copy your Render URL**:
   - After deployment, Render will give you a URL like `https://studentstay-backend.onrender.com`
   - Copy this URL for the frontend configuration

### Frontend Deployment on GitHub Pages

1. **Create a GitHub repository** for the frontend:
   - Initialize git in the frontend folder
   - Push all files to GitHub

2. **Update API_BASE in frontend/portal-api.js**:
   ```javascript
   const API_BASE = 'https://your-backend.onrender.com/api';
   ```

3. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: main (or master)
   - Folder: / (root)
   - Click Save

4. **Access your site**:
   - GitHub will provide a URL like `https://yourusername.github.io/repository-name/`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (requires JWT)

### Listings
- `GET /api/listings` - Get all listings
- `POST /api/listings` - Create listing (requires JWT, landlord only)
- `DELETE /api/listings/<id>` - Delete listing (requires JWT, owner only)
- `GET /api/listings/landlord` - Get landlord's listings (requires JWT)

### Image Upload
- `POST /api/upload` - Upload image to Cloudinary (requires JWT)

### Requests
- `POST /api/requests` - Create rental request (requires JWT, student only)
- `GET /api/requests/student` - Get student's requests (requires JWT)
- `GET /api/requests/landlord` - Get landlord's requests (requires JWT)

### Profile
- `PUT /api/profile` - Update user profile (requires JWT)

### Admin
- `GET /api/admin/users` - Get all users (requires JWT, admin only)
- `GET /api/admin/stats` - Get platform statistics (requires JWT, admin only)

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET_KEY` | Secret key for JWT tokens | Yes |
| `DATABASE_URL` | Database connection string | Yes (auto-set on Render) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `MAIL_SERVER` | SMTP server address | Yes |
| `MAIL_PORT` | SMTP port | Yes |
| `MAIL_USE_TLS` | Use TLS for email | Yes |
| `MAIL_USERNAME` | Email username | Yes |
| `MAIL_PASSWORD` | Email password/app password | Yes |
| `MAIL_DEFAULT_SENDER` | Default sender email | Yes |

## Testing

### Test Backend
```bash
# Test signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123","role":"student"}'

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","role":"student"}'
```

### Test Frontend
1. Open `access.html` in browser
2. Create a new account
3. Sign in and explore the features

## Troubleshooting

### Backend won't start
- Check if port 5000 is already in use
- Verify all environment variables are set in `.env`
- Check Python version (3.8+ required)

### Email not sending
- Verify Gmail app password (not regular password)
- Check `MAIL_USE_TLS` is set to `True`
- Ensure firewall allows SMTP traffic

### Image upload fails
- Verify Cloudinary credentials are correct
- Check if Cloudinary account has storage available
- Ensure file is an image (not video)

### Frontend can't connect to backend
- Check API_BASE URL in `portal-api.js`
- Verify backend is running
- Check CORS is enabled (it is by default in app.py)

## Security Notes

- Never commit `.env` file to version control
- Use strong, unique passwords for all services
- Enable HTTPS in production (Render does this automatically)
- Change `JWT_SECRET_KEY` in production
- Use app-specific passwords for email, not regular passwords

## License

This project is for educational purposes.
