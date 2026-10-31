from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_mail import Mail
from werkzeug.exceptions import HTTPException
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

@app.errorhandler(Exception)
def handle_unexpected(error):
    if isinstance(error, HTTPException):
        return error
    app.logger.exception('Request failed')
    try:
        db.session.rollback()
    except Exception:
        pass
    return jsonify({'error': 'Something went wrong. Please try again.'}), 500

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
    google_sub = db.Column(db.String(64))

class PhoneCode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), nullable=False, index=True)
    code_hash = db.Column(db.String(64), nullable=False)
    expires = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, default=0)

class PasswordReset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, index=True)
    code_hash = db.Column(db.String(64), nullable=False)
    expires = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, default=0)

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
    taken = db.Column(db.Boolean, default=False)
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

class Business(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    owner_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    description = db.Column(db.Text, default='')
    phone = db.Column(db.String(30), default='')
    whatsapp = db.Column(db.String(30), default='')
    address = db.Column(db.String(200), default='')
    area = db.Column(db.String(80), default='')
    hours = db.Column(db.String(120), default='')
    logo_url = db.Column(db.Text, default='')
    image_url = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='active', index=True)
    created = db.Column(db.DateTime, default=db.func.current_timestamp())

class CatalogItem(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    business_id = db.Column(db.String(36), db.ForeignKey('business.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default='')
    price = db.Column(db.Integer, nullable=False, default=0)
    price_note = db.Column(db.String(80), default='')
    photo_url = db.Column(db.Text, default='')
    category = db.Column(db.String(80), default='')
    available = db.Column(db.Boolean, default=True)
    stock = db.Column(db.Integer)
    created = db.Column(db.DateTime, default=db.func.current_timestamp())

class MarketOrder(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    reference = db.Column(db.String(16), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False, index=True)
    owner_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False, index=True)
    business_id = db.Column(db.String(36), nullable=False, index=True)
    item_id = db.Column(db.String(36), default='')
    kind = db.Column(db.String(20), nullable=False, index=True)
    item_name = db.Column(db.String(120), nullable=False)
    item_description = db.Column(db.Text, default='')
    listed_price = db.Column(db.Integer, nullable=False, default=0)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    listed_total = db.Column(db.Integer, nullable=False, default=0)
    final_amount = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending', index=True)
    customer_confirm = db.Column(db.String(20), default='')
    customer_note = db.Column(db.String(200), default='')
    customer_amount = db.Column(db.Integer)
    commission_rate = db.Column(db.Integer)
    commission_amount = db.Column(db.Integer)
    commission_status = db.Column(db.String(30), default='')
    created = db.Column(db.DateTime, default=db.func.current_timestamp(), index=True)
    updated = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

class MarketAudit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.String(36), nullable=False, index=True)
    actor_id = db.Column(db.String(36), default='')
    action = db.Column(db.String(40), nullable=False)
    note = db.Column(db.String(200), default='')
    created = db.Column(db.DateTime, default=db.func.current_timestamp())

class MarketSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    commission_percent = db.Column(db.Integer, default=10)

class DonorProfile(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False, unique=True, index=True)
    donor_type = db.Column(db.String(20), nullable=False)
    organization = db.Column(db.String(120), default='')
    phone = db.Column(db.String(30), default='')
    city = db.Column(db.String(80), default='')

class Donation(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    reference = db.Column(db.String(16), unique=True, nullable=False, index=True)
    donor_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False, index=True)
    donor_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    purpose = db.Column(db.String(200), default='')
    status = db.Column(db.String(20), default='pledged', index=True)
    created = db.Column(db.DateTime, default=db.func.current_timestamp(), index=True)

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
    sees_house = is_owner or is_admin
    fee_sent = bool(viewer and viewer.role == 'student' and (listing.id in approved or listing.id in pending))
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
        'ownerName': listing.owner_name if sees_house else 'Landlord',
        'title': listing.title,
        'type': listing.type,
        'rent': listing.rent,
        'brokerFee': int(listing.rent or 0) // 2,
        'available': listing.available,
        'sector': area,
        'city': listing.city or 'Greater Noida',
        'description': listing.description,
        'photos': listing.photos,
        'taken': bool(listing.taken),
        'unlocked': sees_house,
        'unlockStatus': status,
        'created': listing.created.isoformat() if listing.created else None,
    }
    if sees_house:
        data['address'] = listing.address
        data['ownerPhone'] = owner.phone if owner else ''
        data['ownerEmail'] = owner.email if owner else ''
    if sees_house or fee_sent:
        broker = broker_contact()
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
        if 'taken' not in columns:
            default = 'FALSE' if db.engine.dialect.name == 'postgresql' else '0'
            db.session.execute(text(f'ALTER TABLE listing ADD COLUMN taken BOOLEAN DEFAULT {default}'))
            db.session.commit()
    if 'payment_setting' in tables:
        columns = {column['name'] for column in inspector.get_columns('payment_setting')}
        for name, kind in (('contact_name', 'VARCHAR(80)'), ('contact_phone', 'VARCHAR(30)'), ('contact_email', 'VARCHAR(120)'), ('contacts', 'TEXT')):
            if name not in columns:
                db.session.execute(text(f'ALTER TABLE payment_setting ADD COLUMN {name} {kind}'))
                db.session.commit()
    if 'market_order' in tables:
        columns = {column['name'] for column in inspector.get_columns('market_order')}
        if 'customer_note' not in columns:
            db.session.execute(text('ALTER TABLE market_order ADD COLUMN customer_note VARCHAR(200)'))
            db.session.commit()
    if 'user' in tables:
        columns = {column['name'] for column in inspector.get_columns('user')}
        if 'google_sub' not in columns:
            db.session.execute(text('ALTER TABLE "user" ADD COLUMN google_sub VARCHAR(64)'))
            db.session.commit()
        try:
            db.session.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_sub ON "user" (google_sub)'))
            db.session.commit()
        except Exception:
            db.session.rollback()
    rented = [row[0] for row in db.session.query(Unlock.listing_id).filter(Unlock.status == 'approved').distinct().all()]
    if rented and 'listing' in tables:
        Listing.query.filter(Listing.id.in_(rented)).update({Listing.taken: True}, synchronize_session=False)
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
    """Send one email and return within about 10 seconds.

    Gmail often closes a bad sign-in, and a blocked SMTP port can sit until the
    host kills the request. Either case must come back as a normal JSON error.
    """
    username = app.config.get('MAIL_USERNAME')
    password = app.config.get('MAIL_PASSWORD')
    if not username or not password:
        return False
    import smtplib
    import threading
    from email.message import EmailMessage
    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = app.config.get('MAIL_DEFAULT_SENDER') or username
    message['To'] = to
    message.set_content('Your Ekvora code is in this email.')
    message.add_alternative(template, subtype='html')
    host = app.config.get('MAIL_SERVER') or 'smtp.gmail.com'
    port = int(app.config.get('MAIL_PORT') or 587)
    use_tls = bool(app.config.get('MAIL_USE_TLS'))
    outcome = {}
    cancel = threading.Event()

    def deliver():
        try:
            with smtplib.SMTP(host, port, timeout=8) as smtp:
                smtp.ehlo()
                if use_tls:
                    smtp.starttls()
                    smtp.ehlo()
                smtp.login(username, password)
                if cancel.is_set():
                    return
                smtp.send_message(message)
            outcome['ok'] = True
        except Exception:
            app.logger.exception('Email could not be sent to %s', to)
            outcome['ok'] = False

    worker = threading.Thread(target=deliver, daemon=True)
    worker.start()
    worker.join(10)
    if worker.is_alive():
        cancel.set()
        app.logger.error('Email send timed out for %s', to)
        return False
    return bool(outcome.get('ok'))

PHONE_EMAIL_DOMAIN = '@phone.studentstay.local'

def public_email(user):
    email = user.email or ''
    if email.endswith(PHONE_EMAIL_DOMAIN):
        return ''
    return email

def auth_payload(user):
    access_token = create_access_token(identity=user.id)
    return {
        'access_token': access_token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': public_email(user),
            'role': user.role,
            'phone': user.phone or '',
            'city': user.city or '',
            'address': user.address or '',
        }
    }

