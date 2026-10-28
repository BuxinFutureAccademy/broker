from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_mail import Mail, Message
from flask_sqlalchemy import SQLAlchemy
from datetime import timedelta
import cloudinary
import cloudinary.uploader
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
database_url = os.getenv('DATABASE_URL', 'sqlite:///studentstay.db')
# Ensure psycopg3 driver is used for PostgreSQL
if database_url.startswith('postgresql://'):
    database_url = database_url.replace('postgresql://', 'postgresql+psycopg://')
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Email configuration
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() in ['true', '1']
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@studentstay.com')
app.config['MAIL_TIMEOUT'] = 5

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

jwt = JWTManager(app)
mail = Mail(app)
db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # student, landlord, admin, broker
    phone = db.Column(db.String(20))
    city = db.Column(db.String(50))
    address = db.Column(db.Text)
    joined = db.Column(db.DateTime, default=db.func.current_timestamp())

class BrokerProfile(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    license = db.Column(db.String(50))
    company = db.Column(db.String(100))
    experience = db.Column(db.Integer)
    specialization = db.Column(db.String(200))
    bio = db.Column(db.Text)
    updated = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

class BrokerLocation(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False, unique=True)
    city = db.Column(db.String(50), nullable=False)
    area = db.Column(db.String(100))
    address = db.Column(db.Text, nullable=False)
    radius = db.Column(db.Integer, default=10)
    hours = db.Column(db.String(100))
    updated = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

class BrokerPortfolio(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    broker_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    price = db.Column(db.String(50))
    location = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    photos = db.Column(db.JSON)
    created = db.Column(db.DateTime, default=db.func.current_timestamp())

class Listing(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    owner_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    owner_name = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    rent = db.Column(db.Integer, nullable=False)
    available = db.Column(db.String(20))
    address = db.Column(db.String(200), nullable=False)
    sector = db.Column(db.String(80))
    city = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    photos = db.Column(db.JSON)  # Array of Cloudinary URLs
    created = db.Column(db.DateTime, default=db.func.current_timestamp())

class Request(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    listing_id = db.Column(db.String(36), db.ForeignKey('listing.id'), nullable=False)
    student_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    created = db.Column(db.DateTime, default=db.func.current_timestamp())
    status = db.Column(db.String(50), default='New request')

class PaymentSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Integer, default=2000)
    qr_url = db.Column(db.Text)
    note = db.Column(db.Text, default='Pay the broker fee, then upload a clear photo of your receipt.')
    contact_name = db.Column(db.String(80))
    contact_phone = db.Column(db.String(30))
    contact_email = db.Column(db.String(120))
    contacts = db.Column(db.Text)

class Unlock(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    student_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    listing_id = db.Column(db.String(36), db.ForeignKey('listing.id'), nullable=False)
    receipt_url = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='pending')
    note = db.Column(db.Text)
    created = db.Column(db.DateTime, default=db.func.current_timestamp())

DEMO_USERS = [
    {'name': 'Test Student', 'email': 'student@test.com', 'password': 'student123', 'role': 'student', 'phone': '+91 98765 43210', 'city': 'Greater Noida'},
    {'name': 'Test Landlord', 'email': 'landlord@test.com', 'password': 'landlord123', 'role': 'landlord', 'phone': '+91 98765 43211', 'city': 'Greater Noida', 'address': 'Greater Noida'},
    {'name': 'Test Admin', 'email': 'admin@test.com', 'password': 'admin123', 'role': 'admin', 'phone': '+91 98765 43213', 'city': 'Greater Noida'},
]

def ensure_demo_users():
    """Keep the accounts printed on the sign-in page available."""
    import bcrypt
    import uuid
    for user_data in DEMO_USERS:
        try:
            hashed = bcrypt.hashpw(user_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            existing = User.query.filter_by(email=user_data['email']).first()
            if existing:
                existing.name = user_data['name']
                existing.password = hashed
                existing.role = user_data['role']
                existing.phone = user_data.get('phone', '')
                existing.city = user_data.get('city', '')
                existing.address = user_data.get('address', '')
            else:
                db.session.add(User(
                    id=str(uuid.uuid4()),
                    name=user_data['name'],
                    email=user_data['email'],
                    password=hashed,
                    role=user_data['role'],
                    phone=user_data.get('phone', ''),
                    city=user_data.get('city', ''),
                    address=user_data.get('address', '')
                ))
            db.session.commit()
        except Exception:
            db.session.rollback()
            app.logger.exception('Could not ensure demo user %s', user_data['email'])

DEMO_LISTINGS = [
    {
        'title': 'Single Room in PG',
        'type': 'Private room',
        'rent': 8000,
        'available': '2026-11-01',
        'address': 'Tower C, Galaxy Apartments, Gamma 1, Greater Noida',
        'sector': 'Gamma 1',
        'city': 'Greater Noida',
        'description': 'Bright private room with WiFi, AC and meals available.',
        'photos': ['https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1000&q=85'],
    },
    {
        'title': 'Shared Room (2 Students)',
        'type': 'Shared room',
        'rent': 6500,
        'available': '2026-11-01',
        'address': 'House 18, Alpha 1, Greater Noida',
        'sector': 'Alpha 1',
        'city': 'Greater Noida',
        'description': 'Comfortable shared room close to shops and transit.',
        'photos': ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=85'],
    },
    {
        'title': '1 BHK Apartment',
        'type': 'Apartment',
        'rent': 12000,
        'available': '2026-11-01',
        'address': 'Block B, Knowledge Park 3, Greater Noida',
        'sector': 'Knowledge Park 3',
        'city': 'Greater Noida',
        'description': 'Modern apartment with kitchen and easy campus access.',
        'photos': ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85'],
    },
]

def clear_demo_listings():
    """Remove the sample rooms so only homes a landlord posts remain."""
    titles = [item['title'] for item in DEMO_LISTINGS]
    rows = Listing.query.filter(Listing.title.in_(titles)).all()
    for listing in rows:
        Unlock.query.filter_by(listing_id=listing.id).delete()
        Request.query.filter_by(listing_id=listing.id).delete()
        db.session.delete(listing)
    if rows:
        db.session.commit()

def clean_int(value, fallback=0):
    if value is None or value == '':
        return fallback
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback

def viewer_from_request():
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        return User.query.get(user_id) if user_id else None
    except Exception:
        return None

def unlock_maps(viewer):
    approved, pending = set(), set()
    if viewer and viewer.role == 'student':
        for row in Unlock.query.filter_by(student_id=viewer.id).all():
            if row.status == 'approved':
                approved.add(row.listing_id)
            elif row.status == 'pending':
                pending.add(row.listing_id)
    return approved, pending

def serialize_listing(listing, viewer=None, approved=None, pending=None):
    owner = User.query.get(listing.owner_id)
    approved = approved or set()
    pending = pending or set()
    is_owner = bool(viewer and viewer.id == listing.owner_id)
    is_admin = bool(viewer and viewer.role == 'admin')
    is_unlocked = is_owner or is_admin or listing.id in approved
    area = listing.sector or listing.city or 'Greater Noida'
    status = ''
    if viewer and viewer.role == 'student':
        if listing.id in approved:
            status = 'approved'
        elif listing.id in pending:
            status = 'pending'
    data = {
        'id': listing.id,
        'ownerId': listing.owner_id,
        'ownerName': listing.owner_name if is_unlocked else 'Landlord',
        'title': listing.title,
        'type': listing.type,
        'rent': listing.rent,
        'brokerFee': int(listing.rent or 0) // 2,
        'available': listing.available,
        'sector': area,
        'city': listing.city or 'Greater Noida',
        'description': listing.description,
        'photos': listing.photos,
        'unlocked': is_unlocked,
        'unlockStatus': status,
        'created': listing.created.isoformat() if listing.created else None,
    }
    if is_unlocked:
        broker = broker_contact()
        data['address'] = listing.address
        data['ownerPhone'] = owner.phone if owner else ''
        data['ownerEmail'] = owner.email if owner else ''
        data['brokerName'] = broker['name']
        data['brokerPhone'] = broker['phone']
        data['brokerEmail'] = broker['email']
    return data

def ensure_schema():
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    if 'listing' in tables:
        columns = {column['name'] for column in inspector.get_columns('listing')}
        if 'sector' not in columns:
            db.session.execute(text('ALTER TABLE listing ADD COLUMN sector VARCHAR(80)'))
            db.session.commit()
    if 'payment_setting' in tables:
        columns = {column['name'] for column in inspector.get_columns('payment_setting')}
        for name, kind in (('contact_name', 'VARCHAR(80)'), ('contact_phone', 'VARCHAR(30)'), ('contact_email', 'VARCHAR(120)'), ('contacts', 'TEXT')):
            if name not in columns:
                db.session.execute(text(f'ALTER TABLE payment_setting ADD COLUMN {name} {kind}'))
                db.session.commit()

# Initialize database
with app.app_context():
    db.create_all()
    ensure_schema()
    ensure_demo_users()
    clear_demo_listings()

# Helper function for sending emails. Signup and requests must still succeed
# when SMTP is not configured on the server.
def send_email(to, subject, template):
    if not app.config.get('MAIL_USERNAME') or not app.config.get('MAIL_PASSWORD'):
        return
    try:
        msg = Message(
            subject,
            recipients=[to],
            html=template
        )
        mail.send(msg)
    except Exception:
        app.logger.exception('Email could not be sent to %s', to)

# Auth Routes
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    
    if data.get('role') not in ('student', 'landlord'):
        return jsonify({'error': 'Create a student or landlord account. The admin handles the broker fee.'}), 400

    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    # Create new user
    import bcrypt
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    import uuid
    new_user = User(
        id=str(uuid.uuid4()),
        name=data['name'],
        email=data['email'],
        password=hashed_password,
        role=data['role'],
        phone=data.get('phone', ''),
        city=data.get('city', ''),
        address=data.get('address', '')
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    # Send welcome email
    if data['role'] == 'landlord':
        send_email(
            data['email'],
            'Welcome to StudentStay - Landlord Account',
            f'<h1>Welcome to StudentStay!</h1><p>Hi {data["name"]},</p><p>Your landlord account has been created successfully. You can now start listing your properties.</p><p>Best regards,<br>StudentStay Team</p>'
        )
    else:
        send_email(
            data['email'],
            'Welcome to StudentStay',
            f'<h1>Welcome to StudentStay!</h1><p>Hi {data["name"]},</p><p>Your account has been created successfully. Start browsing properties to find your perfect home.</p><p>Best regards,<br>StudentStay Team</p>'
        )
    
    access_token = create_access_token(identity=new_user.id)
    
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': new_user.id,
            'name': new_user.name,
            'email': new_user.email,
            'role': new_user.role,
            'phone': new_user.phone,
            'city': new_user.city
        }
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    import bcrypt
    if not bcrypt.checkpw(data['password'].encode('utf-8'), user.password.encode('utf-8')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if user.role == 'broker' or data.get('role') == 'broker':
        return jsonify({'error': 'Broker accounts are closed. Sign in as a student or a landlord. The admin handles the broker fee.'}), 403

    # The admin can sign in from the student or landlord form. There is no admin button.
    if user.role != data.get('role') and user.role != 'admin':
        return jsonify({'error': 'Account type mismatch'}), 401
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'role': user.role,
            'phone': user.phone,
            'city': user.city,
            'address': user.address
        }
    })

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'phone': user.phone,
        'city': user.city,
        'address': user.address
    })

