# Testing Guide - StudentStay

## Quick Start

### 1. Start the Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows

# source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
cp .env.example .env

# Edit .env with your Cloudinary and email credentials
python setup.py
python seed_data.py  # Creates test accounts
python app.py
```

Backend will run on `http://localhost:5000`

### 2. Start the Frontend

```bash
cd frontend
python -m http.server 8000
```

Frontend will run on `http://localhost:8000`

### 3. Open in Browser

Navigate to `http://localhost:8000` and click "Login" or "Sign Up"

## Test Accounts

After running `python seed_data.py`, you can use these accounts:

### Student Account
- **Email**: student@test.com
- **Password**: student123
- **Role**: Student
- **Features**: Browse properties, request rooms, view requests

### Landlord Account
- **Email**: landlord@test.com
- **Password**: landlord123
- **Role**: Landlord
- **Features**: Manage profile, add listings, view student requests

### Broker Account
- **Email**: broker@test.com
- **Password**: broker123
- **Role**: Broker
- **Features**: Manage profile, set location, upload portfolio photos

### Admin Account
- **Email**: admin@test.com
- **Password**: admin123
- **Role**: Admin
- **Features**: View all users, view all listings, platform statistics

## Testing Each Role

### 1. Test Student
1. Go to `http://localhost:8000/access.html`
2. Click "Sign in"
3. Select "Student" role
4. Enter: student@test.com / student123
5. Click "Sign in as Student"
6. Browse properties and request rooms

### 2. Test Landlord
1. Sign out
2. Go to `http://localhost:8000/access.html`
3. Click "Sign in"
4. Select "Landlord" role
5. Enter: landlord@test.com / landlord123
6. Click "Sign in as Landlord"
7. Add listings and manage profile

### 3. Test Broker
1. Sign out
2. Go to `http://localhost:8000/access.html`
3. Click "Sign in"
4. Select "Broker" role
5. Enter: broker@test.com / broker123
6. Click "Sign in as Broker"
7. Update profile, set location, upload portfolio photos

### 4. Test Admin
1. Sign out
2. Go to `http://localhost:8000/access.html`
3. Click "Sign in"
4. Select "Admin" role
5. Enter: admin@test.com / admin123
6. Click "Sign in as Admin"
7. View users, listings, and statistics

## Creating New Accounts

You can also create new accounts by:
1. Clicking "Create account" on the login page
2. Select your role (Student, Landlord, Broker, or Admin)
3. Fill in the required fields
4. Click the submit button

## Troubleshooting

### Backend won't start
- Check if port 5000 is already in use
- Verify `.env` file exists and has correct values
- Run `python setup.py` to verify configuration

### Can't login
- Make sure backend is running on `http://localhost:5000`
- Check if seed data was created: `python seed_data.py`
- Verify email and password are correct

### Images won't upload
- Check Cloudinary credentials in `.env`
- Verify Cloudinary account has storage available
- Ensure file is an image (not video)

### Frontend can't connect to backend
- Check API_BASE in `frontend/portal-api.js` is set to `http://localhost:5000/api`
- Verify backend is running
- Check browser console for errors

## API Endpoints for Testing

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Broker
- `GET /api/broker/profile` - Get broker profile
- `PUT /api/broker/profile` - Update broker profile
- `GET /api/broker/location` - Get broker location
- `PUT /api/broker/location` - Update broker location
- `GET /api/broker/portfolio` - Get broker portfolio
- `POST /api/broker/portfolio` - Add portfolio item
- `DELETE /api/broker/portfolio/<id>` - Delete portfolio item

### Landlord
- `GET /api/listings` - Get all listings
- `POST /api/listings` - Create listing
- `DELETE /api/listings/<id>` - Delete listing
- `GET /api/listings/landlord` - Get landlord's listings

### Student
- `POST /api/requests` - Create rental request
- `GET /api/requests/student` - Get student's requests

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/stats` - Get platform statistics

### Common
- `POST /api/upload` - Upload image to Cloudinary
- `PUT /api/profile` - Update user profile
