"""
Seed script to create test accounts for StudentStay
Run this after database initialization to create test users
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, User, BrokerProfile, BrokerLocation
import bcrypt
import uuid

def seed_test_users():
    """Create test users for all roles"""
    
    with app.app_context():
        print("Creating test users...")
        
        # Define test users
        test_users = [
            {
                'name': 'Test Student',
                'email': 'student@test.com',
                'password': 'student123',
                'role': 'student',
                'phone': '+91 98765 43210',
                'city': 'Delhi'
            },
            {
                'name': 'Test Landlord',
                'email': 'landlord@test.com',
                'password': 'landlord123',
                'role': 'landlord',
                'phone': '+91 98765 43211',
                'city': 'Noida',
                'address': 'Sector 62, Noida'
            },
            {
                'name': 'Test Broker',
                'email': 'broker@test.com',
                'password': 'broker123',
                'role': 'broker',
                'phone': '+91 98765 43212',
                'city': 'Bangalore'
            },
            {
                'name': 'Test Admin',
                'email': 'admin@test.com',
                'password': 'admin123',
                'role': 'admin',
                'phone': '+91 98765 43213',
                'city': 'Mumbai'
            }
        ]
        
        created_count = 0
        updated_count = 0
        
        for user_data in test_users:
            # Check if user already exists
            existing_user = User.query.filter_by(email=user_data['email']).first()
            
            hashed_password = bcrypt.hashpw(user_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            if existing_user:
                # Update existing user
                existing_user.name = user_data['name']
                existing_user.password = hashed_password
                existing_user.role = user_data['role']
                existing_user.phone = user_data.get('phone', '')
                existing_user.city = user_data.get('city', '')
                existing_user.address = user_data.get('address', '')
                print(f"✓ Updated {user_data['role']}: {user_data['email']}")
                updated_count += 1
            else:
                # Create new user
                new_user = User(
                    id=str(uuid.uuid4()),
                    name=user_data['name'],
                    email=user_data['email'],
                    password=hashed_password,
                    role=user_data['role'],
                    phone=user_data.get('phone', ''),
                    city=user_data.get('city', ''),
                    address=user_data.get('address', '')
                )
                db.session.add(new_user)
                print(f"✓ Created {user_data['role']}: {user_data['email']}")
                created_count += 1
        
        # Commit all changes
        db.session.commit()
        
        # Create broker profile for test broker
        broker_user = User.query.filter_by(email='broker@test.com').first()
        if broker_user:
            broker_profile = BrokerProfile.query.filter_by(user_id=broker_user.id).first()
            if not broker_profile:
                broker_profile = BrokerProfile(
                    id=str(uuid.uuid4()),
                    user_id=broker_user.id,
                    license='BRO-TEST-001',
                    company='Test Broker Company',
                    experience=5,
                    specialization='Student Housing, PG, Apartments',
                    bio='Experienced broker specializing in student housing. Helping students find their perfect home since 2019.'
                )
                db.session.add(broker_profile)
                
                broker_location = BrokerLocation(
                    id=str(uuid.uuid4()),
                    user_id=broker_user.id,
                    city='Bangalore',
                    area='Indiranagar',
                    address='123 Main Street, Indiranagar, Bangalore',
                    radius=15,
                    hours='Mon-Sat, 9 AM - 7 PM'
                )
                db.session.add(broker_location)
                
                db.session.commit()
                print(f"✓ Created broker profile and location")
        
        print("\n" + "="*50)
        print(f"Seed complete! Created: {created_count}, Updated: {updated_count}")
        print("="*50)
        print("\nTest Login Credentials:")
        print("-" * 50)
        for user in test_users:
            print(f"\n{user['role'].upper()}:")
            print(f"  Email:    {user['email']}")
            print(f"  Password: {user['password']}")
        print("\n" + "="*50)

if __name__ == '__main__':
    seed_test_users()