# Listing Routes
@app.route('/api/listings', methods=['GET'])
def get_listings():
    viewer = viewer_from_request()
    approved, pending = unlock_maps(viewer)
    listings = Listing.query.order_by(Listing.created.desc()).all()
    return jsonify([serialize_listing(listing, viewer, approved, pending) for listing in listings])

@app.route('/api/listings', methods=['POST'])
@jwt_required()
def create_listing():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'landlord':
        return jsonify({'error': 'Only landlords can create listings'}), 403
    
    data = request.get_json()
    
    import uuid
    new_listing = Listing(
        id=str(uuid.uuid4()),
        owner_id=user_id,
        owner_name=user.name,
        title=data['title'],
        type=data['type'],
        rent=data['rent'],
        available=data.get('available', ''),
        address=data['address'],
        sector=data.get('sector') or '',
        city=data.get('city') or 'Greater Noida',
        description=data['description'],
        photos=data.get('photos', [])
    )
    
    db.session.add(new_listing)
    db.session.commit()
    
    return jsonify({'message': 'Listing created successfully', 'id': new_listing.id}), 201

@app.route('/api/listings/<listing_id>', methods=['PUT'])
@jwt_required()
def update_listing(listing_id):
    user = User.query.get(get_jwt_identity())
    listing = Listing.query.get(listing_id)
    if not user or user.role != 'landlord':
        return jsonify({'error': 'Only landlords can edit a room'}), 403
    if not listing or listing.owner_id != user.id:
        return jsonify({'error': 'That room was not found'}), 404
    data = request.get_json() or {}
    listing.title = data.get('title') or listing.title
    listing.type = data.get('type') or listing.type
    listing.rent = clean_int(data.get('rent'), listing.rent or 0)
    listing.available = data.get('available', listing.available)
    listing.address = data.get('address') or listing.address
    listing.sector = data.get('sector') or listing.sector
    listing.description = data.get('description') or listing.description
    photos = data.get('photos') or []
    if photos:
        listing.photos = photos
    db.session.commit()
    return jsonify(serialize_listing(listing, user))

