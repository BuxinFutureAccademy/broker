from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_mail import Mail, Message
from flask_sqlalchemy import SQLAlchemy
from datetime import timedelta
import cloudinary
import cloudinary.uploader
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

DEMO_USERS = [
    {'name': 'Test Student', 'email': 'student@test.com', 'password': 'student123', 'role': 'student', 'phone': '+91 98765 43210', 'city': 'Delhi'},
    {'name': 'Test Landlord', 'email': 'landlord@test.com', 'password': 'landlord123', 'role': 'landlord', 'phone': '+91 98765 43211', 'city': 'Noida', 'address': 'Sector 62, Noida'},
    {'name': 'Test Broker', 'email': 'broker@test.com', 'password': 'broker123', 'role': 'broker', 'phone': '+91 98765 43212', 'city': 'Bangalore'},
    {'name': 'Test Admin', 'email': 'admin@test.com', 'password': 'admin123', 'role': 'admin', 'phone': '+91 98765 43213', 'city': 'Mumbai'},
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

# Initialize database
with app.app_context():
    db.create_all()
    ensure_demo_users()

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
    elif data['role'] == 'broker':
        send_email(
            data['email'],
            'Welcome to StudentStay - Broker Account',
            f'<h1>Welcome to StudentStay!</h1><p>Hi {data["name"]},</p><p>Your broker account has been created successfully. You can now upload your portfolio and connect with students.</p><p>Best regards,<br>StudentStay Team</p>'
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
    
    if user.role != data['role']:
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
    listings = Listing.query.all()
    return jsonify([{
        'id': l.id,
        'ownerId': l.owner_id,
        'ownerName': l.owner_name,
        'title': l.title,
        'type': l.type,
        'rent': l.rent,
        'available': l.available,
        'address': l.address,
        'city': l.city,
        'description': l.description,
        'photos': l.photos,
        'created': l.created.isoformat()
    } for l in listings])

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
        city=user.city,
        description=data['description'],
        photos=data.get('photos', [])
    )
    
    db.session.add(new_listing)
    db.session.commit()
    
    return jsonify({'message': 'Listing created successfully', 'id': new_listing.id}), 201

@app.route('/api/listings/<listing_id>', methods=['DELETE'])
@jwt_required()
def delete_listing(listing_id):
    user_id = get_jwt_identity()
    listing = Listing.query.get(listing_id)
    
    if not listing:
        return jsonify({'error': 'Listing not found'}), 404
    
    if listing.owner_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(listing)
    db.session.commit()
    
    return jsonify({'message': 'Listing deleted successfully'})

@app.route('/api/listings/landlord', methods=['GET'])
@jwt_required()
def get_landlord_listings():
    user_id = get_jwt_identity()
    listings = Listing.query.filter_by(owner_id=user_id).all()
    
    return jsonify([{
        'id': l.id,
        'ownerId': l.owner_id,
        'ownerName': l.owner_name,
        'title': l.title,
        'type': l.type,
        'rent': l.rent,
        'available': l.available,
        'address': l.address,
        'city': l.city,
        'description': l.description,
        'photos': l.photos,
        'created': l.created.isoformat()
    } for l in listings])

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
    
    data = request.get_json()
    
    # Check if request already exists
    existing = Request.query.filter_by(
        listing_id=data['listing_id'],
        student_id=user_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Request already exists'}), 400
    
    import uuid
    new_request = Request(
        id=str(uuid.uuid4()),
        listing_id=data['listing_id'],
        student_id=user_id,
        status='New request'
    )
    
    db.session.add(new_request)
    db.session.commit()
    
    # Notify landlord via email
    listing = Listing.query.get(data['listing_id'])
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
    
    return jsonify([{
        'id': u.id,
        'name': u.name,
        'email': u.email,
        'role': u.role,
        'phone': u.phone,
        'city': u.city,
        'joined': u.joined.isoformat() if u.joined else None
    } for u in users])

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
            experience=data.get('experience', 0),
            specialization=data.get('specialization', ''),
            bio=data.get('bio', '')
        )
        db.session.add(profile)
    else:
        profile.license = data.get('license', profile.license)
        profile.company = data.get('company', profile.company)
        profile.experience = data.get('experience', profile.experience)
        profile.specialization = data.get('specialization', profile.specialization)
        profile.bio = data.get('bio', profile.bio)
    
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
            radius=data.get('radius', 10),
            hours=data.get('hours', '')
        )
        db.session.add(location)
    else:
        location.city = data.get('city', location.city)
        location.area = data.get('area', location.area)
        location.address = data.get('address', location.address)
        location.radius = data.get('radius', location.radius)
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