def normalize_phone(value):
    import re
    raw = str(value or '').strip()
    digits = re.sub(r'\D', '', raw)
    if len(digits) == 10:
        return '+91' + digits
    if len(digits) == 11 and digits.startswith('0'):
        return '+91' + digits[1:]
    if len(digits) == 12 and digits.startswith('91'):
        return '+' + digits
    if raw.startswith('+') and 10 <= len(digits) <= 15:
        return '+' + digits
    return ''

def find_user_by_phone(phone):
    matches = [user for user in User.query.filter(User.phone.isnot(None)).all() if normalize_phone(user.phone) == phone]
    accounts = [user for user in matches if user.role in ('student', 'landlord')]
    return accounts

def random_password():
    import bcrypt
    import secrets
    return bcrypt.hashpw(secrets.token_urlsafe(32).encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def send_sms(phone, body):
    import base64
    import json
    import re
    import urllib.parse
    import urllib.request
    import urllib.error
    sid = (os.getenv('TWILIO_ACCOUNT_SID') or '').strip()
    token = (os.getenv('TWILIO_AUTH_TOKEN') or '').strip()
    sender = (os.getenv('TWILIO_FROM_NUMBER') or '').strip()
    if not sid or not token or not sender:
        return False, 'not-configured'
    basic = base64.b64encode(f'{sid}:{token}'.encode()).decode()

    def post(message):
        data = urllib.parse.urlencode({'To': phone, 'From': sender, 'Body': message}).encode()
        request_sms = urllib.request.Request(
            f'https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json',
            data=data,
            method='POST'
        )
        request_sms.add_header('Authorization', f'Basic {basic}')
        try:
            with urllib.request.urlopen(request_sms, timeout=20) as response:
                return response.status, json.loads(response.read().decode() or '{}')
        except urllib.error.HTTPError as error:
            try:
                payload = json.loads(error.read().decode() or '{}')
            except Exception:
                payload = {}
            return error.code, payload
        except Exception:
            app.logger.exception('SMS could not be sent')
            return 0, {}

    status, payload = post(body)
    if status >= 400 and payload.get('code') == 572006:
        status, payload = post('sms_2fa')
        if status < 400:
            found = re.search(r'\b(\d{6})\b', payload.get('body') or '')
            if found:
                return True, found.group(1)
            return False, 'The text went out, but it did not include a code.'
    if status >= 400 or status == 0:
        if payload.get('code') == 21608:
            return False, 'This free SMS account can only text a number you have verified in Twilio.'
        return False, payload.get('message') or 'The text message could not be sent. Check the SMS account, then try again.'
    return True, None

# Auth Routes
@app.route('/api/auth/providers', methods=['GET'])
def auth_providers():
    google_id = (os.getenv('GOOGLE_CLIENT_ID') or '').strip()
    sms_ready = bool((os.getenv('TWILIO_ACCOUNT_SID') or '').strip() and (os.getenv('TWILIO_AUTH_TOKEN') or '').strip() and (os.getenv('TWILIO_FROM_NUMBER') or '').strip())
    return jsonify({'googleClientId': google_id, 'google': bool(google_id), 'phone': sms_ready})

@app.route('/api/auth/google', methods=['POST'])
def google_login():
    import json
    import urllib.parse
    import urllib.request
    data = request.get_json() or {}
    role = data.get('role')
    owner_roles = ('landlord', 'restaurant', 'shop', 'service')
    if role not in ('student',) + owner_roles:
        return jsonify({'error': 'Choose houses, restaurants, shops, services, or an owner type first.'}), 400
    credential = (data.get('credential') or '').strip()
    client_id = (os.getenv('GOOGLE_CLIENT_ID') or '').strip()
    if not client_id:
        return jsonify({'error': 'Google sign-in is not turned on yet. Add the Google client ID on the server.'}), 503
    if not credential:
        return jsonify({'error': 'Google did not return an account.'}), 400
    try:
        with urllib.request.urlopen('https://oauth2.googleapis.com/tokeninfo?id_token=' + urllib.parse.quote(credential), timeout=15) as response:
            profile = json.loads(response.read().decode())
    except Exception:
        return jsonify({'error': 'Google could not confirm that account. Try again.'}), 401
    if profile.get('aud') != client_id or str(profile.get('email_verified')).lower() != 'true':
        return jsonify({'error': 'That Google account could not be used.'}), 401
    email = (profile.get('email') or '').strip().lower()
    sub = (profile.get('sub') or '').strip()
    if not email or not sub:
        return jsonify({'error': 'Google did not share an email for this account.'}), 400
    user = User.query.filter_by(google_sub=sub).first() or User.query.filter(db.func.lower(User.email) == email).first()
    if not user and data.get('acceptedPolicy') is not True:
        return jsonify({'error': 'Read the Privacy and policy and accept it before this new account opens.', 'code': 'policy_required'}), 400
    display_name = (profile.get('name') or email.split('@')[0] or 'Owner')[:100]
    user, error = open_google_account(user, role, sub, display_name, email)
    if error:
        return jsonify({'error': error}), 403
    return jsonify(auth_payload(user))

def apply_sign_in_role(user, role):
    """The same account follows the form that was used.

    Sign in opens the user choices. Owners opens the owner type that was clicked.
    """
    import uuid
    owner_roles = ('landlord', 'restaurant', 'shop', 'service')
    labels = {'restaurant': 'Restaurant', 'shop': 'Shop', 'service': 'Service'}
    if role not in ('student',) + owner_roles or user.role in ('admin', 'broker'):
        return
    if user.role != role:
        user.role = role
    if role in labels and not Business.query.filter_by(owner_id=user.id, kind=role).first():
        db.session.add(Business(
            id=str(uuid.uuid4()),
            owner_id=user.id,
            kind=role,
            name=(user.name or 'Business')[:120],
            category=labels[role],
            phone=user.phone or '',
            area=user.city or 'Greater Noida',
            status='active'
        ))

def open_google_account(user, role, sub, display_name, email):
    """Sign in with Google from the tab that is open."""
    import uuid
    if user and user.role == 'admin':
        return None, 'Use your admin email and password on this form.'
    if user and user.role == 'broker':
        return None, 'Broker accounts are closed. Sign in as a student or a landlord.'
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            name=display_name,
            email=email,
            password=random_password(),
            role=role,
            phone='',
            city='Greater Noida',
            google_sub=sub
        )
        db.session.add(user)
    elif not user.google_sub:
        user.google_sub = sub
    apply_sign_in_role(user, role)
    db.session.commit()
    return user, None

