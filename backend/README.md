# StudentStay Backend

Flask API backend for StudentStay platform.

## Features

- JWT Authentication
- User management (students, landlords, admin)
- Property listings CRUD
- Rental request system
- Cloudinary image upload
- Email notifications
- PostgreSQL database

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:
- Cloudinary API credentials
- Email SMTP settings
- JWT secret key

4. Run setup script:
```bash
python setup.py
```

5. Seed test accounts (optional):
```bash
python seed_data.py
```
This will create test accounts for all roles:
- Student: student@test.com / student123
- Landlord: landlord@test.com / landlord123
- Broker: broker@test.com / broker123
- Admin: admin@test.com / admin123

6. Start the server:
```bash
python app.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Listings
- `GET /api/listings` - Get all listings
- `POST /api/listings` - Create listing (landlord only)
- `DELETE /api/listings/<id>` - Delete listing (owner only)
- `GET /api/listings/landlord` - Get landlord's listings

### Images
- `POST /api/upload` - Upload image to Cloudinary

### Requests
- `POST /api/requests` - Create rental request (student only)
- `GET /api/requests/student` - Get student's requests
- `GET /api/requests/landlord` - Get landlord's requests

### Profile
- `PUT /api/profile` - Update user profile

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `GET /api/admin/stats` - Get platform statistics (admin only)

## Deployment

This backend is configured for Render deployment via `render.yaml`.

1. Push to GitHub
2. Connect repository to Render
3. Set environment variables in Render dashboard
4. Deploy

Render will automatically:
- Set up PostgreSQL database
- Install dependencies
- Start the web service