@app.route('/api/listings/<listing_id>', methods=['DELETE'])
@jwt_required()
def delete_listing(listing_id):
    user_id = get_jwt_identity()
    listing = Listing.query.get(listing_id)
    
    if not listing:
        return jsonify({'error': 'Listing not found'}), 404
    
    if listing.owner_id != user_id:
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403

    Unlock.query.filter_by(listing_id=listing.id).delete()
    Request.query.filter_by(listing_id=listing.id).delete()
    db.session.delete(listing)
    db.session.commit()
    
    return jsonify({'message': 'Listing deleted successfully'})

@app.route('/api/listings/landlord', methods=['GET'])
@jwt_required()
def get_landlord_listings():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    listings = Listing.query.filter_by(owner_id=user_id).all()
    return jsonify([serialize_listing(listing, user) for listing in listings])

# Image Upload Route
@app.route('/api/upload', methods=['POST'])
@jwt_required()
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        upload_result = cloudinary.uploader.upload(file)
        return jsonify({
            'url': upload_result['secure_url'],
            'public_id': upload_result['public_id']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Request Routes
@app.route('/api/requests', methods=['POST'])
@jwt_required()
def create_request():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'student':
        return jsonify({'error': 'Only students can make requests'}), 403
    
    data = request.get_json() or {}
    listing_id = data.get('listing_id') or data.get('listingId')
    if not listing_id:
        return jsonify({'error': 'Choose a home to request'}), 400

    listing = Listing.query.get(listing_id)
    if not listing:
        return jsonify({'error': 'That home is no longer listed'}), 404
    
    # Check if request already exists
    existing = Request.query.filter_by(
        listing_id=listing_id,
        student_id=user_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Request already exists'}), 400
    
    import uuid
    new_request = Request(
        id=str(uuid.uuid4()),
        listing_id=listing_id,
        student_id=user_id,
        status='New request'
    )
    
    db.session.add(new_request)
    db.session.commit()
    
    # Notify landlord via email
    landlord = User.query.get(listing.owner_id)
    
    if landlord:
        send_email(
            landlord.email,
            'New Student Request for Your Property',
            f'<h1>New Student Request</h1><p>Hi {landlord.name},</p><p>A student has requested to rent your property: <strong>{listing.title}</strong></p><p>You can view all requests in your landlord dashboard.</p><p>Best regards,<br>StudentStay Team</p>'
        )
    
    return jsonify({'message': 'Request created successfully', 'id': new_request.id}), 201

@app.route('/api/requests/student', methods=['GET'])
@jwt_required()
def get_student_requests():
    user_id = get_jwt_identity()
    requests = Request.query.filter_by(student_id=user_id).all()
    
    result = []
    for req in requests:
        listing = Listing.query.get(req.listing_id)
        result.append({
            'id': req.id,
            'listingId': req.listing_id,
            'studentId': req.student_id,
            'created': req.created.isoformat(),
            'status': req.status,
            'listing': {
                'title': listing.title if listing else 'Listing removed',
                'address': listing.address if listing else '',
                'rent': listing.rent if listing else 0
            }
        })
    
    return jsonify(result)

@app.route('/api/requests/landlord', methods=['GET'])
@jwt_required()
def get_landlord_requests():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'landlord':
        return jsonify({'error': 'Only landlords can view requests'}), 403
    
    listings = Listing.query.filter_by(owner_id=user_id).all()
    listing_ids = [l.id for l in listings]
    requests = Request.query.filter(Request.listing_id.in_(listing_ids)).all()
    
    result = []
    for req in requests:
        student = User.query.get(req.student_id)
        listing = Listing.query.get(req.listing_id)
        result.append({
            'id': req.id,
            'listingId': req.listing_id,
            'studentId': req.student_id,
            'created': req.created.isoformat(),
            'status': req.status,
            'student': {
                'name': student.name if student else 'Student',
                'email': student.email if student else '',
                'phone': student.phone if student else ''
            },
            'listing': {
                'title': listing.title if listing else 'Property'
            }
        })
    
    return jsonify(result)

# Profile Routes
@app.route('/api/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    user.name = data.get('name', user.name)
    user.phone = data.get('phone', user.phone)
    user.city = data.get('city', user.city)
    user.address = data.get('address', user.address)
    email = str(data.get('email') or '').strip().lower()
    if email and email != user.email:
        if User.query.filter_by(email=email).first():
            db.session.rollback()
            return jsonify({'error': 'Email already registered'}), 400
        user.email = email
    
    db.session.commit()
    
    return jsonify({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'phone': user.phone,
        'city': user.city,
        'address': user.address
    })

# Admin Routes
@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def get_all_users():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    users = User.query.all()
    profiles = {profile.user_id: profile for profile in BrokerProfile.query.all()}
    locations = {location.user_id: location for location in BrokerLocation.query.all()}

    result = []
    for u in users:
        profile = profiles.get(u.id)
        location = locations.get(u.id)
        result.append({
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'role': u.role,
            'phone': u.phone,
            'city': u.city,
            'address': u.address,
            'joined': u.joined.isoformat() if u.joined else None,
            'license': profile.license if profile else '',
            'company': profile.company if profile else '',
            'experience': profile.experience if profile else '',
            'specialization': profile.specialization if profile else '',
            'bio': profile.bio if profile else '',
            'area': location.area if location else '',
            'serviceAddress': location.address if location else '',
            'hours': location.hours if location else '',
        })
    return jsonify(result)

@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
@jwt_required()
def delete_user_account(user_id):
    admin = User.query.get(get_jwt_identity())
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    person = User.query.get(user_id)
    if not person:
        return jsonify({'error': 'Account not found'}), 404
    if person.role == 'admin' or person.id == admin.id:
        return jsonify({'error': 'The admin account stays.'}), 400
    if person.role == 'landlord':
        for listing in Listing.query.filter_by(owner_id=person.id).all():
            Unlock.query.filter_by(listing_id=listing.id).delete()
            Request.query.filter_by(listing_id=listing.id).delete()
            db.session.delete(listing)
    Unlock.query.filter_by(student_id=person.id).delete()
    Request.query.filter_by(student_id=person.id).delete()
    BrokerProfile.query.filter_by(user_id=person.id).delete()
    BrokerLocation.query.filter_by(user_id=person.id).delete()
    BrokerPortfolio.query.filter_by(broker_id=person.id).delete()
    db.session.delete(person)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

@app.route('/api/admin/stats', methods=['GET'])
@jwt_required()
def get_admin_stats():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    total_users = User.query.count()
    landlords = User.query.filter_by(role='landlord').count()
    students = User.query.filter_by(role='student').count()
    brokers = User.query.filter_by(role='broker').count()
    listings = Listing.query.count()
    
    return jsonify({
        'total_users': total_users,
        'landlords': landlords,
        'students': students,
        'brokers': brokers,
        'listings': listings
    })

# Broker Routes
@app.route('/api/broker/profile', methods=['GET'])
@jwt_required()
def get_broker_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    
    profile = BrokerProfile.query.filter_by(user_id=user_id).first()
    
    if profile:
        return jsonify({
            'name': user.name,
            'email': user.email,
            'phone': user.phone,
            'license': profile.license,
            'company': profile.company,
            'experience': profile.experience,
            'specialization': profile.specialization,
            'bio': profile.bio
        })
    else:
        return jsonify({
            'name': user.name,
            'email': user.email,
            'phone': user.phone,
            'license': '',
            'company': '',
            'experience': '',
            'specialization': '',
            'bio': ''
        })

@app.route('/api/broker/profile', methods=['PUT'])
@jwt_required()
def update_broker_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    
    data = request.get_json()
    
    # Update user basic info
    user.name = data.get('name', user.name)
    user.phone = data.get('phone', user.phone)
    
    # Update or create broker profile
    profile = BrokerProfile.query.filter_by(user_id=user_id).first()
    
    if not profile:
        import uuid
        profile = BrokerProfile(
            id=str(uuid.uuid4()),
            user_id=user_id,
            license=data.get('license', ''),
            company=data.get('company', ''),
            experience=clean_int(data.get('experience'), 0),
            specialization=data.get('specialization', ''),
            bio=data.get('bio', '')
        )
        db.session.add(profile)
    else:
        profile.license = data.get('license', profile.license)
        profile.company = data.get('company', profile.company)
        profile.experience = clean_int(data.get('experience'), profile.experience or 0)
        profile.specialization = data.get('specialization', profile.specialization)
        profile.bio = data.get('bio', profile.bio)
    email = str(data.get('email') or '').strip().lower()
    if email and email != user.email:
        if User.query.filter_by(email=email).first():
            db.session.rollback()
            return jsonify({'error': 'Email already registered'}), 400
        user.email = email
    
    db.session.commit()
    
    return jsonify({
        'name': user.name,
        'email': user.email,
        'phone': user.phone,
        'license': profile.license,
        'company': profile.company,
        'experience': profile.experience,
        'specialization': profile.specialization,
        'bio': profile.bio
    })

@app.route('/api/broker/location', methods=['GET'])
@jwt_required()
def get_broker_location():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    
    location = BrokerLocation.query.filter_by(user_id=user_id).first()
    
    if location:
        return jsonify({
            'city': location.city,
            'area': location.area,
            'address': location.address,
            'radius': location.radius,
            'hours': location.hours
        })
    else:
        return jsonify({
            'city': '',
            'area': '',
            'address': '',
            'radius': 10,
            'hours': ''
        })

@app.route('/api/broker/location', methods=['PUT'])
@jwt_required()
def update_broker_location():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    
    data = request.get_json()
    
    location = BrokerLocation.query.filter_by(user_id=user_id).first()
    
    if not location:
        import uuid
        location = BrokerLocation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            city=data.get('city', ''),
            area=data.get('area', ''),
            address=data.get('address', ''),
            radius=clean_int(data.get('radius'), 10),
            hours=data.get('hours', '')
        )
        db.session.add(location)
    else:
        location.city = data.get('city', location.city)
        location.area = data.get('area', location.area)
        location.address = data.get('address', location.address)
        location.radius = clean_int(data.get('radius'), location.radius or 10)
        location.hours = data.get('hours', location.hours)
    
    db.session.commit()
    
    return jsonify({
        'city': location.city,
        'area': location.area,
        'address': location.address,
        'radius': location.radius,
        'hours': location.hours
    })

@app.route('/api/broker/portfolio', methods=['GET'])
@jwt_required()
def get_broker_portfolio():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    
    portfolio = BrokerPortfolio.query.filter_by(broker_id=user_id).all()
    
    return jsonify([{
        'id': p.id,
        'title': p.title,
        'type': p.type,
        'price': p.price,
        'location': p.location,
        'description': p.description,
        'photos': p.photos,
        'created': p.created.isoformat()
    } for p in portfolio])

@app.route('/api/broker/portfolio', methods=['POST'])
@jwt_required()
def add_to_broker_portfolio():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    
    data = request.get_json()
    
    import uuid
    new_portfolio = BrokerPortfolio(
        id=str(uuid.uuid4()),
        broker_id=user_id,
        title=data['title'],
        type=data['type'],
        price=data.get('price', ''),
        location=data['location'],
        description=data.get('description', ''),
        photos=data.get('photos', [])
    )
    
    db.session.add(new_portfolio)
    db.session.commit()
    
    return jsonify({'message': 'Portfolio item added successfully', 'id': new_portfolio.id}), 201

@app.route('/api/broker/portfolio/<portfolio_id>', methods=['PUT'])
@jwt_required()
def update_broker_portfolio_item(portfolio_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403

    portfolio = BrokerPortfolio.query.get(portfolio_id)
    if not portfolio:
        return jsonify({'error': 'Portfolio item not found'}), 404
    if portfolio.broker_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    portfolio.title = data.get('title', portfolio.title)
    portfolio.type = data.get('type', portfolio.type)
    portfolio.price = data.get('price', portfolio.price)
    portfolio.location = data.get('location', portfolio.location)
    portfolio.description = data.get('description', portfolio.description)
    if data.get('photos'):
        portfolio.photos = data.get('photos')
    db.session.commit()
    return jsonify({'message': 'Portfolio item updated', 'id': portfolio.id})

@app.route('/api/broker/portfolio/<portfolio_id>', methods=['DELETE'])
@jwt_required()
def delete_broker_portfolio_item(portfolio_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    
    portfolio = BrokerPortfolio.query.get(portfolio_id)
    
    if not portfolio:
        return jsonify({'error': 'Portfolio item not found'}), 404
    
    if portfolio.broker_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(portfolio)
    db.session.commit()
    
    return jsonify({'message': 'Portfolio item deleted successfully'})

def clean_contact_list(items, limit):
    cleaned = []
    for item in items or []:
        text = str(item or '').strip()[:limit]
        if text and text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= 30:
            break
    return cleaned

def stored_contacts(setting):
    raw = {}
    if setting and setting.contacts:
        try:
            raw = json.loads(setting.contacts)
        except (TypeError, ValueError):
            raw = {}
    if not isinstance(raw, dict):
        raw = {}
    return {
        'names': clean_contact_list(raw.get('names'), 80),
        'phones': clean_contact_list(raw.get('phones'), 40),
        'emails': clean_contact_list(raw.get('emails'), 120),
    }

def broker_contact():
    setting = PaymentSetting.query.first()
    admin = User.query.filter_by(role='admin').first()
    return {
        'name': ((setting.contact_name if setting else '') or (admin.name if admin else '') or 'StudentStay'),
        'phone': ((setting.contact_phone if setting else '') or (admin.phone if admin else '') or ''),
        'email': ((setting.contact_email if setting else '') or (admin.email if admin else '') or ''),
    }

def payment_payload():
    setting = PaymentSetting.query.first()
    if not setting:
        setting = PaymentSetting(amount=2000, note='Pay the broker fee, then upload a clear photo of your receipt.')
        db.session.add(setting)
        db.session.commit()
    contact = broker_contact()
    return {
        'amount': setting.amount or 0,
        'qrUrl': setting.qr_url or '',
        'note': setting.note or '',
        'contactName': contact['name'],
        'contactPhone': contact['phone'],
        'contactEmail': contact['email'],
        'contacts': stored_contacts(setting),
    }

@app.route('/api/payment', methods=['GET'])
def get_payment_settings():
    payload = payment_payload()
    viewer = viewer_from_request()
    if viewer and viewer.role == 'admin':
        payload.update({
            'contactName': broker_contact()['name'],
            'contactPhone': broker_contact()['phone'],
            'contactEmail': broker_contact()['email'],
        })
    return jsonify(payload)

@app.route('/api/admin/payment', methods=['PUT'])
@jwt_required()
def update_payment_settings():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json() or {}
    setting = PaymentSetting.query.first()
    if not setting:
        setting = PaymentSetting()
        db.session.add(setting)
    if 'amount' in data:
        setting.amount = clean_int(data.get('amount'), setting.amount or 0)
    if 'qrUrl' in data:
        setting.qr_url = data.get('qrUrl') or ''
    if 'note' in data:
        setting.note = data.get('note') or ''
    if 'contactName' in data:
        setting.contact_name = (data.get('contactName') or '').strip()
    if 'contactPhone' in data:
        setting.contact_phone = (data.get('contactPhone') or '').strip()
    if 'contactEmail' in data:
        setting.contact_email = (data.get('contactEmail') or '').strip()
    if 'contacts' in data:
        incoming = data.get('contacts') or {}
        if not isinstance(incoming, dict):
            incoming = {}
        lists = {
            'names': clean_contact_list(incoming.get('names'), 80),
            'phones': clean_contact_list(incoming.get('phones'), 40),
            'emails': clean_contact_list(incoming.get('emails'), 120),
        }
        setting.contacts = json.dumps(lists)
        if lists['names']:
            setting.contact_name = lists['names'][0]
    db.session.commit()
    return jsonify(payment_payload())

def unlock_payload(row):
    student = User.query.get(row.student_id)
    listing = Listing.query.get(row.listing_id)
    return {
        'id': row.id,
        'status': row.status,
        'note': row.note or '',
        'receiptUrl': row.receipt_url,
        'created': row.created.isoformat() if row.created else None,
        'studentId': row.student_id,
        'ownerId': listing.owner_id if listing else '',
        'ownerName': listing.owner_name if listing else '',
        'student': {
            'name': student.name if student else 'Student',
            'email': student.email if student else '',
            'phone': student.phone if student else '',
        },
        'listing': {
            'id': listing.id if listing else '',
            'title': listing.title if listing else 'Home removed',
            'sector': (listing.sector or listing.city) if listing else '',
            'address': listing.address if listing else '',
            'rent': listing.rent if listing else 0,
            'brokerFee': int(listing.rent or 0) // 2 if listing else 0,
            'photos': (listing.photos or []) if listing else [],
            'ownerName': listing.owner_name if listing else '',
        },
    }

@app.route('/api/unlocks', methods=['POST'])
@jwt_required()
def submit_unlock():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'student':
        return jsonify({'error': 'Sign in as a student before paying the broker fee'}), 403
    data = request.get_json() or {}
    listing_id = data.get('listing_id') or data.get('listingId')
    receipt = (data.get('receipt_url') or data.get('receiptUrl') or '').strip()
    if not listing_id or not receipt:
        return jsonify({'error': 'Upload your payment receipt'}), 400
    if not Listing.query.get(listing_id):
        return jsonify({'error': 'That home is no longer listed'}), 404
    existing = Unlock.query.filter_by(student_id=user.id, listing_id=listing_id).order_by(Unlock.created.desc()).first()
    if existing and existing.status == 'approved':
        return jsonify({'error': 'You already unlocked this home'}), 400
    if existing and existing.status == 'pending':
        existing.receipt_url = receipt
        existing.note = ''
        db.session.commit()
        return jsonify({'message': 'Receipt updated. Waiting for approval.', 'id': existing.id, 'status': 'pending'})
    import uuid
    row = Unlock(id=str(uuid.uuid4()), student_id=user.id, listing_id=listing_id, receipt_url=receipt, status='pending')
    db.session.add(row)
    db.session.commit()
    return jsonify({'message': 'Receipt sent. The admin will approve it.', 'id': row.id, 'status': 'pending'}), 201

@app.route('/api/unlocks/student', methods=['GET'])
@jwt_required()
def student_unlocks():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'student':
        return jsonify({'error': 'Student access required'}), 403
    rows = Unlock.query.filter_by(student_id=user.id).order_by(Unlock.created.desc()).all()
    return jsonify([unlock_payload(row) for row in rows])

@app.route('/api/unlocks/landlord', methods=['GET'])
@jwt_required()
def landlord_unlocks():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'landlord':
        return jsonify({'error': 'Landlord access required'}), 403
    listing_ids = [item.id for item in Listing.query.filter_by(owner_id=user.id).all()]
    rows = Unlock.query.filter(Unlock.listing_id.in_(listing_ids), Unlock.status == 'approved').all() if listing_ids else []
    return jsonify([unlock_payload(row) for row in rows])

@app.route('/api/admin/unlocks', methods=['GET'])
@jwt_required()
def admin_unlocks():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    rows = Unlock.query.order_by(Unlock.created.desc()).all()
    return jsonify([unlock_payload(row) for row in rows])

@app.route('/api/admin/unlocks/<unlock_id>', methods=['PUT'])
@jwt_required()
def decide_unlock(unlock_id):
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    row = Unlock.query.get(unlock_id)
    if not row:
        return jsonify({'error': 'Receipt not found'}), 404
    data = request.get_json() or {}
    status = data.get('status')
    if status not in ('approved', 'rejected', 'pending'):
        return jsonify({'error': 'Choose approve or reject'}), 400
    row.status = status
    row.note = data.get('note') or ''
    db.session.commit()
    return jsonify(unlock_payload(row))

@app.route('/api/admin/unlocks/<unlock_id>', methods=['DELETE'])
@jwt_required()
def delete_unlock(unlock_id):
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    row = Unlock.query.get(unlock_id)
    if not row:
        return jsonify({'error': 'Payment not found'}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({'message': 'Payment deleted'})

@app.route('/api/broker/visits', methods=['GET'])
@jwt_required()
def broker_visits():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'broker':
        return jsonify({'error': 'Broker access required'}), 403
    location = BrokerLocation.query.filter_by(user_id=user.id).first()
    covered = f"{location.area if location else ''} {location.city if location else ''}".lower()
    rows = Unlock.query.filter_by(status='approved').order_by(Unlock.created.desc()).all()
    visits = []
    for row in rows:
        payload = unlock_payload(row)
        sector = (payload['listing'].get('sector') or '').lower()
        if covered.strip() and sector and sector in covered:
            visits.append(payload)
        elif not covered.strip():
            continue
    return jsonify(visits)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