@app.route('/api/auth/email', methods=['POST'])
def email_exists():
    data = request.get_json() or {}
    email = str(data.get('email') or '').strip().lower()
    if '@' not in email:
        return jsonify({'error': 'Enter an email address.'}), 400
    found = User.query.filter(db.func.lower(User.email) == email).first()
    return jsonify({'exists': found is not None})

@app.route('/api/auth/phone/send', methods=['POST'])
def send_phone_code():
    import hashlib
    import hmac
    import secrets
    from datetime import datetime, timedelta
    data = request.get_json() or {}
    if data.get('role') not in ('student', 'landlord'):
        return jsonify({'error': 'Choose Student or Landlord first.'}), 400
    phone = normalize_phone(data.get('phone'))
    if not phone:
        return jsonify({'error': 'Enter a phone number with the country code, like +91 98765 43210.'}), 400
    if not ((os.getenv('TWILIO_ACCOUNT_SID') or '').strip() and (os.getenv('TWILIO_AUTH_TOKEN') or '').strip() and (os.getenv('TWILIO_FROM_NUMBER') or '').strip()):
        return jsonify({'error': 'Phone sign-in is not turned on yet. Add the SMS account on the server.'}), 503
    recent = PhoneCode.query.filter_by(phone=phone).order_by(PhoneCode.id.desc()).first()
    if recent and recent.expires and recent.expires > datetime.utcnow() + timedelta(minutes=4):
        return jsonify({'error': 'A code was just sent. Wait a minute, then try again.'}), 429
    code = f'{secrets.randbelow(1000000):06d}'
    PhoneCode.query.filter_by(phone=phone).delete()
    secret = (os.getenv('JWT_SECRET_KEY') or 'studentstay').encode()
    row = PhoneCode(
        phone=phone,
        code_hash=hmac.new(secret, code.encode(), hashlib.sha256).hexdigest(),
        expires=datetime.utcnow() + timedelta(minutes=5),
        attempts=0
    )
    db.session.add(row)
    db.session.commit()
    sent, detail = send_sms(phone, f'Your Ekvora code is {code}. It expires in 5 minutes.')
    if not sent:
        PhoneCode.query.filter_by(phone=phone).delete()
        db.session.commit()
        message = 'Phone sign-in is not turned on yet. Add the SMS account on the server.' if detail == 'not-configured' else detail
        return jsonify({'error': message}), 502
    if detail:
        row.code_hash = hmac.new(secret, detail.encode(), hashlib.sha256).hexdigest()
        db.session.commit()
    return jsonify({'message': 'Code sent.', 'phone': phone})

@app.route('/api/auth/phone/verify', methods=['POST'])
def verify_phone_code():
    import hashlib
    import hmac
    from datetime import datetime
    data = request.get_json() or {}
    role = data.get('role')
    if role not in ('student', 'landlord'):
        return jsonify({'error': 'Choose Student or Landlord first.'}), 400
    phone = normalize_phone(data.get('phone'))
    code = ''.join(ch for ch in str(data.get('code') or '') if ch.isdigit())
    if not phone or len(code) != 6:
        return jsonify({'error': 'Enter the 6 digit code from the text message.'}), 400
    row = PhoneCode.query.filter_by(phone=phone).order_by(PhoneCode.id.desc()).first()
    if not row or not row.expires or row.expires < datetime.utcnow():
        return jsonify({'error': 'That code has expired. Send a new one.'}), 400
    if (row.attempts or 0) >= 5:
        db.session.delete(row)
        db.session.commit()
        return jsonify({'error': 'Too many tries. Send a new code.'}), 400
    secret = (os.getenv('JWT_SECRET_KEY') or 'studentstay').encode()
    expected = hmac.new(secret, code.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, row.code_hash):
        row.attempts = (row.attempts or 0) + 1
        db.session.commit()
        return jsonify({'error': 'That code is not correct.'}), 401
    accounts = find_user_by_phone(phone)
    if len(accounts) > 1:
        return jsonify({'error': 'More than one account uses this number. Sign in with email.'}), 409
    user = accounts[0] if accounts else None
    if not user:
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'Add your name. This number does not have an account yet.'}), 400
        import uuid
        digits = phone.replace('+', '')
        user = User(
            id=str(uuid.uuid4()),
            name=name[:100],
            email=f'p{digits}{PHONE_EMAIL_DOMAIN}',
            password=random_password(),
            role=role,
            phone=phone,
            city='Greater Noida'
        )
        db.session.add(user)
    elif not user.phone:
        user.phone = phone
    db.session.delete(row)
    db.session.commit()
    return jsonify(auth_payload(user))

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    
    role = data.get('role')
    business_roles = ('restaurant', 'shop', 'service')
    if role not in ('student', 'landlord') + business_roles:
        return jsonify({'error': 'Choose student, landlord, restaurant, shop, or service.'}), 400
    if data.get('acceptedPolicy') is not True:
        return jsonify({'error': 'Read the Privacy and policy and tick the box before you open an account.'}), 400
    business_name = str(data.get('businessName') or data.get('business_name') or '').strip()[:120]
    category = str(data.get('category') or '').strip()[:80]
    if role in business_roles and (not business_name or not category or not str(data.get('phone') or '').strip()):
        return jsonify({'error': 'Add the business name, category, and phone number.'}), 400

    # Check if user already exists
    if User.query.filter(db.func.lower(User.email) == str(data.get('email') or '').strip().lower()).first():
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
        role=role,
        phone=data.get('phone', ''),
        city=data.get('city', ''),
        address=data.get('address', '')
    )
    
    db.session.add(new_user)
    if role in business_roles:
        db.session.add(Business(
            id=str(uuid.uuid4()),
            owner_id=new_user.id,
            kind=role,
            name=business_name,
            category=category,
            description=str(data.get('description') or '').strip()[:2000],
            phone=str(data.get('phone') or '').strip()[:30],
            whatsapp=str(data.get('whatsapp') or '').strip()[:30],
            address=str(data.get('address') or '').strip()[:200],
            area=str(data.get('city') or '').strip()[:80] or 'Greater Noida',
            status='active'
        ))
    db.session.commit()
    
    # Send welcome email
    if role == 'landlord':
        send_email(
            data['email'],
            'Welcome to Ekvora - Landlord Account',
            f'<h1>Welcome to Ekvora!</h1><p>Hi {data["name"]},</p><p>Your landlord account has been created successfully. You can now start listing your properties.</p><p>Best regards,<br>Ekvora Team</p>'
        )
    elif role in business_roles:
        send_email(
            data['email'],
            'Welcome to Ekvora',
            f'<h1>Welcome to Ekvora!</h1><p>Hi {data["name"]},</p><p>Your {role} account is ready. Add your menu or services from your dashboard.</p><p>Best regards,<br>Ekvora Team</p>'
        )
    else:
        send_email(
            data['email'],
            'Welcome to Ekvora',
            f'<h1>Welcome to Ekvora!</h1><p>Hi {data["name"]},</p><p>Your account has been created successfully. Start browsing properties to find your perfect home.</p><p>Best regards,<br>Ekvora Team</p>'
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
    
    email = str(data.get('email') or '').strip().lower()
    user = User.query.filter(db.func.lower(User.email) == email).first() if email else None
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    import bcrypt
    if not bcrypt.checkpw(data['password'].encode('utf-8'), user.password.encode('utf-8')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if user.role == 'broker' or data.get('role') == 'broker':
        return jsonify({'error': 'Broker accounts are closed. Sign in as a student or a landlord. The admin handles the broker fee.'}), 403

    # The admin can sign in from the student or landlord form. There is no admin button.
    # Everyone else follows the tab: Sign in opens the choices, Owners opens the type clicked.
    if user.role != 'admin':
        apply_sign_in_role(user, data.get('role'))
        db.session.commit()
    
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

def password_code_hash(code):
    import hashlib
    import hmac
    secret = (os.getenv('JWT_SECRET_KEY') or 'studentstay').encode()
    return hmac.new(secret, str(code).encode(), hashlib.sha256).hexdigest()

@app.route('/api/auth/password/forgot', methods=['POST'])
def forgot_password():
    import secrets
    from datetime import datetime, timedelta
    data = request.get_json() or {}
    email = str(data.get('email') or '').strip().lower()
    if not email or '@' not in email:
        return jsonify({'error': 'Enter the email on the account.'}), 400
    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user or email.endswith(PHONE_EMAIL_DOMAIN):
        return jsonify({'error': 'No account uses that email.'}), 404
    recent = PasswordReset.query.filter_by(email=email).order_by(PasswordReset.id.desc()).first()
    if recent and recent.expires and recent.expires > datetime.utcnow() + timedelta(minutes=9):
        return jsonify({'error': 'A code was just sent. Wait a minute, then try again.'}), 429
    if not app.config.get('MAIL_USERNAME') or not app.config.get('MAIL_PASSWORD'):
        return jsonify({'error': 'Email is not set up yet, so the code could not be sent.'}), 503
    code = f'{secrets.randbelow(1000000):06d}'
    PasswordReset.query.filter_by(email=email).delete()
    row = PasswordReset(
        email=email,
        code_hash=password_code_hash(code),
        expires=datetime.utcnow() + timedelta(minutes=10),
        attempts=0
    )
    db.session.add(row)
    db.session.commit()
    sent = send_email(
        user.email,
        'Your Ekvora password code',
        f'<p>Your Ekvora code is <b>{code}</b>.</p><p>It expires in 10 minutes. If you did not ask for this, ignore this email.</p>'
    )
    if not sent:
        PasswordReset.query.filter_by(email=email).delete()
        db.session.commit()
        return jsonify({'error': 'The code could not be sent. The mail sign-in was refused, so no email went out.'}), 502
    return jsonify({'message': 'A code is on the way to that email.'})

@app.route('/api/auth/password/reset', methods=['POST'])
def reset_password():
    import hmac
    from datetime import datetime
    data = request.get_json() or {}
    email = str(data.get('email') or '').strip().lower()
    code = ''.join(ch for ch in str(data.get('code') or '') if ch.isdigit())
    password = str(data.get('password') or '')
    if not email or len(code) != 6:
        return jsonify({'error': 'Enter the email and the 6 digit code.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Use a password of at least 6 characters.'}), 400
    row = PasswordReset.query.filter_by(email=email).order_by(PasswordReset.id.desc()).first()
    if not row or not row.expires or row.expires < datetime.utcnow():
        return jsonify({'error': 'That code has expired. Send a new one.'}), 400
    if (row.attempts or 0) >= 5:
        db.session.delete(row)
        db.session.commit()
        return jsonify({'error': 'Too many tries. Send a new code.'}), 400
    if not hmac.compare_digest(password_code_hash(code), row.code_hash):
        row.attempts = (row.attempts or 0) + 1
        db.session.commit()
        return jsonify({'error': 'That code is not correct.'}), 401
    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user:
        return jsonify({'error': 'No account uses that email.'}), 404
    import bcrypt
    user.password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    PasswordReset.query.filter_by(email=email).delete()
    db.session.commit()
    return jsonify({'message': 'Password saved. Sign in with the new one.'})

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
    rows = []
    for listing in Listing.query.order_by(Listing.created.desc()).all():
        if listing.taken:
            keeps = viewer and (viewer.role == 'admin' or viewer.id == listing.owner_id or (viewer.role == 'student' and listing.id in approved))
            if not keeps:
                continue
        rows.append(serialize_listing(listing, viewer, approved, pending))
    return jsonify(rows)

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

@app.route('/api/listings/<listing_id>/taken', methods=['PUT'])
@jwt_required()
def mark_listing_taken(listing_id):
    user = User.query.get(get_jwt_identity())
    listing = Listing.query.get(listing_id)
    if not user or user.role != 'landlord':
        return jsonify({'error': 'Only the landlord can mark a room taken'}), 403
    if not listing or listing.owner_id != user.id:
        return jsonify({'error': 'That room was not found'}), 404
    want = bool((request.get_json() or {}).get('taken'))
    if not want and Unlock.query.filter_by(listing_id=listing.id, status='approved').first():
        return jsonify({'error': 'A broker fee was approved, so this room stays off the site.'}), 400
    listing.taken = want
    db.session.commit()
    return jsonify(serialize_listing(listing, user))

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
            f'<h1>New Student Request</h1><p>Hi {landlord.name},</p><p>A student has requested to rent your property: <strong>{listing.title}</strong></p><p>You can view all requests in your landlord dashboard.</p><p>Best regards,<br>Ekvora Team</p>'
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
                'address': '',
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
            'email': public_email(u),
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
    try:
        listing_ids = [row.id for row in Listing.query.filter_by(owner_id=person.id).all()]
        if listing_ids:
            Unlock.query.filter(Unlock.listing_id.in_(listing_ids)).delete(synchronize_session=False)
            Request.query.filter(Request.listing_id.in_(listing_ids)).delete(synchronize_session=False)
            Listing.query.filter(Listing.id.in_(listing_ids)).delete(synchronize_session=False)
        Unlock.query.filter_by(student_id=person.id).delete(synchronize_session=False)
        Request.query.filter_by(student_id=person.id).delete(synchronize_session=False)
        BrokerProfile.query.filter_by(user_id=person.id).delete(synchronize_session=False)
        BrokerLocation.query.filter_by(user_id=person.id).delete(synchronize_session=False)
        BrokerPortfolio.query.filter_by(broker_id=person.id).delete(synchronize_session=False)
        DonorProfile.query.filter_by(user_id=person.id).delete(synchronize_session=False)
        Donation.query.filter_by(donor_id=person.id).delete(synchronize_session=False)
        business_ids = [row.id for row in Business.query.filter_by(owner_id=person.id).all()]
        order_query = MarketOrder.query.filter((MarketOrder.customer_id == person.id) | (MarketOrder.owner_id == person.id))
        if business_ids:
            order_query = MarketOrder.query.filter((MarketOrder.customer_id == person.id) | (MarketOrder.owner_id == person.id) | (MarketOrder.business_id.in_(business_ids)))
        order_ids = [row.id for row in order_query.all()]
        if order_ids:
            MarketAudit.query.filter(MarketAudit.order_id.in_(order_ids)).delete(synchronize_session=False)
            MarketOrder.query.filter(MarketOrder.id.in_(order_ids)).delete(synchronize_session=False)
        if business_ids:
            CatalogItem.query.filter(CatalogItem.business_id.in_(business_ids)).delete(synchronize_session=False)
            Business.query.filter(Business.id.in_(business_ids)).delete(synchronize_session=False)
        db.session.delete(person)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'That account could not be deleted. Try again.'}), 400
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
        'name': ((setting.contact_name if setting else '') or (admin.name if admin else '') or 'Ekvora'),
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

def unlock_payload(row, include_private=True):
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
        'ownerName': listing.owner_name if listing and include_private else '',
        'student': {
            'name': student.name if student else 'Student',
            'email': student.email if student else '',
            'phone': student.phone if student else '',
        },
        'listing': {
            'id': listing.id if listing else '',
            'title': listing.title if listing else 'Home removed',
            'sector': (listing.sector or listing.city) if listing else '',
            'address': listing.address if listing and include_private else '',
            'rent': listing.rent if listing else 0,
            'brokerFee': int(listing.rent or 0) // 2 if listing else 0,
            'photos': (listing.photos or []) if listing else [],
            'ownerName': listing.owner_name if listing and include_private else '',
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
    return jsonify([unlock_payload(row, include_private=False) for row in rows])

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
    listing = Listing.query.get(row.listing_id)
    if listing and status == 'approved':
        listing.taken = True
    elif listing and status in ('rejected', 'pending'):
        other = Unlock.query.filter(Unlock.listing_id == listing.id, Unlock.status == 'approved', Unlock.id != row.id).first()
        if not other:
            listing.taken = False
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

from market import init_market
init_market()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
